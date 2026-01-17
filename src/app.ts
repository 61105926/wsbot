
import "dotenv/config";

import { createBot, createFlow, addKeyword, utils, EVENTS } from '@builderbot/bot'

import { MemoryDB as Database } from '@builderbot/bot'


import { PORT, SENDWAVE_CONFIG } from "./config/config";
import { getCardIDFlow } from "./flows/getCardIDFlow";
import { invalidFlow } from "./flows/invalidFlow";
import { menuFlow } from "./flows/menu.flow";
import { sendDocumentFlow } from "./flows/sendDocumentFlow";
import { getMonthsFlow } from "./flows/getMonthsFlow";
import { vacationRequestFlow } from "./flows/vacationRequestFlow";
import { naturalConversationFlow } from "./flows/naturalConversationFlow";
import { flowEnd } from "./flows/endFlow";
import { SendWaveProvider as Provider } from "@gamastudio/sendwave-provider";

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
import { webhookHandler } from "./handlers/webhook";
import { tmpCleanupService } from "./services/tmpCleanup.service";
import { startMonthlyReminderScheduler } from "./services/monthlyReminderScheduler";
import { processMonthlyReminders } from "./handlers/monthlyVacationReminder";
import { logger } from "./utils/logger";
import { sendJSON } from "./utils/response";
import { extractRealPhoneFromContext } from "./utils/phoneHelper";
import cors from "cors";

import { createSendWaveProvider, type GlobalVendorArgs } from "@gamastudio/sendwave-provider";

process.on('uncaughtException', (error) => {
  logger.error('❌ Uncaught Exception', { error: error.message });
});

process.on('unhandledRejection', (reason) => {
  logger.error('❌ Unhandled Rejection', { reason });
});

process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));

const main = async () => {
  try {
    logger.info('🚀 Iniciando aplicación', {
      nodeVersion: process.version,
      provider: 'SendWave'
    });
    
    // Configuración de SendWave
    const sendWaveConfig: Partial<GlobalVendorArgs> = {
      name: 'wsbot',
      apiKey: 'F0EE9493-FF01-48AE-8936-0CEE429C5B3C',
      port: 3005, 
      delay: SENDWAVE_CONFIG.DELAY,
      linkPreview: SENDWAVE_CONFIG.LINK_PREVIEW,
      message: {
        mergeMessage: false,
        timeMergeMessage: 2,
      },
      queueFlow: {
        enabled: SENDWAVE_CONFIG.QUEUE_FLOW.ENABLED,
        warningTimeout: SENDWAVE_CONFIG.QUEUE_FLOW.WARNING_TIMEOUT,
        endTimeout: SENDWAVE_CONFIG.QUEUE_FLOW.END_TIMEOUT,
        warningMessage: SENDWAVE_CONFIG.QUEUE_FLOW.WARNING_MESSAGE,
      },
    };

    // Validar que la API key esté configurada
    if (!sendWaveConfig.apiKey || sendWaveConfig.apiKey === "") {
      throw new Error("SENDWAVE_API_KEY no está configurada en las variables de entorno");
    }

    // Crear el proveedor SendWave directamente
    const provider = createSendWaveProvider(sendWaveConfig);

    // Inicializar el proveedor SendWave
    // initVendor() es protegido y se llama internamente por initAll()
    const port = provider.globalVendorArgs.port || PORT;
    await provider.initAll(port);

    // Configurar event listeners de SendWave
    provider.on('ready', (isReady: boolean) => {
      logger.info('Estado de conexión SendWave', { 
        connected: isReady ? 'Conectado' : 'Desconectado' 
      });
      connectionStatus.setConnected(isReady);
    });

    provider.on('auth_failure', (error: any) => {
      logger.error('Error de autenticación SendWave', { error });
    });

    provider.on('message', async (ctx: any) => {
      try {
        // Log detallado del contexto para debugging
        logger.debug('Contexto completo del mensaje', {
          from: ctx.from,
          key: ctx.key,
          pushName: ctx.pushName,
          body: ctx.body?.substring(0, 50),
          allKeys: Object.keys(ctx)
        });
        
        const phoneInfo = await extractRealPhoneFromContext(ctx, provider);
        const phoneNumber = phoneInfo.phone;
        const normalizedPhone = phoneInfo.normalizedPhone || phoneNumber.replace(/^591/, '');
        const userName = ctx.pushName || ctx.notify || 'Sin nombre';
        const messageBody = ctx.body || ctx.message?.conversation || ctx.message?.extendedTextMessage?.text || '';
        const messagePreview = messageBody.length > 100 ? messageBody.substring(0, 100) + '...' : messageBody;
        
        logger.info(`📱 Mensaje recibido de ${phoneInfo.isRealPhone ? phoneNumber : 'LID: ' + phoneNumber}`, { 
          telefono: phoneNumber,
          telefonoNormalizado: normalizedPhone, // Para usar en APIs (sin 591)
          numeroCompleto: phoneInfo.isRealPhone ? phoneNumber : `LID: ${phoneInfo.lid}`,
          esNumeroReal: phoneInfo.isRealPhone,
          nombre: userName,
          mensaje: messagePreview,
          longitudMensaje: messageBody.length,
          timestamp: new Date().toISOString()
        });
      } catch (error: any) {
        logger.error('Error al procesar log de mensaje', {
          error: error.message,
          stack: error.stack,
          ctx: ctx.from || 'Desconocido'
        });
      }
    });

    provider.on('user-message', async (data: any) => {
      try {
        // Log detallado del contexto para debugging
        logger.debug('Contexto completo del mensaje de usuario', {
          from: data.from,
          key: data.key,
          pushName: data.pushName,
          body: data.body?.substring(0, 50),
          allKeys: Object.keys(data)
        });
        
        const phoneInfo = await extractRealPhoneFromContext(data, provider);
        const phoneNumber = phoneInfo.phone;
        const normalizedPhone = phoneInfo.normalizedPhone || phoneNumber.replace(/^591/, '');
        const userName = data.pushName || data.notify || 'Sin nombre';
        const messageBody = data.body || data.message?.conversation || data.message?.extendedTextMessage?.text || '';
        const messagePreview = messageBody.length > 100 ? messageBody.substring(0, 100) + '...' : messageBody;
        
        logger.info(`💬 Usuario ${phoneInfo.isRealPhone ? phoneNumber : 'LID: ' + phoneNumber} escribió`, { 
          telefono: phoneNumber,
          telefonoNormalizado: normalizedPhone, // Para usar en APIs (sin 591)
          numeroCompleto: phoneInfo.isRealPhone ? phoneNumber : `LID: ${phoneInfo.lid}`,
          esNumeroReal: phoneInfo.isRealPhone,
          nombre: userName,
          mensaje: messagePreview,
          longitudMensaje: messageBody.length,
          timestamp: new Date().toISOString()
        });
        // El timeout se resetea automáticamente si queueFlow está habilitado
      } catch (error: any) {
        logger.error('Error al procesar log de mensaje de usuario', {
          error: error.message,
          stack: error.stack,
          data: data.from || 'Desconocido'
        });
      }
    });

    // Los eventos de Queue Flow se configuran dinámicamente por usuario
    // El formato es 'userInactive-{phone}' según la documentación

    // Registrar provider para trackear conexión
    connectionStatus.setProvider(provider);

    // SendWaveProvider es compatible con BuilderBot pero TypeScript necesita un cast
    // SendWaveProvider es compatible con BuilderBot pero TypeScript necesita un cast
    // porque no extiende formalmente de ProviderClass
    const { httpServer, handleCtx } = await createBot({
      flow: createFlow([
        naturalConversationFlow, // Flow conversacional natural (prioridad)
        menuFlow,
        invalidFlow,
        getCardIDFlow,
        sendDocumentFlow,
        getMonthsFlow,
        vacationRequestFlow,
        flowEnd, // Flow para manejar inactividad de usuarios (Queue Flow)
      ]),
      database: new Database(),
      provider: provider as unknown as any,
    });

    // SendWave maneja la reconexión automáticamente, no necesitamos setupAutoReconnection
    // NOTA: No llamamos httpServer(PORT) porque provider.initAll() ya inicia el servidor
    // El servidor ya está escuchando en el puerto configurado en sendWaveConfig.port

    // Configurar CORS para permitir peticiones desde el frontend
    provider.server.use(cors({
      origin: [
        'http://localhost:3002', 
        'http://190.171.225.68:8006',
        'http://190.171.225.68:3002',
        'http://190.171.225.68:3005',
        'https://hrx.minoil.com.bo'
      ],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // Endpoint de prueba para correo electrónico
    provider.server.post("/api/test-email", handleCtx(async (bot: any, req: any, res: any) => {
      try {
        const { sendVacationEmail, verifyEmailConnection } = await import('./services/emailService');
        
        logger.info('📧 Endpoint de prueba de correo llamado');
        await verifyEmailConnection();
        
        // Enviar correo de prueba
        const emailSent = await sendVacationEmail({
          empleadoNombre: 'Empleado de Prueba',
          empleadoId: 'TEST001',
          estado: 'APROBADO',
          fechas: [
            { fecha: '20-01-2024', turno: 'MAÑANA' },
            { fecha: '21-01-2024', turno: 'COMPLETO' },
            { fecha: '22-01-2024', turno: 'COMPLETO' }
          ],
          comentario: 'Este es un correo de prueba del sistema de vacaciones',
          regional: 'La Paz',
          managerNombre: 'Manager de Prueba',
          reemplazantes: [
            {
              emp_id: 'EMP123',
              nombre: 'Juan Pérez',
              telefono: '77712345'
            },
            {
              emp_id: 'EMP456',
              nombre: 'María González',
              telefono: '77767890'
            }
          ]
        });
        
        if (emailSent) {
          return sendJSON(res, 200, {
            success: true,
            message: 'Correo de prueba enviado exitosamente a rrhhlpz@minoil.com.bo'
          });
        } else {
          return sendJSON(res, 500, {
            success: false,
            error: 'No se pudo enviar el correo de prueba'
          });
        }
      } catch (error: any) {
        logger.error('Error en endpoint de prueba de correo', {
          error: error.message,
          stack: error.stack
        });
        return sendJSON(res, 500, {
          success: false,
          error: error.message
        });
      }
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

    // Webhook genérico para recibir eventos externos
    provider.server.post("/webhook", handleCtx(webhookHandler));
    provider.server.get("/webhook", handleCtx(async (bot: any, req: any, res: any) => {
      // Endpoint GET para verificación de webhook (usado por algunos servicios)
      return sendJSON(res, 200, {
        success: true,
        message: 'Webhook endpoint activo',
        method: 'GET',
        timestamp: new Date().toISOString()
      });
    }));

    tmpCleanupService.startAutoCleanup(30, 60);

    provider.server.post("/api/monthly-reminders/trigger", handleCtx(async (bot: any, req: any, res: any) => {
      try {
        const { year, month } = req.body || {};
        
        if (!connectionStatus.isConnected()) {
          return sendJSON(res, 503, { 
            success: false, 
            error: 'El bot de WhatsApp no está conectado',
            code: 'BOT_NOT_CONNECTED'
          });
        }

        processMonthlyReminders(bot, year, month)
          .then(() => logger.info('✅ Recordatorios completados'))
          .catch((error: any) => {
            if (error?.code === 'NO_VACATIONS' && error?.isSuccess) {
              logger.info('ℹ️ No hay vacaciones para el mes seleccionado');
            } else if (!error?.message?.includes('QR code') && !error?.code?.includes('100')) {
              logger.error('❌ Error en recordatorios', { error: error.message });
            }
          });

        return sendJSON(res, 200, { 
          success: true, 
          message: 'Proceso de recordatorios iniciado',
          status: 'processing'
        });
      } catch (error: any) {
        logger.error('❌ Error en endpoint de recordatorios', { error: error.message });
        return sendJSON(res, 500, { 
          success: false, 
          error: error.message || 'Error al ejecutar el proceso',
          code: error.code || 'UNKNOWN_ERROR'
        });
      }
    }));

    startMonthlyReminderScheduler(async () => {
      logger.info('🔔 Scheduler de recordatorios ejecutado');
    });

    logger.info('✅ Servidor iniciado correctamente', {
      port: PORT,
      provider: 'SendWave',
      environment: process.env.NODE_ENV || 'development'
    });
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
