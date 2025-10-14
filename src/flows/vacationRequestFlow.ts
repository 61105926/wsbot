import { addKeyword, EVENTS } from "@builderbot/bot";
import { FLOW_MESSAGES } from "../config/flowMessages";
import { FRONTEND_CONFIG } from "../config/config";
import { logger } from "../utils/logger";

/**
 * Flow para solicitud de vacaciones
 * Envía un link al frontend con solo el teléfono codificado en base64
 */
export const vacationRequestFlow = addKeyword([EVENTS.ACTION])
  .addAnswer(FLOW_MESSAGES.VACATION.PROCESSING)
  .addAction(async (ctx, { flowDynamic }) => {
    const userPhone = ctx.from;

    logger.info('Usuario solicitando vacaciones', {
      flow: 'vacationRequest',
      phone: userPhone
    });

    try {
      // Extraer solo el número sin el prefijo 591
      const phoneNumber = userPhone.replace('591', '');

      // Codificar el teléfono en base64
      const encodedPhone = Buffer.from(phoneNumber).toString('base64');

      // Construir URL con teléfono codificado
      const frontendUrl = `${FRONTEND_CONFIG.BASE_URL}${FRONTEND_CONFIG.VACATION_REQUEST}?data=${encodedPhone}`;

      logger.info('URL de vacaciones generada', {
        phone: userPhone,
        phoneNumber: phoneNumber,
        encodedPhone: encodedPhone,
        urlLength: frontendUrl.length
      });

      // Enviar mensaje con el link
      await flowDynamic([{
        body: FLOW_MESSAGES.VACATION.SUCCESS.replace('{{url}}', frontendUrl)
      }]);

      logger.info('Link de vacaciones enviado exitosamente', {
        phone: userPhone
      });

    } catch (error: any) {
      logger.error('Error al procesar solicitud de vacaciones', {
        flow: 'vacationRequest',
        phone: userPhone,
        error: error.message || error,
        stack: error.stack
      });

      await flowDynamic([{
        body: FLOW_MESSAGES.VACATION.ERROR
      }]);
    }
  });
