import { Bot } from './bot.interface';
import { sendJSON, asyncHandler } from '../utils/response';
import { logger } from '../utils/logger';

interface VacationDetail {
  fecha: string;
  tipo_dia: string;
  horas?: number;
}

interface Reemplazante {
  id: string;
  nombre: string;
}

interface VacationPayload {
  emp_id: string;
  tipo: string;
  comentario: string;
  manager_id: string;
  antiguedad: string;
  detalle: VacationDetail[];
  reemplazantes: Reemplazante[];
}

/**
 * POST /api/store-vacation
 * Almacena una nueva solicitud de vacaciones
 */
const handleStoreVacation = async (bot: Bot, req: any, res: any) => {
  try {
    logger.http('POST /api/store-vacation - Almacenando solicitud de vacaciones');

    const payload: VacationPayload = req.body;

    // Validar campos requeridos
    if (!payload.emp_id || !payload.tipo || !payload.manager_id || !payload.detalle || payload.detalle.length === 0) {
      logger.warn('Validación fallida en store-vacation', { payload });
      return sendJSON(res, 400, {
        status: 'error',
        message: 'Campos requeridos faltantes: emp_id, tipo, manager_id, detalle'
      });
    }

    // Validar tipos de vacaciones permitidos
    const tiposPermitidos = ['VACACION', 'A_CUENTA', 'FERIADO', 'PERMISO'];
    if (!tiposPermitidos.includes(payload.tipo)) {
      logger.warn('Tipo de vacación inválido', { tipo: payload.tipo });
      return sendJSON(res, 400, {
        status: 'error',
        message: `Tipo de vacación inválido. Debe ser uno de: ${tiposPermitidos.join(', ')}`
      });
    }

    // Generar ID único para la solicitud
    const timestamp = Date.now();
    const solicitudId = `${payload.emp_id}-${timestamp}`;

    // Log de la solicitud recibida
    logger.info('Solicitud de vacaciones procesada', {
      solicitud_id: solicitudId,
      emp_id: payload.emp_id,
      tipo: payload.tipo,
      manager_id: payload.manager_id,
      dias_solicitados: payload.detalle.length,
      tiene_reemplazantes: payload.reemplazantes?.length > 0
    });

    // TODO: Aquí deberías guardar la solicitud en tu base de datos
    // Por ahora solo logeamos y devolvemos éxito
    logger.info('Datos de la solicitud:', {
      solicitud_id: solicitudId,
      payload: JSON.stringify(payload)
    });

    // 🔔 NOTIFICACIÓN AL JEFE POR WHATSAPP
    // En modo prueba: enviamos a 77711124
    // En producción: usar el teléfono del manager desde la DB
    const PHONE_PRUEBA = '59177711124'; // Modo prueba
    const managerPhone = PHONE_PRUEBA;

    // Verificar que el bot esté disponible antes de enviar mensajes
    if (!bot) {
      logger.warn('⚠️ Bot no disponible, no se puede enviar notificación de WhatsApp');
    } else {
      try {
      // Formatear las fechas solicitadas
      const fechasTexto = payload.detalle
        .map((d, idx) => `${idx + 1}. ${d.fecha} - ${d.tipo_dia || 'Día completo'}`)
        .join('\n');

      // Crear enlace directo a la pestaña de aprobación
      // El manager_id se codifica en base64 para crear el enlace único
      const managerIdBase64 = Buffer.from(payload.manager_id).toString('base64');
      const FRONTEND_URL = process.env.FRONTEND_URL || 'https://hrx.minoil.com.bo';
      const enlaceAprobacion = `${FRONTEND_URL}/#/vacaciones?emp=${managerIdBase64}&view=aprobar`;

      const mensajeJefe = `🔔 *TU SUBORDINADO ESTÁ SOLICITANDO VACACIONES*

👤 *Empleado:* ${payload.emp_id}
📅 *Tipo:* ${payload.tipo}
📆 *Días solicitados:* ${payload.detalle.length}

*Fechas:*
${fechasTexto}

💬 *Comentario:* ${payload.comentario || 'Sin comentario'}

👥 *Reemplazantes:* ${payload.reemplazantes?.map(r => r.nombre).join(', ') || 'No especificado'}

✅ *APROBAR DESDE AQUÍ:*
${enlaceAprobacion}

📋 *ID Solicitud:* ${solicitudId}`;

      await bot.sendMessage(managerPhone, mensajeJefe, {});
      logger.info('✅ Notificación de solicitud enviada al jefe con enlace', {
        manager_phone: managerPhone,
        solicitud_id: solicitudId,
        enlace: enlaceAprobacion
      });
      } catch (whatsappError: any) {
        logger.error('❌ Error al enviar notificación de WhatsApp al jefe', {
          error: whatsappError.message,
          manager_phone: managerPhone
        });
        // No fallar la solicitud por error de notificación
      }
    }

    // Responder con éxito
    sendJSON(res, 200, {
      status: 'success',
      message: 'Solicitud de vacaciones creada exitosamente',
      solicitud_id: solicitudId,
      data: {
        emp_id: payload.emp_id,
        tipo: payload.tipo,
        manager_id: payload.manager_id,
        antiguedad: payload.antiguedad,
        comentario: payload.comentario,
        dias_solicitados: payload.detalle.length,
        reemplazantes: payload.reemplazantes?.length || 0,
        fecha_creacion: new Date().toISOString()
      }
    });

  } catch (error: any) {
    logger.error('Error en POST /api/store-vacation', {
      error: error.message,
      stack: error.stack
    });

    sendJSON(res, 500, {
      status: 'error',
      message: 'Error al procesar la solicitud de vacaciones'
    });
  }
};

export const storeVacationHandler = asyncHandler(handleStoreVacation);
