import { addKeyword, EVENTS } from "@builderbot/bot";
import { FLOW_MESSAGES } from "../config/flowMessages";
import { logger } from "../utils/logger";
import { extractRealPhoneFromContext } from "../utils/phoneHelper";

/**
 * Flow para manejar opciones inválidas
 */
export const invalidFlow = addKeyword(EVENTS.ACTION).addAnswer(
  FLOW_MESSAGES.ERRORS.INVALID_OPTION,
  null,
  async (ctx, { endFlow }) => {
    const phoneInfo = extractRealPhoneFromContext(ctx);
    
    logger.warn('Flow inválido ejecutado', {
      flow: 'invalid',
      phone: phoneInfo.phone,
      lid: phoneInfo.isRealPhone ? undefined : phoneInfo.lid
    });

    return endFlow();
  }
);
