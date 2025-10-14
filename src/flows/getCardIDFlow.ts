import { addKeyword, EVENTS } from "@builderbot/bot";
import { getUserByID } from "../services/getUserByID";
import { FLOW_MESSAGES } from "../config/flowMessages";
import { logger } from "../utils/logger";
import { isNumericString } from "../utils/flowHelpers";

/**
 * Flow para consultar información de usuario por ID
 */
export const getCardIDFlow = addKeyword(EVENTS.ACTION)
  .addAnswer(
    FLOW_MESSAGES.PROMPTS.ENTER_ID,
    { capture: true },
    async (ctx, { flowDynamic, endFlow }) => {
      const empID = ctx.body.trim();

      logger.info('Usuario consultando por ID', {
        flow: 'getCardID',
        phone: ctx.from,
        empID
      });

      // Validar que sea numérico
      if (!isNumericString(empID)) {
        logger.warn('ID inválido (no numérico)', {
          phone: ctx.from,
          empID
        });

        return endFlow(FLOW_MESSAGES.ERRORS.INVALID_ID);
      }

      try {
        const user = await getUserByID(empID);

        logger.info('Usuario encontrado por ID', {
          phone: ctx.from,
          empID,
          userName: user.data?.name
        });

        return await flowDynamic([
          {
            body: `El nombre que corresponde a ese ID es: *${user.data.name}*`,
          },
        ]);
      } catch (error: any) {
        logger.error('Error al obtener usuario por ID en flow', {
          flow: 'getCardID',
          phone: ctx.from,
          empID,
          error: error.message || error,
          stack: error.stack
        });

        return endFlow(FLOW_MESSAGES.ERRORS.SERVICE_UNAVAILABLE);
      }
    }
  )
  .addAnswer(FLOW_MESSAGES.MENU.RETURN_TO_MENU);
