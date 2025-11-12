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
    logger.http('POST /api/vacation-notification - Petición recibida');
    logger.info('📥 Petición recibida en /api/vacation-notification', {
      headers: req.headers,
      body_received: req.body ? 'Sí' : 'No',
      body_type: typeof req.body
    });

    const payload: NotificationPayload = req.body;
    
    logger.info('📦 Payload recibido:', {
      id_solicitud: payload?.id_solicitud,
      emp_id: payload?.emp_id,
      estado: payload?.estado,
      tipo: payload?.tipo,
      tiene_fechas: payload?.fechas ? payload.fechas.length : 0,
      tiene_reemplazantes: payload?.reemplazantes ? payload.reemplazantes.length : 0,
      payload_completo: JSON.stringify(payload, null, 2)
    });

    // Validar que el bot esté disponible
    if (!bot) {
      logger.error('❌ Bot no disponible para enviar notificaciones');
      return sendJSON(res, 503, {
        status: 'error',
        message: 'Bot de WhatsApp no disponible'
      });
    }

    // Validar campos requeridos
    if (!payload.id_solicitud || !payload.estado) {
      logger.warn('⚠️ Validación fallida en vacation-notification', { 
        payload,
        id_solicitud: payload?.id_solicitud,
        estado: payload?.estado
      });
      return sendJSON(res, 400, {
        status: 'error',
        message: 'Campos requeridos faltantes: id_solicitud, estado'
      });
    }

    logger.info('✅ Validación exitosa. Procesando notificación', {
      id_solicitud: payload.id_solicitud,
      estado: payload.estado,
      emp_id: payload.emp_id,
      emp_nombre: payload.emp_nombre,
      tipo: payload.tipo,
      dias_solicitados: payload.dias_solicitados,
      fechas_count: payload.fechas?.length || 0,
      reemplazantes: payload.reemplazantes?.length || 0
    });

    // 🔔 SI ES APROBADO → NOTIFICAR AL EMPLEADO Y A LOS REEMPLAZANTES
    if (payload.estado === 'APROBADO') {

      // MODO PRUEBA: Enviar todas las notificaciones al número de prueba
      const empPhone = '59161105926'; // Número de prueba
      logger.info('📱 MODO PRUEBA: Enviando notificación al número de prueba', {
        emp_id: payload.emp_id,
        phone: empPhone
      });

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

          // Construir payload para la boleta con valores por defecto para todos los campos
          const boletaPayload: any = {
            Codigo: employeeData?.codigo || employeeData?.empID || payload.emp_id || '00000',
            Empleado: payload.emp_nombre || employeeData?.fullName || employeeData?.nombre || `Empleado ${payload.emp_id}` || 'Empleado',
            Cargo: employeeData?.cargo || employeeData?.CARGO || 'Empleado',
            Departamento: employeeData?.departamento || employeeData?.dept || employeeData?.DEPT || employeeData?.regional || 'ADM',
            FechaIngreso: fechaIngreso, // Ya validado anteriormente, siempre será una fecha válida
            FechaSolicitud: solicitudData?.fecha_solicitud || payload.fechas?.[0]?.split(' (')[0] || new Date().toISOString().split('T')[0],
            Estado: 'Autorizado',
            Observaciones: payload.comentario || 'Vacación aprobada',
            detalle: []
          };
          
          logger.info('📋 Payload de boleta con valores por defecto', {
            Codigo: boletaPayload.Codigo,
            Empleado: boletaPayload.Empleado,
            Cargo: boletaPayload.Cargo,
            Departamento: boletaPayload.Departamento,
            FechaIngreso: boletaPayload.FechaIngreso,
            FechaSolicitud: boletaPayload.FechaSolicitud
          });

          // Agrupar fechas consecutivas en el detalle, considerando turnos (COMPLETO, MEDIO DÍA, etc.)
          if (payload.fechas && payload.fechas.length > 0) {
            // Parsear fechas con su turno: extraer fecha y turno de formato "YYYY-MM-DD (TURNO)"
            interface FechaConTurno {
              fecha: string;
              turno: string;
              dias: number; // 0.5 para medio día, 1 para completo
            }
            
            const fechasConTurno: FechaConTurno[] = payload.fechas.map((fechaStr: string) => {
              let fecha: string;
              let turno: string = 'COMPLETO';
              
              // Si la fecha viene como "YYYY-MM-DD (TURNO)", extraer ambas partes
              if (fechaStr.includes(' (')) {
                const partes = fechaStr.split(' (');
                fecha = partes[0];
                turno = partes[1].replace(')', '').trim();
              } else {
                fecha = fechaStr;
                turno = 'COMPLETO';
              }
              
              // Calcular días según el turno
              let dias = 1; // Por defecto día completo
              if (turno.toUpperCase().includes('MEDIO') || turno.toUpperCase().includes('MEDIA') || turno === '0.5') {
                dias = 0.5;
              }
              
              return { fecha, turno, dias };
            });
            
            // Ordenar por fecha
            fechasConTurno.sort((a, b) => a.fecha.localeCompare(b.fecha));
            
            // Agrupar fechas consecutivas con el mismo tipo de turno
            let grupoInicio = fechasConTurno[0];
            let grupoFin = fechasConTurno[0];
            let totalDiasGrupo = grupoInicio.dias;
            let esMedioDia = grupoInicio.dias === 0.5;

            for (let i = 1; i < fechasConTurno.length; i++) {
              const fechaActual = fechasConTurno[i];
              const fechaAnterior = fechasConTurno[i - 1];
              
              const fechaActualDate = new Date(fechaActual.fecha);
              const fechaAnteriorDate = new Date(fechaAnterior.fecha);
              const diferenciaDias = (fechaActualDate.getTime() - fechaAnteriorDate.getTime()) / (1000 * 60 * 60 * 24);
              
              // Verificar si es consecutiva y tiene el mismo tipo (ambas completas o ambas medio día)
              const mismaTipo = (fechaActual.dias === 0.5 && esMedioDia) || (fechaActual.dias === 1 && !esMedioDia);
              
              if (diferenciaDias === 1 && mismaTipo) {
                // Fecha consecutiva del mismo tipo, extender el grupo
                grupoFin = fechaActual;
                totalDiasGrupo += fechaActual.dias;
              } else {
                // Nueva secuencia o cambio de tipo, guardar el grupo anterior
                boletaPayload.detalle.push({
                  Desde: grupoInicio.fecha,
                  Hasta: grupoFin.fecha,
                  Dias: totalDiasGrupo,
                  Tipo: payload.tipo === 'PROGRAMADA' ? 'Vacación' : payload.tipo || 'Vacación'
                });
                
                // Iniciar nuevo grupo
                grupoInicio = fechaActual;
                grupoFin = fechaActual;
                totalDiasGrupo = fechaActual.dias;
                esMedioDia = fechaActual.dias === 0.5;
              }
            }

            // Agregar el último grupo
            boletaPayload.detalle.push({
              Desde: grupoInicio.fecha,
              Hasta: grupoFin.fecha,
              Dias: totalDiasGrupo,
              Tipo: payload.tipo === 'PROGRAMADA' ? 'Vacación' : payload.tipo || 'Vacación'
            });
          } else {
            // Si no hay fechas, crear un detalle por defecto con la fecha actual
            const fechaActual = new Date().toISOString().split('T')[0];
            logger.warn('⚠️ No hay fechas en el payload, usando fecha actual como detalle por defecto', {
              fecha_por_defecto: fechaActual
            });
            boletaPayload.detalle.push({
              Desde: fechaActual,
              Hasta: fechaActual,
              Dias: 1,
              Tipo: payload.tipo === 'PROGRAMADA' ? 'Vacación' : payload.tipo || 'Vacación'
            });
          }
          
          // Asegurar que el detalle no esté vacío
          if (boletaPayload.detalle.length === 0) {
            const fechaActual = new Date().toISOString().split('T')[0];
            logger.warn('⚠️ El detalle está vacío, agregando entrada por defecto', {
              fecha_por_defecto: fechaActual
            });
            boletaPayload.detalle.push({
              Desde: fechaActual,
              Hasta: fechaActual,
              Dias: 1,
              Tipo: 'Vacación'
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

          logger.info('📄 Llamando a API para generar PDF', {
            url: pdfUrl,
            url_length: urlWithParams.length,
            url_completa: urlWithParams.substring(0, 1000), // Mostrar más de la URL
            payload_detalle: JSON.stringify(boletaPayload.detalle),
            payload_completo: JSON.stringify(boletaPayload),
            detalle_count: boletaPayload.detalle.length
          });
          
          // Verificar si la URL es demasiado larga (algunos servidores tienen límites)
          if (urlWithParams.length > 2000) {
            logger.warn('⚠️ La URL es muy larga, puede causar problemas', {
              url_length: urlWithParams.length,
              detalle_count: boletaPayload.detalle.length
            });
          }

          // Generar PDF con GET
          let pdfResponse;
          try {
            pdfResponse = await axios({
              method: 'GET',
              url: urlWithParams,
              responseType: 'stream',
              timeout: 30000 // 30 segundos
            });

            logger.info('✅ Respuesta recibida de API de PDF', {
              status: pdfResponse.status,
              headers: pdfResponse.headers['content-type']
            });
          } catch (axiosError: any) {
            // Capturar el error completo de axios
            const errorDetails: any = {
              error: axiosError.message,
              status: axiosError.response?.status,
              statusText: axiosError.response?.statusText,
              url: urlWithParams.substring(0, 500)
            };
            
            // Intentar capturar el response data (puede ser string o objeto)
            if (axiosError.response?.data) {
              try {
                if (typeof axiosError.response.data === 'string') {
                  errorDetails.response_data = axiosError.response.data.substring(0, 500);
                } else {
                  errorDetails.response_data = JSON.stringify(axiosError.response.data).substring(0, 500);
                }
              } catch (e) {
                errorDetails.response_data = 'No se pudo serializar';
              }
            }
            
            // Agregar información del request
            errorDetails.request_url = pdfUrl;
            errorDetails.request_method = 'GET';
            
            logger.error('❌ Error en petición a API de PDF', errorDetails);
            
            // Lanzar error con más detalles
            const errorMessage = `Error al generar PDF: ${axiosError.message} (Status: ${axiosError.response?.status || 'N/A'})${axiosError.response?.data ? ` - ${typeof axiosError.response.data === 'string' ? axiosError.response.data : JSON.stringify(axiosError.response.data)}` : ''}`;
            throw new Error(errorMessage);
          }

          // Verificar que la respuesta sea un PDF
          const contentType = pdfResponse.headers['content-type'];
          if (contentType && !contentType.includes('pdf') && !contentType.includes('application/octet-stream')) {
            logger.warn('⚠️ La respuesta no parece ser un PDF', {
              content_type: contentType,
              status: pdfResponse.status
            });
          }

          const writer = fs.createWriteStream(pdfPath);
          pdfResponse.data.pipe(writer);

          await new Promise<void>((resolve, reject) => {
            writer.on('finish', () => {
              logger.info('✅ PDF guardado exitosamente', { pdfPath });
              resolve();
            });
            writer.on('error', (error) => {
              logger.error('❌ Error al escribir PDF', { error: error.message, pdfPath });
              reject(error);
            });
          });

          // Enviar el PDF como documento al empleado
          await bot.sendMessage(empPhone, '📄 *Boleta de vacación aprobada*\n\nTu solicitud de vacaciones ha sido autorizada. Adjunto encontrarás la boleta oficial.', { 
            media: pdfPath 
          });

          logger.info('✅ Boleta de vacación enviada exitosamente al empleado', {
            emp_id: payload.emp_id,
            solicitud_id: payload.id_solicitud,
            fileName
          });

          // 📄 ENVIAR BOLETA AL JEFE/MANAGER TAMBIÉN
          // MODO PRUEBA: Enviar al número de prueba
          const managerPhone = '59161105926'; // Número de prueba
          try {
            // Leer el archivo PDF nuevamente para enviarlo al manager
            const pdfBuffer = fs.readFileSync(pdfPath);
            const managerPdfPath = path.join(__dirname, '../../tmp', `Boleta_Manager_${payload.id_solicitud}.pdf`);
            
            // Crear una copia del PDF para el manager
            fs.writeFileSync(managerPdfPath, pdfBuffer);
            
            const mensajeJefe = `📄 *Boleta de Vacación - ${payload.emp_nombre || 'Empleado'}*\n\n` +
              `Has aprobado la solicitud de vacaciones.\n` +
              `Adjunto encontrarás la boleta oficial para imprimir.\n\n` +
              `👤 *Empleado:* ${payload.emp_nombre || 'N/A'}\n` +
              `📅 *Días:* ${payload.dias_solicitados || 'N/A'}\n` +
              `📆 *Tipo:* ${payload.tipo || 'Vacaciones'}`;

            await bot.sendMessage(managerPhone, mensajeJefe, { 
              media: managerPdfPath 
            });

            logger.info('✅ Boleta de vacación enviada exitosamente al jefe/manager', {
              manager_phone: managerPhone,
              solicitud_id: payload.id_solicitud,
              fileName: `Boleta_Manager_${payload.id_solicitud}.pdf`
            });

            // Eliminar archivo temporal del manager
            try {
              if (fs.existsSync(managerPdfPath)) {
                fs.unlinkSync(managerPdfPath);
                logger.debug(`Archivo temporal del manager eliminado: Boleta_Manager_${payload.id_solicitud}.pdf`);
              }
            } catch (e) {
              logger.warn(`No se pudo eliminar archivo temporal del manager: Boleta_Manager_${payload.id_solicitud}.pdf`, e);
            }
          } catch (managerError: any) {
            logger.error('❌ Error al enviar boleta al jefe/manager', {
              error: managerError.message,
              solicitud_id: payload.id_solicitud
            });
            // No fallar la operación si falla el envío al manager
          }

          // Eliminar archivo temporal del empleado
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
            stack: pdfError.stack,
            emp_id: payload.emp_id,
            solicitud_id: payload.id_solicitud,
            payload_fechas: payload.fechas,
            payload_completo: JSON.stringify(payload, null, 2)
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

            // MODO PRUEBA: Enviar todas las notificaciones al número de prueba
            const reemplazantePhone = '59161105926'; // Número de prueba
            logger.info('📱 MODO PRUEBA: Enviando notificación de reemplazante al número de prueba', {
              reemplazante_id: reemplazante.emp_id,
              reemplazante_nombre: reemplazante.nombre,
              phone: reemplazantePhone
            });

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
        // MODO PRUEBA: Enviar todas las notificaciones al número de prueba
        const empPhone = '59161105926'; // Número de prueba
        logger.info('📱 MODO PRUEBA: Enviando notificación de preaprobación al número de prueba', {
          emp_id: payload.emp_id,
          phone: empPhone
        });

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

        // MODO PRUEBA: Enviar todas las notificaciones al número de prueba
        const empPhoneRechazo = '59161105926'; // Número de prueba
        logger.info('📱 MODO PRUEBA: Enviando notificación de rechazo al número de prueba', {
          emp_id: payload.emp_id,
          phone: empPhoneRechazo
        });

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
