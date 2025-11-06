import { Bot } from './bot.interface';
import { sendJSON, asyncHandler } from '../utils/response';
import { logger } from '../utils/logger';
import { getUserByID } from '../services/getUserByID';
import { FRONTEND_CONFIG, IS_DEVELOPMENT } from '../config/config';

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
    // Obtener el número real del jefe (o usar número de prueba en desarrollo)
    let managerPhone = '59161105926'; // Fallback para desarrollo
    if (IS_DEVELOPMENT) {
      // En desarrollo, usar siempre el número de prueba
      managerPhone = '59161105926';
      logger.info('📱 MODO DESARROLLO: Usando número de prueba para jefe', {
        manager_id: payload.manager_id,
        phone: managerPhone
      });
    } else {
      // En producción, obtener el número real del jefe
      try {
        const managerData = await getUserByID(payload.manager_id);
        if (Array.isArray(managerData) && managerData.length > 0) {
          const manager = managerData.find((item: any) => item.data?.empID === payload.manager_id);
          if (manager?.data?.phone) {
            // Asegurar que el número tenga el prefijo 591
            const phoneNumber = manager.data.phone;
            managerPhone = phoneNumber.startsWith('591') ? phoneNumber : `591${phoneNumber}`;
            logger.info('✅ Número del jefe obtenido de API', {
              manager_id: payload.manager_id,
              phone: managerPhone
            });
          }
        }
      } catch (error: any) {
        logger.warn('No se pudo obtener el número del jefe, usando fallback', {
          manager_id: payload.manager_id,
          error: error.message
        });
      }
    }

    // Verificar que el bot esté disponible antes de enviar mensajes
    if (!bot) {
      logger.warn('⚠️ Bot no disponible, no se puede enviar notificación de WhatsApp');
    } else {
      try {
      // Obtener el nombre del empleado
      let nombreEmpleado = payload.emp_id; // Fallback al ID si no se puede obtener el nombre
      try {
        const userData = await getUserByID(payload.emp_id);
        // La API devuelve un array, buscar el empleado con el empID correcto
        if (Array.isArray(userData) && userData.length > 0) {
          const empleado = userData.find((item: any) => item.data?.empID === payload.emp_id);
          if (empleado?.data?.fullName) {
            nombreEmpleado = empleado.data.fullName;
            logger.info('Nombre del empleado obtenido', {
              emp_id: payload.emp_id,
              nombre: nombreEmpleado
            });
          }
        }
      } catch (error: any) {
        logger.warn('No se pudo obtener el nombre del empleado, usando ID', {
          emp_id: payload.emp_id,
          error: error.message
        });
      }

      // Obtener el teléfono del manager para codificarlo en base64
      let managerPhoneBase64 = Buffer.from(payload.manager_id).toString('base64'); // Fallback al manager_id
      try {
        const managerData = await getUserByID(payload.manager_id);
        // La API devuelve un array, buscar el manager con el empID correcto
        if (Array.isArray(managerData) && managerData.length > 0) {
          const manager = managerData.find((item: any) => item.data?.empID === payload.manager_id);
          if (manager?.data?.phone) {
            // Codificar el teléfono del manager en base64
            managerPhoneBase64 = Buffer.from(manager.data.phone).toString('base64');
            logger.info('Teléfono del manager obtenido y codificado', {
              manager_id: payload.manager_id,
              phone: manager.data.phone,
              encoded: managerPhoneBase64
            });
          }
        }
      } catch (error: any) {
        logger.warn('No se pudo obtener el teléfono del manager, usando manager_id', {
          manager_id: payload.manager_id,
          error: error.message
        });
      }

      // Formatear las fechas solicitadas
      const fechasTexto = payload.detalle
        .map((d, idx) => `${idx + 1}. ${d.fecha} - ${d.tipo_dia || 'Día completo'}`)
        .join('\n');

      // Crear enlace directo a la pestaña de aprobación
      // El teléfono del manager se codifica en base64 para el parámetro 'data'
      // El frontend usa 'data' para consultar solicitudes pendientes del jefe
      const enlaceAprobacion = `${FRONTEND_CONFIG.BASE_URL}${FRONTEND_CONFIG.VACATION_REQUEST}?data=${managerPhoneBase64}&tab=aprobar`;

      const mensajeJefe = `🔔 *TU SUBORDINADO ESTÁ SOLICITANDO VACACIONES*

👤 *Empleado:* ${nombreEmpleado}
📅 *Tipo:* ${payload.tipo}
📆 *Días solicitados:* ${payload.detalle.length}

*Fechas:*
${fechasTexto}

💬 *Comentario:* ${payload.comentario || 'Sin comentario'}

👥 *Reemplazantes:* ${payload.reemplazantes?.map(r => r.nombre).join(', ') || 'No especificado'}

✅ *APROBAR DESDE AQUÍ:*
${enlaceAprobacion}`;

      await bot.sendMessage(managerPhone, mensajeJefe, {});
      logger.info('✅ Notificación de solicitud enviada al jefe con enlace', {
        manager_phone: managerPhone,
        solicitud_id: solicitudId,
        enlace: enlaceAprobacion,
        empleado_nombre: nombreEmpleado
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
