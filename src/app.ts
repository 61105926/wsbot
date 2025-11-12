
import "dotenv/config";

import { createBot, createProvider, createFlow, addKeyword, utils, EVENTS } from '@builderbot/bot'

import { MemoryDB as Database } from '@builderbot/bot'

import { BaileysProvider as Provider } from 'builderbot-provider-sherpa'

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
import cors from "cors";

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
    console.info("Using Baileys Sherpa provider");
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
