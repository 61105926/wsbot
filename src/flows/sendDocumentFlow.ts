import { addKeyword, EVENTS } from "@builderbot/bot";

import { imageBase64 } from "./image";

export const sendDocumentFlow = addKeyword(EVENTS.ACTION)
  .addAnswer("⏰ Enviando documento espere....", {
    //media: path.resolve(__dirname, "/bot.qr.png"),
    media: `blob:${imageBase64}`,
  })
  .addAnswer("Imagen enviada.");
