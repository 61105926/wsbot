import { Bot } from './bot.interface';
import { sendJSON, asyncHandler } from '../utils/response';
import { logger } from '../utils/logger';

interface Reemplazante {
  emp_id: string;
  nombre: string;
  telefono?: string;
}

interface NotificationPayload {
  id_solicitud: string;
  emp_id: string;
  emp_nombre?: string;
  estado: 'APROBADO' | 'RECHAZADO';
  comentario?: string;
  tipo?: string;
  dias_solicitados?: number;
  fechas?: string[];
  reemplazantes?: Reemplazante[];
}

/**
 * POST /api/vacation-notification
 * Envía notificaciones de WhatsApp cuando se aprueba/rechaza una solicitud
 */
const handleVacationNotification = async (bot: Bot, req: any, res: any) => {
  try {
    logger.http('POST /api/vacation-notification - Enviando notificaciones');

    const payload: NotificationPayload = req.body;

    // Validar que el bot esté disponible
    if (!bot) {
      logger.error('Bot no disponible para enviar notificaciones');
      return sendJSON(res, 503, {
        status: 'error',
        message: 'Bot de WhatsApp no disponible'
      });
    }

    // Validar campos requeridos
    if (!payload.id_solicitud || !payload.estado) {
      logger.warn('Validación fallida en vacation-notification', { payload });
      return sendJSON(res, 400, {
        status: 'error',
        message: 'Campos requeridos faltantes: id_solicitud, estado'
      });
    }

    const PHONE_PRUEBA = '59177711124'; // Modo prueba - todos los mensajes van aquí

    logger.info('Procesando notificación', {
      id_solicitud: payload.id_solicitud,
      estado: payload.estado,
      reemplazantes: payload.reemplazantes?.length || 0
    });

    // 🔔 SI ES APROBADO → NOTIFICAR AL EMPLEADO Y A LOS REEMPLAZANTES
    if (payload.estado === 'APROBADO') {

      // 1. Notificar al EMPLEADO que su solicitud fue aprobada
      try {
        const fechasTexto = payload.fechas?.join('\n• ') || 'Ver sistema';

        const mensajeEmpleado = `✅ *TU SOLICITUD DE VACACIONES FUE APROBADA*

👤 *Empleado:* ${payload.emp_nombre || 'Tú'}
📋 *ID Solicitud:* ${payload.id_solicitud}
📅 *Tipo:* ${payload.tipo || 'Vacaciones'}
📆 *Días aprobados:* ${payload.dias_solicitados || 'N/A'}

*Fechas aprobadas:*
• ${fechasTexto}

✅ *Estado:* APROBADO

${payload.comentario ? `💬 *Comentario del jefe:*\n${payload.comentario}` : ''}

🎉 *¡Disfruta tus vacaciones!*

📱 Cualquier duda, contacta con tu supervisor`;

        await bot.sendMessage(PHONE_PRUEBA, mensajeEmpleado, {});

        logger.info('✅ Notificación de aprobación enviada al empleado', {
          emp_id: payload.emp_id,
          phone_prueba: PHONE_PRUEBA,
          solicitud_id: payload.id_solicitud
        });

        // Esperar 2 segundos antes de enviar a reemplazantes
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (whatsappError: any) {
        logger.error('❌ Error al enviar notificación al empleado', {
          error: whatsappError.message,
          emp_id: payload.emp_id
        });
      }

      // 2. Notificar a los REEMPLAZANTES
      if (payload.reemplazantes && payload.reemplazantes.length > 0) {
        for (const reemplazante of payload.reemplazantes) {
          try {
            const fechasTexto = payload.fechas?.join('\n• ') || 'Ver sistema';

            const mensajeReemplazante = `🔔 *NUEVA ASIGNACIÓN COMO REEMPLAZANTE*

👤 *${payload.emp_nombre || 'Empleado'}* estará de vacaciones

📋 *ID Solicitud:* ${payload.id_solicitud}
📅 *Tipo:* ${payload.tipo || 'Vacaciones'}
📆 *Días:* ${payload.dias_solicitados || 'N/A'}

*Fechas:*
• ${fechasTexto}

✅ *Estado:* APROBADO

💼 *Tu rol:*
Serás el reemplazante durante este período. Por favor coordina con tu equipo y supervisor.

${payload.comentario ? `💬 *Nota del jefe:* ${payload.comentario}` : ''}

📱 *Cualquier duda, contacta con tu supervisor*`;

            // En modo prueba: enviar a PHONE_PRUEBA
            // En producción: usar reemplazante.telefono (si está disponible)
            await bot.sendMessage(PHONE_PRUEBA, mensajeReemplazante, {});

            logger.info('✅ Notificación enviada a reemplazante', {
              reemplazante: reemplazante.nombre,
              phone_prueba: PHONE_PRUEBA,
              solicitud_id: payload.id_solicitud
            });

            // Esperar 2 segundos entre mensajes
            await new Promise(resolve => setTimeout(resolve, 2000));

          } catch (whatsappError: any) {
            logger.error('❌ Error al enviar notificación a reemplazante', {
              error: whatsappError.message,
              reemplazante: reemplazante.nombre
            });
            // Continuar con los demás
          }
        }
      }
    }

    // 🔔 SI ES RECHAZADO → NOTIFICAR AL EMPLEADO
    if (payload.estado === 'RECHAZADO') {
      try {
        const mensajeRechazo = `❌ *SOLICITUD DE VACACIONES RECHAZADA*

📋 *ID Solicitud:* ${payload.id_solicitud}
📅 *Tipo:* ${payload.tipo || 'Vacaciones'}
📆 *Días solicitados:* ${payload.dias_solicitados || 'N/A'}

${payload.comentario ? `💬 *Motivo del rechazo:*\n${payload.comentario}` : ''}

📱 *Por favor contacta con tu supervisor para más detalles*`;

        await bot.sendMessage(PHONE_PRUEBA, mensajeRechazo, {});

        logger.info('✅ Notificación de rechazo enviada', {
          emp_id: payload.emp_id,
          phone_prueba: PHONE_PRUEBA
        });

      } catch (whatsappError: any) {
        logger.error('❌ Error al enviar notificación de rechazo', {
          error: whatsappError.message
        });
      }
    }

    // Responder con éxito
    sendJSON(res, 200, {
      status: 'success',
      message: 'Notificaciones enviadas',
      estado: payload.estado,
      notificaciones_enviadas: payload.estado === 'APROBADO' ? payload.reemplazantes?.length || 0 : 1
    });

  } catch (error: any) {
    logger.error('Error en POST /api/vacation-notification', {
      error: error.message,
      stack: error.stack
    });

    sendJSON(res, 500, {
      status: 'error',
      message: 'Error al enviar notificaciones'
    });
  }
};

export const vacationNotificationHandler = asyncHandler(handleVacationNotification);
