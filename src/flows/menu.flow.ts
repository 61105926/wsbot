import { addKeyword, EVENTS } from "@builderbot/bot";
import { invalidFlow } from "./invalidFlow";
import { getMonthsFlow } from "./getMonthsFlow";
import { vacationRequestFlow } from "./vacationRequestFlow";
import { FLOW_MESSAGES } from "../config/flowMessages";
import { logger } from "../utils/logger";
import { extractRealPhoneFromContext } from "../utils/phoneHelper";

/**
 * Flow principal del menú
 */

const answerActions: Record<string, any> = {
  "1": getMonthsFlow,
  "2": vacationRequestFlow,
};

export const menuFlow = addKeyword([EVENTS.WELCOME, "menu"])
  .addAnswer(FLOW_MESSAGES.MENU.WELCOME)
  .addAction({ capture: true }, async (ctx, { gotoFlow }) => {
    const phoneInfo = extractRealPhoneFromContext(ctx);
    
    logger.info('Usuario seleccionando opción de menú', {
      flow: 'menu',
      phone: phoneInfo.phone,
      lid: phoneInfo.isRealPhone ? undefined : phoneInfo.lid,
      option: ctx.body
    });

    const flow = answerActions[ctx.body] || invalidFlow;

    if (flow === invalidFlow) {
      logger.warn('Opción de menú inválida', {
        phone: phoneInfo.phone,
        lid: phoneInfo.isRealPhone ? undefined : phoneInfo.lid,
        option: ctx.body
      });
    }

    gotoFlow(flow);
  });
