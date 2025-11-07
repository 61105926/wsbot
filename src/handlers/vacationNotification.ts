import { Bot } from './bot.interface';
import { sendJSON, asyncHandler } from '../utils/response';
import { logger } from '../utils/logger';
import { getUserByID } from '../services/getUserByID';
import { IS_DEVELOPMENT } from '../config/config';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

interface Reemplazante {
  emp_id: string;
  nombre: string;
  telefono?: string;
}

interface NotificationPayload {
  id_solicitud: string;
  emp_id: string;
  emp_nombre?: string;
  estado: 'APROBADO' | 'RECHAZADO' | 'PREAPROBADO';
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

    logger.info('Procesando notificación', {
      id_solicitud: payload.id_solicitud,
      estado: payload.estado,
      reemplazantes: payload.reemplazantes?.length || 0
    });

    // 🔔 SI ES APROBADO → NOTIFICAR AL EMPLEADO Y A LOS REEMPLAZANTES
    if (payload.estado === 'APROBADO') {

      // Obtener el número de teléfono real del empleado
      let empPhone = '59177711124'; // Fallback para demo
      try {
        const empData = await getUserByID(payload.emp_id);
        if (Array.isArray(empData) && empData.length > 0) {
          const empleado = empData.find((item: any) => item.data?.empID === payload.emp_id);
          if (empleado?.data?.phone) {
            // Asegurar que el número tenga el prefijo 591
            const phoneNumber = empleado.data.phone;
            empPhone = phoneNumber.startsWith('591') ? phoneNumber : `591${phoneNumber}`;
            logger.info('✅ Número del empleado obtenido', {
              emp_id: payload.emp_id,
              phone_original: phoneNumber,
              phone_formatted: empPhone
            });
          }
        }
      } catch (error: any) {
        logger.warn('No se pudo obtener el número del empleado, usando fallback', {
          emp_id: payload.emp_id,
          error: error.message
        });
      }

      // 1. Notificar al EMPLEADO que su solicitud fue aprobada
      try {
        const fechasTexto = payload.fechas?.join('\n• ') || 'Ver sistema';

        const mensajeEmpleado = `✅ *TU SOLICITUD DE VACACIONES FUE APROBADA*

👤 *Empleado:* ${payload.emp_nombre || 'Tú'}
📅 *Tipo:* ${payload.tipo || 'Vacaciones'}
📆 *Días aprobados:* ${payload.dias_solicitados || 'N/A'}

*Fechas aprobadas:*
• ${fechasTexto}

✅ *Estado:* APROBADO

${payload.comentario ? `💬 *Comentario del jefe:*\n${payload.comentario}` : ''}

🎉 *¡Disfruta tus vacaciones!*

📱 Cualquier duda, contacta con tu supervisor`;

        await bot.sendMessage(empPhone, mensajeEmpleado, {});

        logger.info('✅ Notificación de aprobación enviada al empleado', {
          emp_id: payload.emp_id,
          emp_phone: empPhone,
          solicitud_id: payload.id_solicitud
        });

        // 📄 GENERAR Y ENVIAR BOLETA DE VACACIÓN
        try {
          logger.info('📄 Generando boleta de vacación', {
            emp_id: payload.emp_id,
            solicitud_id: payload.id_solicitud
          });

          // Obtener datos completos del empleado
          let employeeData: any = null;
          try {
            const empData = await getUserByID(payload.emp_id);
            if (Array.isArray(empData) && empData.length > 0) {
              employeeData = empData.find((item: any) => item.data?.empID === payload.emp_id)?.data;
            }
          } catch (err: any) {
            logger.warn('No se pudieron obtener datos completos del empleado', {
              emp_id: payload.emp_id,
              error: err.message
            });
          }

          // Obtener datos de la solicitud desde la API
          let solicitudData: any = null;
          try {
            const solicitudResponse = await axios.get(`http://190.171.225.68/api/vacacion-data-empleado?emp_id=${payload.emp_id}`);
            if (solicitudResponse.data?.success && Array.isArray(solicitudResponse.data.data)) {
              solicitudData = solicitudResponse.data.data.find((s: any) => String(s.id_solicitud) === String(payload.id_solicitud));
            }
          } catch (err: any) {
            logger.warn('No se pudieron obtener datos completos de la solicitud', {
              solicitud_id: payload.id_solicitud,
              error: err.message
            });
          }

          // Validar y formatear FechaIngreso
          let fechaIngreso = employeeData?.fecha_ingreso || employeeData?.FechaIngreso || employeeData?.fecha_ingreso_empleado;
          if (!fechaIngreso || fechaIngreso === 'N/A' || fechaIngreso === '') {
            // Si no hay fecha de ingreso, usar una fecha por defecto (1 año atrás desde hoy)
            const fechaDefault = new Date();
            fechaDefault.setFullYear(fechaDefault.getFullYear() - 1);
            fechaIngreso = fechaDefault.toISOString().split('T')[0];
            logger.warn('No se encontró fecha de ingreso, usando fecha por defecto', { fechaIngreso });
          } else {
            // Asegurar que la fecha esté en formato YYYY-MM-DD
            try {
              const fechaParsed = new Date(fechaIngreso);
              if (isNaN(fechaParsed.getTime())) {
                throw new Error('Fecha inválida');
              }
              fechaIngreso = fechaParsed.toISOString().split('T')[0];
              logger.info('Fecha de ingreso formateada', { fechaIngreso });
            } catch (e) {
              // Si no se puede parsear, usar fecha por defecto
              const fechaDefault = new Date();
              fechaDefault.setFullYear(fechaDefault.getFullYear() - 1);
              fechaIngreso = fechaDefault.toISOString().split('T')[0];
              logger.warn('Error al parsear fecha de ingreso, usando fecha por defecto', { fechaIngreso });
            }
          }

          // Construir payload para la boleta
          const boletaPayload: any = {
            Codigo: employeeData?.codigo || payload.emp_id,
            Empleado: payload.emp_nombre || employeeData?.fullName || `Empleado ${payload.emp_id}`,
            Cargo: employeeData?.cargo || 'N/A',
            Departamento: employeeData?.departamento || employeeData?.dept || 'N/A',
            FechaIngreso: fechaIngreso, // Ahora siempre será una fecha válida
            FechaSolicitud: solicitudData?.fecha_solicitud || new Date().toISOString().split('T')[0],
            Estado: 'Autorizado',
            Observaciones: payload.comentario || 'Vacación aprobada',
            detalle: []
          };

          // Agrupar fechas consecutivas en el detalle
          if (payload.fechas && payload.fechas.length > 0) {
            const fechasOrdenadas = [...payload.fechas].sort();
            let grupoInicio = fechasOrdenadas[0];
            let grupoFin = fechasOrdenadas[0];

            for (let i = 1; i < fechasOrdenadas.length; i++) {
              const fechaActual = new Date(fechasOrdenadas[i]);
              const fechaAnterior = new Date(fechasOrdenadas[i - 1]);
              const diferenciaDias = (fechaActual.getTime() - fechaAnterior.getTime()) / (1000 * 60 * 60 * 24);

              if (diferenciaDias === 1) {
                // Fecha consecutiva, extender el grupo
                grupoFin = fechasOrdenadas[i];
              } else {
                // Nueva secuencia, guardar el grupo anterior
                const dias = (new Date(grupoFin).getTime() - new Date(grupoInicio).getTime()) / (1000 * 60 * 60 * 24) + 1;
                boletaPayload.detalle.push({
                  Desde: grupoInicio,
                  Hasta: grupoFin,
                  Dias: dias,
                  Tipo: payload.tipo === 'PROGRAMADA' ? 'Vacación' : payload.tipo || 'Vacación'
                });
                grupoInicio = fechasOrdenadas[i];
                grupoFin = fechasOrdenadas[i];
              }
            }

            // Agregar el último grupo
            const dias = (new Date(grupoFin).getTime() - new Date(grupoInicio).getTime()) / (1000 * 60 * 60 * 24) + 1;
            boletaPayload.detalle.push({
              Desde: grupoInicio,
              Hasta: grupoFin,
              Dias: dias,
              Tipo: payload.tipo === 'PROGRAMADA' ? 'Vacación' : payload.tipo || 'Vacación'
            });
          }

          logger.info('📄 Payload de boleta construido', {
            codigo: boletaPayload.Codigo,
            empleado: boletaPayload.Empleado,
            detalle_count: boletaPayload.detalle.length
          });

          // Generar PDF usando GET (la API solo acepta GET)
          const pdfUrl = 'http://190.171.225.68/api/vacacion';
          const fileName = `Boleta_Vacacion_${payload.id_solicitud}.pdf`;
          const pdfPath = path.join(__dirname, '../../tmp', fileName);

          // Crear directorio tmp si no existe
          const tmpDir = path.dirname(pdfPath);
          if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
          }

          // Construir URL con parámetros de consulta
          const queryParams = [
            `Codigo=${encodeURIComponent(boletaPayload.Codigo)}`,
            `Empleado=${encodeURIComponent(boletaPayload.Empleado)}`,
            `Cargo=${encodeURIComponent(boletaPayload.Cargo)}`,
            `Departamento=${encodeURIComponent(boletaPayload.Departamento)}`,
            `FechaIngreso=${encodeURIComponent(boletaPayload.FechaIngreso)}`,
            `FechaSolicitud=${encodeURIComponent(boletaPayload.FechaSolicitud)}`,
            `Estado=${encodeURIComponent(boletaPayload.Estado)}`,
            `Observaciones=${encodeURIComponent(boletaPayload.Observaciones)}`,
            `detalle=${encodeURIComponent(JSON.stringify(boletaPayload.detalle))}`
          ].join('&');

          const urlWithParams = `${pdfUrl}?${queryParams}`;

          // Generar PDF con GET
          const pdfResponse = await axios({
            method: 'GET',
            url: urlWithParams,
            responseType: 'stream',
            timeout: 30000 // 30 segundos
          });

          const writer = fs.createWriteStream(pdfPath);
          pdfResponse.data.pipe(writer);

          await new Promise<void>((resolve, reject) => {
            writer.on('finish', () => resolve());
            writer.on('error', reject);
          });

          // Enviar el PDF como documento
          await bot.sendMessage(empPhone, '📄 *Boleta de vacación aprobada*\n\nTu solicitud de vacaciones ha sido autorizada. Adjunto encontrarás la boleta oficial.', { 
            media: pdfPath 
          });

          logger.info('✅ Boleta de vacación enviada exitosamente', {
            emp_id: payload.emp_id,
            solicitud_id: payload.id_solicitud,
            fileName
          });

          // Eliminar archivo temporal
          try {
            if (fs.existsSync(pdfPath)) {
              fs.unlinkSync(pdfPath);
              logger.debug(`Archivo temporal eliminado: ${fileName}`);
            }
          } catch (e) {
            logger.warn(`No se pudo eliminar archivo temporal: ${fileName}`, e);
          }

        } catch (pdfError: any) {
          logger.error('❌ Error al generar/enviar boleta de vacación', {
            error: pdfError.message,
            emp_id: payload.emp_id,
            solicitud_id: payload.id_solicitud
          });
          // No fallar la operación si la boleta no se puede enviar
        }

        // Esperar 3 segundos antes de enviar a reemplazantes
        await new Promise(resolve => setTimeout(resolve, 3000));

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

📅 *Tipo:* ${payload.tipo || 'Vacaciones'}
📆 *Días:* ${payload.dias_solicitados || 'N/A'}

*Fechas:*
• ${fechasTexto}

✅ *Estado:* APROBADO

💼 *Tu rol:*
Serás el reemplazante durante este período. Por favor coordina con tu equipo y supervisor.



📱 *Cualquier duda, contacta con tu supervisor*`;

            // Usar el número de teléfono del reemplazante (o número de prueba en desarrollo)
            let reemplazantePhone = '59161105926'; // Fallback para desarrollo
            
            if (IS_DEVELOPMENT) {
              // En desarrollo, usar siempre el número de prueba
              reemplazantePhone = '59161105926';
              logger.info('📱 MODO DESARROLLO: Usando número de prueba para reemplazante', {
                reemplazante_id: reemplazante.emp_id,
                reemplazante_nombre: reemplazante.nombre,
                phone: reemplazantePhone
              });
            } else {
              // En producción, obtener el número real del reemplazante
              // 1. Primero intentar usar el número que viene en el payload
              if (reemplazante.telefono) {
                const phoneNumber = reemplazante.telefono;
                // Formatear el número correctamente
                if (phoneNumber.startsWith('591')) {
                  reemplazantePhone = phoneNumber;
                } else if (phoneNumber.startsWith('+591')) {
                  reemplazantePhone = phoneNumber.substring(1); // Quitar el +
                } else {
                  reemplazantePhone = `591${phoneNumber}`;
                }
                logger.info('✅ Usando número del reemplazante del payload', {
                  reemplazante_id: reemplazante.emp_id,
                  reemplazante_nombre: reemplazante.nombre,
                  phone_original: phoneNumber,
                  phone_formatted: reemplazantePhone
                });
              } else {
                // 2. Si no hay número en el payload, obtener de la API
                try {
                  const reemplazanteData = await getUserByID(reemplazante.emp_id);
                  if (Array.isArray(reemplazanteData) && reemplazanteData.length > 0) {
                    const reemplazanteUser = reemplazanteData.find((item: any) => item.data?.empID === reemplazante.emp_id);
                    if (reemplazanteUser?.data?.phone) {
                      // Asegurar que el número tenga el prefijo 591
                      const phoneNumber = reemplazanteUser.data.phone;
                      reemplazantePhone = phoneNumber.startsWith('591') ? phoneNumber : `591${phoneNumber}`;
                      logger.info('✅ Número del reemplazante obtenido de API', {
                        reemplazante_id: reemplazante.emp_id,
                        phone_original: phoneNumber,
                        phone_formatted: reemplazantePhone
                      });
                    }
                  }
                } catch (error: any) {
                  logger.warn('No se pudo obtener el número del reemplazante, usando fallback', {
                    reemplazante_id: reemplazante.emp_id,
                    error: error.message
                  });
                }
              }
            }

            // Enviar al número real del reemplazante
            await bot.sendMessage(reemplazantePhone, mensajeReemplazante, {});

            logger.info('✅ Notificación enviada a reemplazante', {
              reemplazante: reemplazante.nombre,
              reemplazante_phone: reemplazantePhone,
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

    // 🔔 SI ES PREAPROBADO → NOTIFICAR AL EMPLEADO
    // La notificación se envía cuando todas las fechas están preaprobadas
    if (payload.estado === 'PREAPROBADO') {
      try {
        // Obtener el número de teléfono real del empleado
        let empPhone = '59177711124'; // Fallback para demo
        if (IS_DEVELOPMENT) {
          empPhone = '59161105926';
        } else {
          try {
            const empData = await getUserByID(payload.emp_id);
            if (Array.isArray(empData) && empData.length > 0) {
              const empleado = empData.find((item: any) => item.data?.empID === payload.emp_id);
              if (empleado?.data?.phone) {
                const phoneNumber = empleado.data.phone;
                empPhone = phoneNumber.startsWith('591') ? phoneNumber : `591${phoneNumber}`;
                logger.info('✅ Número del empleado obtenido para preaprobación', {
                  emp_id: payload.emp_id,
                  phone_original: phoneNumber,
                  phone_formatted: empPhone
                });
              }
            }
          } catch (error: any) {
            logger.warn('No se pudo obtener el número del empleado, usando fallback', {
              emp_id: payload.emp_id,
              error: error.message
            });
          }
        }

        const fechasTexto = payload.fechas?.join('\n• ') || 'Ver sistema';

        const mensajePreaprobacion = `✅ *TUS VACACIONES FUERON PREAPROBADAS*

👤 *Empleado:* ${payload.emp_nombre || 'Tú'}
📅 *Tipo:* ${payload.tipo || 'Vacaciones'}
📆 *Días preaprobados:* ${payload.dias_solicitados || 'N/A'}

*Fechas preaprobadas:*
• ${fechasTexto}

✅ *Estado:* PREAPROBADO / REVISADO

💬 *Comentario del jefe:*
${payload.comentario || 'Todas tus fechas han sido revisadas y preaprobadas.'}

📋 *Próximos pasos:*
Tu solicitud está preaprobada. Recibirás una notificación cuando se complete el proceso de aprobación final.

📱 *Cualquier duda, contacta con tu supervisor*`;

        await bot.sendMessage(empPhone, mensajePreaprobacion, {});

        logger.info('✅ Notificación de preaprobación enviada al empleado', {
          emp_id: payload.emp_id,
          emp_phone: empPhone,
          solicitud_id: payload.id_solicitud
        });

      } catch (whatsappError: any) {
        logger.error('❌ Error al enviar notificación de preaprobación', {
          error: whatsappError.message,
          emp_id: payload.emp_id
        });
      }
    }

    // 🔔 SI ES RECHAZADO → NOTIFICAR AL EMPLEADO
    if (payload.estado === 'RECHAZADO') {
      try {
        const mensajeRechazo = `❌ *SOLICITUD DE VACACIONES RECHAZADA*

📅 *Tipo:* ${payload.tipo || 'Vacaciones'}
📆 *Días solicitados:* ${payload.dias_solicitados || 'N/A'}

${payload.comentario ? `💬 *Motivo del rechazo:*\n${payload.comentario}` : ''}

📱 *Por favor contacta con tu supervisor para más detalles*`;

        // Obtener el número de teléfono real del empleado para rechazo
        let empPhoneRechazo = '59177711124'; // Fallback para demo
        try {
          const empDataRechazo = await getUserByID(payload.emp_id);
          if (Array.isArray(empDataRechazo) && empDataRechazo.length > 0) {
            const empleadoRechazo = empDataRechazo.find((item: any) => item.data?.empID === payload.emp_id);
            if (empleadoRechazo?.data?.phone) {
              // Asegurar que el número tenga el prefijo 591
              const phoneNumber = empleadoRechazo.data.phone;
              empPhoneRechazo = phoneNumber.startsWith('591') ? phoneNumber : `591${phoneNumber}`;
              logger.info('✅ Número del empleado obtenido para rechazo', {
                emp_id: payload.emp_id,
                phone_original: phoneNumber,
                phone_formatted: empPhoneRechazo
              });
            }
          }
        } catch (error: any) {
          logger.warn('No se pudo obtener el número del empleado para rechazo, usando fallback', {
            emp_id: payload.emp_id,
            error: error.message
          });
        }

        await bot.sendMessage(empPhoneRechazo, mensajeRechazo, {});

        logger.info('✅ Notificación de rechazo enviada', {
          emp_id: payload.emp_id,
          emp_phone: empPhoneRechazo
        });

      } catch (whatsappError: any) {
        logger.error('❌ Error al enviar notificación de rechazo', {
          error: whatsappError.message
        });
      }
    }

    // Responder con éxito
    const notificacionesEnviadas = payload.estado === 'APROBADO' 
      ? (payload.reemplazantes?.length || 0) + 1 
      : payload.estado === 'PREAPROBADO' 
        ? 1  // Se envía notificación cuando todas las fechas están preaprobadas
        : payload.estado === 'RECHAZADO'
          ? 1
          : 0;

    sendJSON(res, 200, {
      status: 'success',
      message: 'Notificaciones enviadas',
      estado: payload.estado,
      notificaciones_enviadas: notificacionesEnviadas
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
