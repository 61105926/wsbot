import { Bot } from "./bot.interface";
import { sendJSON, asyncHandler } from "../utils/response";
import { logger } from "../utils/logger";

const handler = async (bot: Bot, req: any, res: any) => {
  try {
    // Obtener el body de la petición
    let body = req.body;
    
    // Si el body es un string, intentar parsearlo
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        // Si no es JSON válido, mantenerlo como string
      }
    }

    // Obtener headers para validación opcional
    const headers = req.headers || {};
    const signature = headers['x-signature'] || headers['x-webhook-signature'] || null;
    const eventType = headers['x-event-type'] || headers['event-type'] || body?.event || body?.type || 'unknown';

    // Log del webhook recibido
    logger.info('📥 Webhook recibido', {
      eventType,
      hasSignature: !!signature,
      bodyKeys: body ? Object.keys(body) : [],
      timestamp: new Date().toISOString()
    });

    // Aquí puedes agregar validación de firma si es necesario
    // if (signature && !validateSignature(body, signature)) {
    //   return sendJSON(res, 401, {
    //     success: false,
    //     error: 'Invalid signature'
    //   });
    // }

    // Procesar diferentes tipos de eventos
    switch (eventType) {
      case 'message':
      case 'new_message':
        // Procesar mensaje recibido
        logger.debug('Procesando evento de mensaje', { body });
        break;
      
      case 'status':
      case 'status_update':
        // Procesar actualización de estado
        logger.debug('Procesando evento de estado', { body });
        break;
      
      case 'delivery':
      case 'message_delivery':
        // Procesar confirmación de entrega
        logger.debug('Procesando evento de entrega', { body });
        break;
      
      default:
        logger.debug('Evento desconocido recibido', { eventType, body });
    }

    // Responder con éxito
    return sendJSON(res, 200, {
      success: true,
      message: 'Webhook recibido correctamente',
      eventType,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('Error procesando webhook', {
      error: error.message,
      stack: error.stack
    });

    return sendJSON(res, 500, {
      success: false,
      error: error.message || 'Error procesando webhook'
    });
  }
};

export const webhookHandler = asyncHandler(handler);
