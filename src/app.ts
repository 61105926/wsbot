
import "dotenv/config";

import { PORT } from "./config/config";
import { getCardIDFlow } from "./flows/getCardIDFlow";
import { invalidFlow } from "./flows/invalidFlow";
import { menuFlow } from "./flows/menu.flow";
import { sendDocumentFlow } from "./flows/sendDocumentFlow";
import { getMonthsFlow } from "./flows/getMonthsFlow";
import { vacationRequestFlow } from "./flows/vacationRequestFlow";

import { uploadFile } from "./middlewares/fileMiddleware";
import {
  createBot,
  createFlow,
  createProvider,
  MemoryDB,
} from "@builderbot/bot";
import { BaileysProvider } from "@builderbot/provider-baileys";
import { sendRegionalMessagesHandler } from "./handlers/sendRegionalMessages";
import { sendPayslipLinksHandler } from "./handlers/sendPayslipLinks";
import { progressHandler } from "./handlers/progress";
import { pauseHandler, resumeHandler, cancelHandler, resetHandler } from "./handlers/queueControl";
import { regionalesHandler } from "./handlers/regionales";
import { statusBotHandler } from "./handlers/statusBot";
import { connectionStatus } from "./services/connectionStatus";
import { getVacationConfigHandler, updateVacationConfigHandler, toggleVacationConfigHandler } from "./handlers/vacationConfig";
import { tmpCleanupService } from "./services/tmpCleanup.service";
import cors from "cors";

// Manejador global de errores no capturados
process.on('uncaughtException', (error: Error) => {
  // Ignorar errores de lectura del archivo QR que ya no existe
  if (error.message.includes('bot.qr.png') && error.message.includes('ENOENT')) {
    console.log('⚠️  QR file read error ignored (connection already established)');
    return;
  }
  // Para otros errores, mostrar el error pero no detener el proceso
  console.error('❌ Uncaught Exception:', error);
});

// Manejador de promesas rechazadas no capturadas
process.on('unhandledRejection', (reason: any) => {
  console.error('❌ Unhandled Rejection:', reason);
});

const main = async () => {
   const provider = createProvider(BaileysProvider,{
    version: [2, 3000, 1023223821]
  });
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
    database: new MemoryDB(),
    provider: provider,
  });

  httpServer(PORT);

  // Configurar CORS para permitir peticiones desde el frontend
  provider.server.use(cors({
    origin: ['http://localhost:3002', 'http://190.171.225.68'],
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

  // Iniciar limpieza automática de archivos temporales
  // Limpia archivos más antiguos de 60 minutos cada 30 minutos
  tmpCleanupService.startAutoCleanup(30, 60);

  console.log("✅ Server running on port", PORT);
};

main();
