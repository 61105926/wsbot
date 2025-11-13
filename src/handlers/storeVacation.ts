import { Bot } from './bot.interface';
import { sendJSON, asyncHandler } from '../utils/response';
import { logger } from '../utils/logger';
import { getUserByID } from '../services/getUserByID';
import { FRONTEND_CONFIG, IS_DEVELOPMENT } from '../config/config';
import { connectionStatus } from '../services/connectionStatus';
import { vacationNotificationQueue } from '../services/vacationNotificationQueue';
import { getPhoneForEnvironment } from '../utils/phoneHelper';

interface VacationDetail {
  fecha: string;
  tipo_dia?: string;
  turno?: string; // El frontend envía 'turno' para vacaciones programadas
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
    logger.info('🚨🚨🚨 STORE-VACATION LLAMADO 🚨🚨🚨', {
      body: JSON.stringify(req.body),
      bot_disponible: !!bot,
      connection_status: connectionStatus.isConnected()
    });

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
    const tiposPermitidos = ['VACACION', 'A_CUENTA', 'FERIADO', 'PERMISO', 'PROGRAMADA'];
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
      tiene_reemplazantes: payload.reemplazantes?.length > 0,
      es_programada: payload.tipo === 'PROGRAMADA'
    });
    
    // Log específico para PROGRAMADA
    if (payload.tipo === 'PROGRAMADA') {
      logger.info('🔔 SOLICITUD PROGRAMADA RECIBIDA - Enviando notificación al manager', {
        solicitud_id: solicitudId,
        emp_id: payload.emp_id,
        manager_id: payload.manager_id,
        detalle: JSON.stringify(payload.detalle)
      });
    }

    // TODO: Aquí deberías guardar la solicitud en tu base de datos
    // Por ahora solo logeamos y devolvemos éxito
    logger.info('Datos de la solicitud:', {
      solicitud_id: solicitudId,
      payload: JSON.stringify(payload)
    });

    // 🔔 NOTIFICACIÓN AL JEFE POR WHATSAPP
    // Obtener el número real del jefe (o usar número de prueba en desarrollo)
    let managerPhoneReal: string | undefined;
    try {
      const managerData = await getUserByID(payload.manager_id);
      if (Array.isArray(managerData) && managerData.length > 0) {
        const manager = managerData.find((item: any) => item.data?.empID === payload.manager_id);
        if (manager?.data?.phone) {
          managerPhoneReal = manager.data.phone.startsWith('591') ? manager.data.phone : `591${manager.data.phone}`;
        }
      }
    } catch (error: any) {
      logger.warn('No se pudo obtener el teléfono del manager, se usará número de desarrollo', {
        manager_id: payload.manager_id,
        error: error.message
      });
    }
    
    const managerPhone = getPhoneForEnvironment(managerPhoneReal);
    logger.info('📱 Enviando notificación al jefe', {
      manager_id: payload.manager_id,
      phone: managerPhone,
      phone_real: managerPhoneReal,
      is_development: IS_DEVELOPMENT,
      tipo: payload.tipo,
      es_programada: payload.tipo === 'PROGRAMADA',
      solicitud_id: solicitudId
    });

    // Verificar que el bot esté disponible y conectado antes de enviar mensajes
    logger.info('🔍 Verificando estado del bot para enviar notificación', {
      bot_disponible: !!bot,
      connection_status: connectionStatus.isConnected(),
      manager_phone: managerPhone,
      tipo: payload.tipo,
      solicitud_id: solicitudId
    });

    if (!bot) {
      logger.warn('⚠️ Bot no disponible, no se puede enviar notificación de WhatsApp', {
        manager_phone: managerPhone,
        tipo: payload.tipo,
        solicitud_id: solicitudId,
        accion: 'NO SE ENVIARÁ NOTIFICACIÓN - Bot no disponible'
      });
    } else if (!connectionStatus.isConnected()) {
      logger.error('❌ Bot de WhatsApp no está conectado, no se puede enviar notificación', {
        manager_phone: managerPhone,
        tipo: payload.tipo,
        solicitud_id: solicitudId,
        accion: 'NO SE ENVIARÁ NOTIFICACIÓN - Bot desconectado',
        accion_requerida: 'Reiniciar el bot de WhatsApp'
      });
      // Continuar con el proceso aunque no se pueda enviar la notificación
    } else {
      logger.info('✅ Bot disponible y conectado - SE ENVIARÁ NOTIFICACIÓN', {
        manager_phone: managerPhone,
        tipo: payload.tipo,
        solicitud_id: solicitudId
      });
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
      // El frontend puede enviar 'turno' o 'tipo_dia', usar el que esté disponible
      const fechasTexto = payload.detalle
        .map((d, idx) => {
          const tipoDia = d.turno || d.tipo_dia || 'Día completo';
          return `${idx + 1}. ${d.fecha} - ${tipoDia}`;
        })
        .join('\n');

      // Crear enlace directo a la pestaña de aprobación
      // El teléfono del manager se codifica en base64 para el parámetro 'data'
      // El frontend usa 'data' para consultar solicitudes pendientes del jefe
      const enlaceAprobacion = `${FRONTEND_CONFIG.BASE_URL}${FRONTEND_CONFIG.VACATION_REQUEST}?data=${managerPhoneBase64}&tab=aprobar`;

      // Mensaje diferente según el tipo de vacación
      let mensajeJefe: string;
      if (payload.tipo === 'PROGRAMADA') {
        mensajeJefe = `🔔 *${nombreEmpleado} PROGRAMÓ SU VACACIÓN*

👤 *Empleado:* ${nombreEmpleado}
📅 *Tipo:* Vacación Programada
📆 *Días solicitados:* ${payload.detalle.length}

*Fechas:*
${fechasTexto}

💬 *Comentario:* ${payload.comentario || 'Sin comentario'}

📋 *REVÍSALA AQUÍ:*
${enlaceAprobacion}`;
      } else {
        mensajeJefe = `🔔 *TU SUBORDINADO ESTÁ SOLICITANDO VACACIONES*

👤 *Empleado:* ${nombreEmpleado}
📅 *Tipo:* ${payload.tipo}
📆 *Días solicitados:* ${payload.detalle.length}

*Fechas:*
${fechasTexto}

💬 *Comentario:* ${payload.comentario || 'Sin comentario'}

👥 *Reemplazantes:* ${payload.reemplazantes?.map(r => r.nombre).join(', ') || 'No especificado'}

✅ *APROBAR DESDE AQUÍ:*
${enlaceAprobacion}`;
      }

      logger.info('📤 Intentando enviar mensaje al manager', {
        manager_phone: managerPhone,
        tipo: payload.tipo,
        mensaje_length: mensajeJefe.length,
        bot_disponible: !!bot,
        es_programada: payload.tipo === 'PROGRAMADA',
        connection_status: connectionStatus.isConnected()
      });

      // Log específico para PROGRAMADA antes de enviar
      if (payload.tipo === 'PROGRAMADA') {
        logger.info('🔔 ENVIANDO NOTIFICACIÓN PROGRAMADA', {
          manager_phone: managerPhone,
          empleado: nombreEmpleado,
          fechas: fechasTexto
        });
      }

      // Para vacaciones PROGRAMADAS, usar el sistema de agrupación
      // Para otros tipos, enviar inmediatamente
      if (payload.tipo === 'PROGRAMADA') {
        // Agregar a la cola de agrupación
        const fecha = payload.detalle[0].fecha;
        const turno = payload.detalle[0].turno || payload.detalle[0].tipo_dia || 'COMPLETO';
        
        // Normalizar el comentario para agrupar (usar solo el primer comentario o un comentario genérico)
        const comentarioNormalizado = payload.comentario?.includes('Vacación programada para') 
          ? 'Vacaciones programadas' 
          : (payload.comentario || 'Sin comentario');
        
        logger.info('📝 Agregando notificación PROGRAMADA a la cola de agrupación', {
          emp_id: payload.emp_id,
          fecha,
          turno,
          comentario_original: payload.comentario,
          comentario_normalizado: comentarioNormalizado
        });
        
        vacationNotificationQueue.addNotification(
          payload.emp_id,
          payload.manager_id,
          managerPhone,
          nombreEmpleado,
          fecha,
          turno,
          comentarioNormalizado,
          managerPhoneBase64,
          async (notification) => {
            // Función que se ejecuta cuando se envía la notificación consolidada
            try {
              if (!bot) {
                throw new Error('Bot no disponible');
              }
              
              if (!connectionStatus.isConnected()) {
                throw new Error('Bot de WhatsApp no está conectado');
              }

              // Formatear todas las fechas agrupadas
              const fechasTexto = notification.fechas
                .map((f, idx) => {
                  return `${idx + 1}. ${f.fecha} - ${f.turno}`;
                })
                .join('\n');

              const enlaceAprobacion = `${FRONTEND_CONFIG.BASE_URL}${FRONTEND_CONFIG.VACATION_REQUEST}?data=${notification.managerPhoneBase64}&tab=aprobar`;

              const mensajeConsolidado = `🔔 *${notification.nombreEmpleado} PROGRAMÓ SU VACACIÓN*

👤 *Empleado:* ${notification.nombreEmpleado}
📅 *Tipo:* Vacación Programada
📆 *Total de días solicitados:* ${notification.fechas.length}

*Fechas:*
${fechasTexto}

💬 *Comentario:* ${notification.comentario || 'Sin comentario'}

📋 *REVÍSALAS AQUÍ:*
${enlaceAprobacion}`;

              logger.info('📤 Enviando notificación consolidada al jefe', {
                manager_phone: notification.manager_phone,
                emp_id: notification.emp_id,
                total_fechas: notification.fechas.length,
                mensaje_length: mensajeConsolidado.length
              });

              await bot.sendMessage(notification.manager_phone, mensajeConsolidado, {});
              
              logger.info('✅ Notificación consolidada enviada al jefe', {
                manager_phone: notification.manager_phone,
                emp_id: notification.emp_id,
                total_fechas: notification.fechas.length
              });
            } catch (whatsappError: any) {
              const errorMessage = whatsappError.message || 'Error desconocido';
              const isConnectionError = errorMessage.includes('Connection Closed') || 
                                        errorMessage.includes('connection') || 
                                        errorMessage.includes('disconnected') ||
                                        errorMessage.includes('no está conectado');
              
              if (isConnectionError) {
                logger.error('❌ ERROR: Bot de WhatsApp desconectado - No se pudo enviar notificación consolidada', {
                  error: errorMessage,
                  manager_phone: notification.manager_phone,
                  emp_id: notification.emp_id
                });
                connectionStatus.setConnected(false);
              } else {
                logger.error('❌ Error al enviar notificación consolidada', {
                  error: errorMessage,
                  manager_phone: notification.manager_phone,
                  emp_id: notification.emp_id
                });
              }
            }
          }
        );

        logger.info('📝 Notificación PROGRAMADA agregada a la cola de agrupación', {
          emp_id: payload.emp_id,
          fecha,
          esperando_agrupacion: true
        });
      } else {
        // Para otros tipos, enviar inmediatamente (comportamiento anterior)
        const enviarNotificacion = async () => {
          try {
            logger.info('📤 Enviando notificación al jefe INMEDIATAMENTE', {
              manager_phone: managerPhone,
              solicitud_id: solicitudId,
              tipo: payload.tipo,
              es_programada: payload.tipo === 'PROGRAMADA',
              bot_disponible: !!bot,
              connection_status: connectionStatus.isConnected(),
              mensaje_length: mensajeJefe.length
            });
            
            if (!bot) {
              throw new Error('Bot no disponible');
            }
            
            if (!connectionStatus.isConnected()) {
              throw new Error('Bot de WhatsApp no está conectado');
            }
            
            await bot.sendMessage(managerPhone, mensajeJefe, {});
            
            logger.info('✅ Notificación de solicitud enviada al jefe con enlace', {
              manager_phone: managerPhone,
              solicitud_id: solicitudId,
              enlace: enlaceAprobacion,
              empleado_nombre: nombreEmpleado,
              tipo: payload.tipo,
              es_programada: payload.tipo === 'PROGRAMADA'
            });
          } catch (whatsappError: any) {
            const errorMessage = whatsappError.message || 'Error desconocido';
            const isConnectionError = errorMessage.includes('Connection Closed') || 
                                      errorMessage.includes('connection') || 
                                      errorMessage.includes('disconnected') ||
                                      errorMessage.includes('no está conectado');
            
            if (isConnectionError) {
              logger.error('❌ ERROR: Bot de WhatsApp desconectado - No se pudo enviar notificación', {
                error: errorMessage,
                manager_phone: managerPhone,
                tipo: payload.tipo,
                solicitud_id: solicitudId,
                accion_requerida: 'Reiniciar el bot de WhatsApp para restaurar la conexión'
              });
              connectionStatus.setConnected(false);
            } else {
              logger.error('❌ Error al enviar notificación de WhatsApp al jefe', {
                error: errorMessage,
                error_stack: whatsappError.stack,
                manager_phone: managerPhone,
                tipo: payload.tipo,
                solicitud_id: solicitudId
              });
            }
          }
        };
        
        enviarNotificacion().catch(err => {
          logger.error('❌ Error crítico al ejecutar envío de notificación', {
            error: err.message,
            manager_phone: managerPhone,
            solicitud_id: solicitudId
          });
        });
      }
      
      // Log inmediato para indicar que se inició el envío
      logger.info('📤 Notificación de solicitud iniciada (enviando en segundo plano)', {
        manager_phone: managerPhone,
        solicitud_id: solicitudId,
        tipo: payload.tipo,
        es_programada: payload.tipo === 'PROGRAMADA',
        estado: 'ENVIANDO...'
      });
      } catch (whatsappError: any) {
        // Este catch solo debería ejecutarse si hay un error antes de setImmediate
        logger.error('❌ Error al preparar notificación de WhatsApp', {
          error: whatsappError.message,
          manager_phone: managerPhone,
          tipo: payload.tipo,
          solicitud_id: solicitudId
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
