
import "dotenv/config";

import { PORT } from "./config/config";
import { getCardIDFlow } from "./flows/getCardIDFlow";
import { invalidFlow } from "./flows/invalidFlow";
import { menuFlow } from "./flows/menu.flow";
import { sendDocumentFlow } from "./flows/sendDocumentFlow";
import { getMonthsFlow } from "./flows/getMonthsFlow";

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
    ]),
    database: new MemoryDB(),
    provider: provider,
  });

  httpServer(PORT);

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

  console.log("✅ Server running on port", PORT);
};

main();
