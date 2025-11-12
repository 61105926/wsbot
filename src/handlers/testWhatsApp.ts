import { Bot } from './bot.interface';
import { sendJSON, asyncHandler } from '../utils/response';
import { logger } from '../utils/logger';

export const testWhatsAppHandler = asyncHandler(async (bot: Bot, req: any, res: any) => {
  if (!bot) {
    return sendJSON(res, 500, { 
      status: 'error',
      message: 'Bot no está conectado' 
    });
  }

  const { phone } = req.body;
  
  if (!phone) {
    return sendJSON(res, 400, { 
      status: 'error',
      message: 'Número de teléfono requerido' 
    });
  }

  try {
    const mensajePrueba = `🧪 *MENSAJE DE PRUEBA*

Este es un mensaje de prueba para verificar la conexión de WhatsApp.

📱 Número probado: ${phone}
⏰ Hora: ${new Date().toLocaleString('es-BO')}

Si recibes este mensaje, la conexión está funcionando correctamente. ✅`;

    logger.info('📤 Enviando mensaje de prueba', { phone });
    
    await bot.sendMessage(phone, mensajePrueba, {});
    
    logger.info('✅ Mensaje de prueba enviado exitosamente', { phone });
    
    return sendJSON(res, 200, { 
      status: 'success',
      message: 'Mensaje de prueba enviado',
      phone: phone
    });
  } catch (error: any) {
    logger.error('❌ Error al enviar mensaje de prueba', {
      phone,
      error: error.message,
      stack: error.stack
    });
    
    return sendJSON(res, 500, { 
      status: 'error',
      message: 'Error al enviar mensaje',
      error: error.message
    });
  }
});

