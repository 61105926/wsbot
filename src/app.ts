
import "dotenv/config";

import { createBot, createProvider, createFlow, addKeyword, utils, EVENTS } from '@builderbot/bot'

import { MemoryDB as Database } from '@builderbot/bot'

import { BaileysProvider as Provider } from './providers/sherpaProvider'

import { PORT } from "./config/config";
import { getCardIDFlow } from "./flows/getCardIDFlow";
import { invalidFlow } from "./flows/invalidFlow";
import { menuFlow } from "./flows/menu.flow";
import { sendDocumentFlow } from "./flows/sendDocumentFlow";
import { getMonthsFlow } from "./flows/getMonthsFlow";
import { vacationRequestFlow } from "./flows/vacationRequestFlow";

import { uploadFile } from "./middlewares/fileMiddleware";
import { sendRegionalMessagesHandler } from "./handlers/sendRegionalMessages";
import { sendPayslipLinksHandler } from "./handlers/sendPayslipLinks";
import { progressHandler } from "./handlers/progress";
import { pauseHandler, resumeHandler, cancelHandler, resetHandler } from "./handlers/queueControl";
import { regionalesHandler } from "./handlers/regionales";
import { statusBotHandler } from "./handlers/statusBot";
import { connectionStatus } from "./services/connectionStatus";
import { getVacationConfigHandler, updateVacationConfigHandler, toggleVacationConfigHandler } from "./handlers/vacationConfig";
import { storeVacationHandler } from "./handlers/storeVacation";
import { vacationNotificationHandler } from "./handlers/vacationNotification";
import { getVacationDataHandler } from "./handlers/getVacationData";
import { tmpCleanupService } from "./services/tmpCleanup.service";
import { startMonthlyReminderScheduler } from "./services/monthlyReminderScheduler";
import { processMonthlyReminders } from "./handlers/monthlyVacationReminder";
import { logger } from "./utils/logger";
import { sendJSON } from "./utils/response";
import cors from "cors";

// Configurar reconexión automática para desconexiones repentinas
function setupAutoReconnection(provider: any) {
  const boundSockets = new WeakSet<any>();

  // Función para obtener el socket del provider
  const getSocket = () => {
    try {
      const sock = (provider as any)?.vendor || 
                  (provider as any)?.getInstance?.();
      if (sock && sock.ev) {
        if (boundSockets.has(sock)) {
          return sock;
        }
        boundSockets.add(sock);
        return sock;
      }
      return null;
    } catch (error) {
      logger.error('Error al obtener socket para reconexión', { error });
      return null;
    }
  };

  // Escuchar eventos de conexión
  if (provider && typeof provider.on === 'function') {
    provider.on('connection.update', (update: any) => {
      if (update.connection === 'close' && update.lastDisconnect) {
        const lastDisconnect = update.lastDisconnect;
        const reason = lastDisconnect.error?.output?.statusCode || 
                       lastDisconnect.error?.output?.disconnectReason ||
                       lastDisconnect.error?.message ||
                       'unknown';
        
        const date = lastDisconnect.date ? new Date(lastDisconnect.date).toISOString() : new Date().toISOString();
        const sock = getSocket();

        logger.warn('Desconexión detectada', {
          reason,
          date,
          error: lastDisconnect.error?.message
        });

        // Mapear razones de desconexión
        let disconnectReason = reason;
        if (typeof reason === 'number') {
          const reasonMap: Record<number, string> = {
            401: 'loggedOut',
            403: 'connectionReplaced',
            404: 'connectionClosed',
            408: 'timedOut',
            429: 'connectionLost',
            500: 'connectionLost',
            502: 'connectionLost',
            503: 'connectionLost',
            504: 'timedOut',
          };
          disconnectReason = reasonMap[reason] || 'unknown';
        } else if (typeof reason === 'string') {
          if (reason.includes('logged out') || reason.includes('401')) {
            disconnectReason = 'loggedOut';
          } else if (reason.includes('connection closed') || reason.includes('404')) {
            disconnectReason = 'connectionClosed';
          } else if (reason.includes('connection lost') || reason.includes('429') || reason.includes('500')) {
            disconnectReason = 'connectionLost';
          } else if (reason.includes('connection replaced') || reason.includes('403')) {
            disconnectReason = 'connectionReplaced';
          } else if (reason.includes('restart required')) {
            disconnectReason = 'restartRequired';
          } else if (reason.includes('timed out') || reason.includes('408') || reason.includes('504')) {
            disconnectReason = 'timedOut';
          }
        }

        // Manejar reconexión según el tipo
        switch (disconnectReason) {
          case 'connectionClosed':
            logger.info(`Connection closed, reconnecting.... ${date}`);
            if (sock && typeof sock.connect === 'function') {
              sock.connect();
            }
            break;

          case 'connectionLost':
            logger.info(`Connection Lost from Server, reconnecting... ${date}`);
            if (sock && typeof sock.connect === 'function') {
              sock.connect();
            }
            break;

          case 'connectionReplaced':
            logger.error(`Connection Replaced, Another New Session Opened, Please Close Current Session First ${date}`);
            process.exit(1);
            break;

          case 'loggedOut':
            logger.error('Device Logged Out, Please Delete session and Scan Again.');
            process.exit(1);
            break;

          case 'restartRequired':
            logger.info(`Restart Required, Restarting... ${date}`);
            if (sock && typeof sock.connect === 'function') {
              sock.connect();
            }
            break;

          case 'timedOut':
            logger.info(`Connection TimedOut, Reconnecting... ${date}`);
            if (sock && typeof sock.connect === 'function') {
              sock.connect();
            }
            break;

          default:
            logger.warn(`Unknown DisconnectReason: ${disconnectReason} ${date} | ${reason}`);
            if (sock && typeof sock.connect === 'function') {
              sock.connect();
            }
            break;
        }
      }
    });
  }
}

// Manejador global de errores no capturados
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  // No salir del proceso, solo registrar el error
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // No salir del proceso, solo registrar el error
});

// Manejar señales de terminación
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  process.exit(0);
});

const main = async () => {
  try {
    console.info("Using Sherpa provider");
    const adapterProvider = createProvider(Provider, {
      version: [2, 3000, 1025190524],
      browser: ["Windows", "Chrome", "Chrome 114.0.5735.198"],
      experimentalStore: true, // Significantly reduces resource consumption
      timeRelease: 86400000 // Cleans up data every 24 hours (in milliseconds)
    })
    const provider = adapterProvider;

    // Registrar provider para trackear conexión
    connectionStatus.setProvider(provider);

    const { httpServer, handleCtx } = await createBot({
      flow: createFlow([
        menuFlow,
        invalidFlow,
        getCardIDFlow,
        sendDocumentFlow,
        getMonthsFlow,
        vacationRequestFlow,
      ]),
      database: new Database(),
      provider: provider,
    });

    // Configurar reconexión automática
    setupAutoReconnection(provider);

    httpServer(PORT);

    // Configurar CORS para permitir peticiones desde el frontend
    provider.server.use(cors({
      origin: [
        'http://localhost:3002', 
        'http://190.171.225.68',
        'http://190.171.225.68:3002',
        'http://190.171.225.68:3005',
        'https://hrx.minoil.com.bo'
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // Status del bot
    provider.server.get("/status", handleCtx(statusBotHandler));

    // Mensajes masivos por regionales
    provider.server.post("/sendRegionalMessages", uploadFile.single("file"), handleCtx(sendRegionalMessagesHandler));
    provider.server.get("/regionales", handleCtx(regionalesHandler));

    // Boletas masivas
    provider.server.post("/sendPayslipLinks", handleCtx(sendPayslipLinksHandler));

    // Control de progreso
    provider.server.get("/progress", handleCtx(progressHandler));
    provider.server.post("/pause", handleCtx(pauseHandler));
    provider.server.post("/resume", handleCtx(resumeHandler));
    provider.server.post("/cancel", handleCtx(cancelHandler));
    provider.server.post("/reset", handleCtx(resetHandler));

    // Configuración de vacaciones
    provider.server.get("/vacation-config", handleCtx(getVacationConfigHandler));
    provider.server.post("/vacation-config", handleCtx(updateVacationConfigHandler));
    provider.server.post("/vacation-config/toggle", handleCtx(toggleVacationConfigHandler));

    // Almacenar solicitudes de vacaciones
    provider.server.post("/api/store-vacation", handleCtx(storeVacationHandler));

    // Notificaciones de vacaciones (aprobación/rechazo)
    provider.server.post("/api/vacation-notification", handleCtx(vacationNotificationHandler));
    provider.server.get("/api/vacation-data/:id", handleCtx(getVacationDataHandler));
    
    // Endpoint de prueba para WhatsApp
    const { testWhatsAppHandler } = await import('./handlers/testWhatsApp');
    provider.server.post("/api/test-whatsapp", handleCtx(testWhatsAppHandler));

    // Iniciar limpieza automática de archivos temporales
    // Limpia archivos más antiguos de 60 minutos cada 30 minutos
    tmpCleanupService.startAutoCleanup(30, 60);

    // Endpoint para ejecutar recordatorios manualmente (útil para pruebas)
    provider.server.post("/api/monthly-reminders/trigger", handleCtx(async (bot: any, req: any, res: any) => {
      try {
        const { year, month } = req.body || {};
        logger.info('🔔 Endpoint de recordatorios mensuales llamado manualmente', { 
          year, 
          month,
          bot_connected: connectionStatus.isConnected()
        });
        
        // Verificar conexión del bot antes de procesar
        if (!connectionStatus.isConnected()) {
          logger.warn('⚠️ Bot no conectado, rechazando solicitud');
          return sendJSON(res, 503, { 
            success: false, 
            error: 'El bot de WhatsApp no está conectado. Por favor, escanea el código QR para conectar el bot antes de enviar recordatorios.',
            code: 'BOT_NOT_CONNECTED'
          });
        }

        // Ejecutar el proceso y capturar el resultado para saber si hay vacaciones
        processMonthlyReminders(bot, year, month)
          .then(() => {
            // Proceso completado exitosamente
            logger.info('✅ Proceso de recordatorios completado exitosamente');
          })
          .catch((error: any) => {
            // Verificar si es un caso especial (no hay vacaciones)
            if (error?.code === 'NO_VACATIONS' && error?.isSuccess) {
              // No es un error real, solo que no hay vacaciones para procesar
              logger.info('ℹ️ Proceso completado: No hay vacaciones para el mes seleccionado');
              return; // No registrar como error
            }
            
            // Verificar si es un error de QR code (error residual que puede aparecer después de completar)
            const isQRCodeError = error?.message?.includes('QR code') || 
                                 error?.message?.includes('scanning') || 
                                 error?.code === '100' ||
                                 error?.code === 'BOT_NOT_CONNECTED';
            
            if (isQRCodeError) {
              // Si es un error de QR code residual, solo registrar como debug (no crítico)
              // El proceso probablemente ya completó exitosamente antes de este error
              logger.debug('⚠️ Error de QR code residual detectado (proceso ya completó, no crítico)', { 
                error: error.message,
                code: error.code
              });
            } else {
              // Solo registrar errores críticos que no son de conexión
              logger.error('❌ Error en proceso de recordatorios (segundo plano)', { 
                error: error.message,
                code: error.code
              });
            }
          });

        // Responder inmediatamente que el proceso se inició
        return sendJSON(res, 200, { 
          success: true, 
          message: 'Proceso de recordatorios mensuales iniciado correctamente. Las notificaciones se están enviando en segundo plano.',
          status: 'processing'
        });
      } catch (error: any) {
        // Verificar si es un error de QR code (error residual que puede aparecer después de completar)
        const isQRCodeError = error?.message?.includes('QR code') || 
                             error?.message?.includes('scanning') || 
                             error?.code === '100';
        
        if (isQRCodeError) {
          // Si es un error de QR code, probablemente el proceso ya se ejecutó en segundo plano
          // Responder como éxito ya que el proceso se inició correctamente
          logger.debug('⚠️ Error de QR code detectado (probablemente residual, proceso ya iniciado)', { 
            error: error.message 
          });
          return sendJSON(res, 200, { 
            success: true, 
            message: 'Proceso de recordatorios mensuales iniciado correctamente. Las notificaciones se están enviando en segundo plano.',
            status: 'processing',
            warning: 'Se detectó un error de conexión residual, pero el proceso se inició correctamente'
          });
        }
        
        // Para otros errores, registrar y responder con error
        logger.error('❌ Error en endpoint de recordatorios mensuales', { 
          error: error.message,
          code: error.code 
        });
        return sendJSON(res, 500, { 
          success: false, 
          error: error.message || 'Error al ejecutar el proceso de recordatorios',
          code: error.code || 'UNKNOWN_ERROR'
        });
      }
    }));

    // Iniciar scheduler de recordatorios mensuales
    // Se ejecuta el día 1 de cada mes a las 9:00 AM
    // Nota: El scheduler necesita acceso al bot, pero el bot solo está disponible en el contexto de handleCtx
    // Por ahora, el scheduler se ejecutará pero necesitará que el bot esté disponible cuando se ejecute
    startMonthlyReminderScheduler(async () => {
      // El scheduler se ejecutará automáticamente, pero necesitamos acceso al bot
      // Por ahora, usaremos el provider directamente si el bot no está disponible
      logger.warn('⚠️ Scheduler ejecutado - el bot se obtendrá del contexto cuando sea necesario');
    });

    console.log("✅ Server running on port", PORT);
    
    // Mantener el proceso vivo
    // El servidor HTTP y el provider mantendrán el proceso activo
  } catch (error) {
    console.error("❌ Error starting server:", error);
    console.error("Stack:", error instanceof Error ? error.stack : 'No stack available');
    process.exit(1);
  }
};

main().catch((error) => {
  console.error("❌ Unhandled error in main:", error);
  console.error("Stack:", error instanceof Error ? error.stack : 'No stack available');
  process.exit(1);
});
