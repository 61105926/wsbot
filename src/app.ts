
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
import { storeVacationHandler } from "./handlers/storeVacation";
import { vacationNotificationHandler } from "./handlers/vacationNotification";
import { tmpCleanupService } from "./services/tmpCleanup.service";
import cors from "cors";

// Manejador global de errores no capturados


const main = async () => {
  

  const provider = createProvider(BaileysProvider, {

  version: [2, 3000, 1025190524],
  browser: ["Windows", "Chrome", "Chrome 114.0.5735.198"],
  writeMyself: "both",
  experimentalStore: true, // Significantly reduces resource consumption
  timeRelease: 86400000 // Cleans up data every 24 hours (in milliseconds)
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

  // Almacenar solicitudes de vacaciones
  provider.server.post("/api/store-vacation", handleCtx(storeVacationHandler));

  // Notificaciones de vacaciones (aprobación/rechazo)
  provider.server.post("/api/vacation-notification", handleCtx(vacationNotificationHandler));

  // Iniciar limpieza automática de archivos temporales
  // Limpia archivos más antiguos de 60 minutos cada 30 minutos
  tmpCleanupService.startAutoCleanup(30, 60);

  console.log("✅ Server running on port", PORT);
};

main();
