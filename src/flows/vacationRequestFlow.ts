import { addKeyword, EVENTS } from "@builderbot/bot";
import { FLOW_MESSAGES } from "../config/flowMessages";
import { FRONTEND_CONFIG } from "../config/config";
import { logger } from "../utils/logger";
import { extractRealPhoneFromContext } from "../utils/phoneHelper";

/**
 * Flow para solicitud de vacaciones
 * Envía un link al frontend con solo el teléfono codificado en base64
 */
export const vacationRequestFlow = addKeyword([EVENTS.ACTION])
  .addAction(async (ctx, { flowDynamic }) => {
    const phoneInfo = extractRealPhoneFromContext(ctx);
    const userPhone = phoneInfo.phone;

    logger.info('Usuario solicitando vacaciones', {
      flow: 'vacationRequest',
      phone: phoneInfo.phone,
      lid: phoneInfo.isRealPhone ? undefined : phoneInfo.lid
    });

    try {
      // Extraer solo el número sin el prefijo 591
      // Si es un LID, intentar extraer solo los dígitos numéricos
      let phoneNumber = userPhone.replace('591', '');
      
      // Si es un LID (contiene @lid), intentar usar solo los dígitos antes del @
      if (phoneNumber.includes('@lid')) {
        const lidMatch = phoneNumber.match(/^(\d+)/);
        if (lidMatch) {
          phoneNumber = lidMatch[1];
        } else {
          // Si no hay dígitos, usar el LID completo como fallback
          phoneNumber = phoneNumber.replace('@lid', '');
        }
      }
      phoneNumber = String(phoneNumber);
      // Codificar el teléfono en base64
      const encodedPhone = Buffer.from(phoneNumber).toString('base64');

      // Construir URL con teléfono codificado
      const frontendUrl = `${FRONTEND_CONFIG.BASE_URL}${FRONTEND_CONFIG.VACATION_REQUEST}?data=${encodedPhone}`;

      logger.info('URL de vacaciones generada', {
        phone: phoneInfo.phone,
        lid: phoneInfo.isRealPhone ? undefined : phoneInfo.lid,
        phoneNumber: phoneNumber,
        encodedPhone: encodedPhone,
        urlLength: frontendUrl.length
      });

      // Enviar mensaje con el link
      await flowDynamic([{
        body: FLOW_MESSAGES.VACATION.SUCCESS.replace('{{url}}', frontendUrl)
      }]);

      logger.info('Link de vacaciones enviado exitosamente', {
        phone: phoneInfo.phone,
        lid: phoneInfo.isRealPhone ? undefined : phoneInfo.lid
      });

    } catch (error: any) {
      logger.error('Error al procesar solicitud de vacaciones', {
        flow: 'vacationRequest',
        phone: phoneInfo.phone,
        lid: phoneInfo.isRealPhone ? undefined : phoneInfo.lid,
        error: error.message || error,
        stack: error.stack
      });

      await flowDynamic([{
        body: FLOW_MESSAGES.VACATION.ERROR
      }]);
    }
  });
