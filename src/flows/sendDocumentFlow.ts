import { addKeyword, EVENTS } from "@builderbot/bot";
import { FLOW_MESSAGES } from "../config/flowMessages";
import { logger } from "../utils/logger";

/**
 * Flow para envío de documentos de ejemplo
 *
 * NOTA: Este flow es solo un ejemplo. Para uso en producción,
 * coloca la imagen real en src/images/ y actualiza la ruta en media.
 */
export const sendDocumentFlow = addKeyword(EVENTS.ACTION)
  .addAnswer(FLOW_MESSAGES.PROMPTS.SENDING_IMAGE, null, async (ctx) => {
    logger.info('Enviando documento de ejemplo', {
      flow: 'sendDocument',
      phone: ctx.from
    });

    // NOTA: Reemplaza con la ruta a tu imagen real
    // Ejemplo: { media: path.join(__dirname, "../images/document.png") }
  })
  .addAnswer(FLOW_MESSAGES.SUCCESS.DOCUMENT_SENT);
