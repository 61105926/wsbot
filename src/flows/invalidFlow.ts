import { addKeyword, EVENTS } from "@builderbot/bot";
import { FLOW_MESSAGES } from "../config/flowMessages";
import { logger } from "../utils/logger";

/**
 * Flow para manejar opciones inválidas
 */
export const invalidFlow = addKeyword(EVENTS.ACTION).addAnswer(
  FLOW_MESSAGES.ERRORS.INVALID_OPTION,
  null,
  async (ctx, { endFlow }) => {
    logger.warn('Flow inválido ejecutado', {
      flow: 'invalid',
      phone: ctx.from
    });

    return endFlow();
  }
);
