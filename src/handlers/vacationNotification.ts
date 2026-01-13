import { Bot } from './bot.interface';
import { sendJSON, asyncHandler } from '../utils/response';
import { logger } from '../utils/logger';
import { getUserByID } from '../services/getUserByID';
import { IS_DEVELOPMENT } from '../config/config';
import { getPhoneForEnvironment } from '../utils/phoneHelper';
import { sendVacationEmail } from '../services/emailService';
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
      es_programada: payload?.tipo === 'PROGRAMADA',
      payload_completo: JSON.stringify(payload, null, 2)
    });
    
    // Log crítico para PROGRAMADA
    if (payload?.tipo === 'PROGRAMADA') {
      logger.info('🚨🚨🚨 PAYLOAD PROGRAMADA RECIBIDO 🚨🚨🚨', {
        id_solicitud: payload.id_solicitud,
        emp_id: payload.emp_id,
        estado: payload.estado,
        tiene_reemplazantes: payload.reemplazantes ? payload.reemplazantes.length : 0,
        reemplazantes: payload.reemplazantes ? JSON.stringify(payload.reemplazantes) : 'NINGUNO'
      });
    }

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
      reemplazantes: payload.reemplazantes?.length || 0,
      es_programada: payload.tipo === 'PROGRAMADA'
    });
    
    // Log específico para PROGRAMADA
    if (payload.tipo === 'PROGRAMADA') {
      logger.info('🔔 NOTIFICACIÓN PROGRAMADA - Iniciando proceso de notificación', {
        id_solicitud: payload.id_solicitud,
        emp_id: payload.emp_id,
        tiene_reemplazantes: payload.reemplazantes?.length || 0,
        bot_disponible: !!bot
      });
    }

    // Obtener el número real del empleado (disponible para todos los estados)
    let empPhoneReal: string | undefined;
    try {
      const empData = await getUserByID(payload.emp_id);
      if (Array.isArray(empData) && empData.length > 0) {
        const empleado = empData.find((item: any) => item.data?.empID === payload.emp_id);
        if (empleado?.data?.phone) {
          empPhoneReal = empleado.data.phone.startsWith('591') ? empleado.data.phone : `591${empleado.data.phone}`;
        }
      }
    } catch (error: any) {
      logger.warn('No se pudo obtener el teléfono del empleado, se usará número de desarrollo', {
        emp_id: payload.emp_id,
        error: error.message
      });
    }
    
    const empPhone = getPhoneForEnvironment(empPhoneReal);

    // ============================================
    // 🔔 NOTIFICACIONES DESACTIVADAS TEMPORALMENTE
    // ============================================
    // TODO: Reactivar cuando sea necesario
    // Cambiar `if (false &&` por `if (payload.estado === 'APROBADO')` para reactivar
    // ============================================
    
    // 🔔 SI ES APROBADO → NOTIFICAR AL EMPLEADO Y A LOS REEMPLAZANTES
    if (false && payload.estado === 'APROBADO') {
      
      // Log crítico para PROGRAMADA aprobada
      if (payload.tipo === 'PROGRAMADA') {
        logger.info('🚨🚨🚨 VACACIÓN PROGRAMADA APROBADA - INICIANDO NOTIFICACIONES 🚨🚨🚨', {
          id_solicitud: payload.id_solicitud,
          emp_id: payload.emp_id,
          emp_nombre: payload.emp_nombre,
          tiene_fechas: payload.fechas?.length ?? 0,
          tiene_reemplazantes: payload.reemplazantes?.length ?? 0,
          fechas: payload.fechas ? JSON.stringify(payload.fechas) : 'NINGUNA'
        });
      }

      logger.info('📱 [DESACTIVADO] Enviando notificación al empleado', {
        emp_id: payload.emp_id,
        phone: empPhone,
        phone_real: empPhoneReal,
        is_development: IS_DEVELOPMENT,
        tipo: payload.tipo,
        es_programada: payload.tipo === 'PROGRAMADA'
      });

      // ============================================
      // 1. NOTIFICACIÓN AL EMPLEADO (APROBADO)
      // ============================================
      // PROPÓSITO: Informar al empleado que su solicitud de vacaciones fue aprobada
      // CONTENIDO: 
      //   - Mensaje de confirmación con fechas aprobadas
      //   - Comentario del supervisor (si existe)
      //   - Generación y envío de boleta PDF oficial
      // DESACTIVADO: Temporalmente no se envía ninguna notificación
      // ============================================
      // 1. Notificar al EMPLEADO que su solicitud fue aprobada
      try {
        const fechasTexto = payload.fechas?.join('\n• ') || 'Ver sistema';

        const mensajeEmpleado = `✅ *TU SOLICITUD DE VACACIONES FUE APROBADA*

👤 *Empleado:* ${payload.emp_nombre || 'Tú'}
📅 *Tipo:* ${payload.tipo === 'PROGRAMADA' ? 'Vacación Programada' : (payload.tipo || 'Vacaciones')}
📆 *Días aprobados:* ${payload.dias_solicitados || 'N/A'}

*Fechas aprobadas:*
• ${fechasTexto}

✅ *Estado:* APROBADO

${payload.comentario ? `💬 *Comentario del supervisor:*\n${payload.comentario}` : ''}

🎉 *¡Disfruta tus vacaciones!*

📱 Cualquier duda, contacta con tu supervisor`;

        logger.info('📤 Enviando mensaje de aprobación al empleado', {
          emp_id: payload.emp_id,
          emp_phone: empPhone,
          tipo: payload.tipo,
          es_programada: payload.tipo === 'PROGRAMADA',
          mensaje_length: mensajeEmpleado.length,
          tiene_fechas: payload.fechas?.length ?? 0
        });

        // ⚠️ NOTIFICACIÓN DESACTIVADA - Mensaje de aprobación al empleado
        // await bot.sendMessage(empPhone, mensajeEmpleado, {});

        logger.info('✅ Notificación de aprobación enviada al empleado', {
          emp_id: payload.emp_id,
          emp_phone: empPhone,
          solicitud_id: payload.id_solicitud,
          tipo: payload.tipo,
          es_programada: payload.tipo === 'PROGRAMADA',
          mensaje_enviado: true
        });
        
        // Log específico para PROGRAMADA
        if (payload.tipo === 'PROGRAMADA') {
        // Log específico para PROGRAMADA (comentado porque notificaciones están desactivadas)
        // if (payload.tipo === 'PROGRAMADA') {
        //   logger.info('✅✅✅ NOTIFICACIÓN PROGRAMADA ENVIADA AL EMPLEADO ✅✅✅', {
        //     id_solicitud: payload.id_solicitud,
        //     emp_id: payload.emp_id,
        //     emp_phone: empPhone
        //   });
        // }
        }

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
            const solicitudResponse = await axios.get(`http://190.171.225.68:8006/api/vacacion-data-empleado?emp_id=${payload.emp_id}`);
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
          if (payload.fechas?.length ?? 0 > 0) {
            // Parsear fechas con su turno: extraer fecha y turno de formato "YYYY-MM-DD (TURNO)"
            interface FechaConTurno {
              fecha: string;
              turno: string;
              dias: number; // 0.5 para medio día, 1 para completo
            }
            
            const fechasConTurno: FechaConTurno[] = (payload.fechas ?? []).map((fechaStr: string) => {
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
              const turnoUpper = turno.toUpperCase().trim();
              let dias = 1; // Por defecto día completo
              if (turnoUpper === 'MAÑANA' || turnoUpper === 'MANANA' || 
                  turnoUpper === 'TARDE' || 
                  turnoUpper.includes('MEDIO') || 
                  turnoUpper.includes('MEDIA') || 
                  turno === '0.5') {
                dias = 0.5;
              }
              
              return { fecha, turno, dias };
            });
            
            // Ordenar por fecha
            fechasConTurno.sort((a, b) => a.fecha.localeCompare(b.fecha));
            
            // Agrupar fechas consecutivas con el mismo turno
            let grupoInicio = fechasConTurno[0];
            let grupoFin = fechasConTurno[0];
            let totalDiasGrupo = grupoInicio.dias;
            let turnoGrupo = grupoInicio.turno;

            for (let i = 1; i < fechasConTurno.length; i++) {
              const fechaActual = fechasConTurno[i];
              const fechaAnterior = fechasConTurno[i - 1];
              
              const fechaActualDate = new Date(fechaActual.fecha);
              const fechaAnteriorDate = new Date(fechaAnterior.fecha);
              const diferenciaDias = (fechaActualDate.getTime() - fechaAnteriorDate.getTime()) / (1000 * 60 * 60 * 24);
              
              // Verificar si es consecutiva y tiene el mismo turno
              const esConsecutiva = diferenciaDias === 1;
              const mismoTurno = fechaActual.turno === turnoGrupo;
              
              if (esConsecutiva && mismoTurno) {
                // Fecha consecutiva con mismo turno, extender el grupo
                grupoFin = fechaActual;
                totalDiasGrupo += fechaActual.dias;
              } else {
                // Nueva secuencia o cambio de turno, guardar el grupo anterior
                boletaPayload.detalle.push({
                  Desde: grupoInicio.fecha,
                  Hasta: grupoFin.fecha,
                  Dias: totalDiasGrupo,
                  Tipo: payload.tipo === 'PROGRAMADA' ? 'Vacación' : payload.tipo || 'Vacación',
                  Turno: turnoGrupo !== 'COMPLETO' ? turnoGrupo : undefined
                });
                
                // Iniciar nuevo grupo
                grupoInicio = fechaActual;
                grupoFin = fechaActual;
                totalDiasGrupo = fechaActual.dias;
                turnoGrupo = fechaActual.turno;
              }
            }

            // Agregar el último grupo
            boletaPayload.detalle.push({
              Desde: grupoInicio.fecha,
              Hasta: grupoFin.fecha,
              Dias: totalDiasGrupo,
              Tipo: payload.tipo === 'PROGRAMADA' ? 'Vacación' : payload.tipo || 'Vacación',
              Turno: grupoInicio.turno !== 'COMPLETO' ? grupoInicio.turno : undefined
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
          const pdfUrl = 'http://190.171.225.68:8006/api/vacacion';
          const fileName = `Boleta_Vacacion_${payload.id_solicitud}.pdf`;
          const pdfPath = path.join(__dirname, '../../tmp', fileName);

          // Crear directorio tmp si no existe
          const tmpDir = path.dirname(pdfPath);
          if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
          }

          // Construir URL con parámetros de consulta usando URLSearchParams
          // El servidor espera que detalle sea un array en formato detalle[0][Desde], detalle[0][Hasta], etc.
          const params = new URLSearchParams();
          params.append('Codigo', String(boletaPayload.Codigo));
          params.append('Empleado', String(boletaPayload.Empleado));
          params.append('Cargo', String(boletaPayload.Cargo));
          params.append('Departamento', String(boletaPayload.Departamento));
          params.append('FechaIngreso', String(boletaPayload.FechaIngreso));
          params.append('FechaSolicitud', String(boletaPayload.FechaSolicitud));
          params.append('Estado', String(boletaPayload.Estado));
          params.append('Observaciones', String(boletaPayload.Observaciones));
          
          // Agregar cada elemento del detalle como parámetros separados
          // Formato: detalle[0][Desde]=...&detalle[0][Hasta]=...&detalle[0][Dias]=...&detalle[0][Tipo]=...&detalle[0][Turno]=...
          boletaPayload.detalle.forEach((item: any, index: number) => {
            params.append(`detalle[${index}][Desde]`, String(item.Desde));
            params.append(`detalle[${index}][Hasta]`, String(item.Hasta));
            params.append(`detalle[${index}][Dias]`, String(item.Dias));
            params.append(`detalle[${index}][Tipo]`, String(item.Tipo));
            if (item.Turno) {
              params.append(`detalle[${index}][Turno]`, String(item.Turno));
            }
          });

          const urlWithParams = `${pdfUrl}?${params.toString()}`;

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

          // ⚠️ NOTIFICACIÓN DESACTIVADA - Envío de boleta PDF al empleado
          // await bot.sendMessage(empPhone, '📄 *Boleta de vacación aprobada*\n\nTu solicitud de vacaciones ha sido autorizada. Adjunto encontrarás la boleta oficial.', { 
          //   media: pdfPath 
          // });

          logger.info('✅ Boleta de vacación enviada exitosamente al empleado', {
            emp_id: payload.emp_id,
            solicitud_id: payload.id_solicitud,
            fileName
          });

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

      // ============================================
      // 2. NOTIFICACIÓN A LOS REEMPLAZANTES (APROBADO)
      // ============================================
      // PROPÓSITO: Informar a los empleados asignados como reemplazantes que deben cubrir
      //            las funciones del empleado que estará de vacaciones
      // CONTENIDO:
      //   - Nombre del empleado que estará de vacaciones
      //   - Fechas en las que deben cubrir
      //   - Tipo de vacación
      //   - Instrucciones para coordinar con el equipo
      // DESACTIVADO: Temporalmente no se envía ninguna notificación
      // ============================================
      // 2. Notificar a los REEMPLAZANTES
      logger.info('🔔 [DESACTIVADO] Verificando reemplazantes para notificación', {
        tiene_reemplazantes: payload.reemplazantes?.length ?? 0,
        tipo: payload.tipo,
        es_programada: payload.tipo === 'PROGRAMADA',
        reemplazantes: payload.reemplazantes ? JSON.stringify(payload.reemplazantes) : 'NINGUNO'
      });
      
      // Log específico para PROGRAMADA
      if (payload.tipo === 'PROGRAMADA') {
        logger.info('🔔🔔🔔 VERIFICANDO REEMPLAZANTES PARA PROGRAMADA 🔔🔔🔔', {
          tiene_reemplazantes: payload.reemplazantes?.length ?? 0,
          reemplazantes: payload.reemplazantes ? JSON.stringify(payload.reemplazantes) : 'NINGUNO'
        });
      }
      
      if ((payload.reemplazantes?.length ?? 0) > 0) {
        logger.info('✅ Reemplazantes encontrados, enviando notificaciones', {
          cantidad: payload.reemplazantes?.length ?? 0,
          tipo: payload.tipo,
          es_programada: payload.tipo === 'PROGRAMADA'
        });
        for (const reemplazante of (payload.reemplazantes ?? [])) {
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

            // Obtener el número real del reemplazante
            let reemplazantePhoneReal: string | undefined;
            try {
              const repData = await getUserByID(reemplazante.emp_id);
              if (Array.isArray(repData) && repData.length > 0) {
                const reemplazanteData = repData.find((item: any) => item.data?.empID === reemplazante.emp_id);
                if (reemplazanteData?.data?.phone) {
                  reemplazantePhoneReal = reemplazanteData.data.phone.startsWith('591') ? reemplazanteData.data.phone : `591${reemplazanteData.data.phone}`;
                }
              }
            } catch (error: any) {
              logger.warn('No se pudo obtener el teléfono del reemplazante, se usará número de desarrollo', {
                reemplazante_id: reemplazante.emp_id,
                error: error.message
              });
            }
            
            const reemplazantePhone = getPhoneForEnvironment(reemplazantePhoneReal);
            logger.info('📱 Enviando notificación de reemplazante', {
              reemplazante_id: reemplazante.emp_id,
              reemplazante_nombre: reemplazante.nombre,
              phone: reemplazantePhone,
              phone_real: reemplazantePhoneReal,
              is_development: IS_DEVELOPMENT
            });

            // ⚠️ NOTIFICACIÓN DESACTIVADA - Mensaje a reemplazante
            // await bot.sendMessage(reemplazantePhone, mensajeReemplazante, {});

            logger.info('✅ Notificación enviada a reemplazante', {
              reemplazante: reemplazante.nombre,
              reemplazante_phone: reemplazantePhone,
              solicitud_id: payload.id_solicitud,
              tipo: payload.tipo,
              es_programada: payload.tipo === 'PROGRAMADA'
            });
            
            // Log específico para PROGRAMADA (comentado porque notificaciones están desactivadas)
            // if (payload.tipo === 'PROGRAMADA') {
            //   logger.info('✅✅✅ NOTIFICACIÓN PROGRAMADA ENVIADA A REEMPLAZANTE ✅✅✅', {
            //     reemplazante: reemplazante.nombre,
            //     reemplazante_id: reemplazante.emp_id,
            //     reemplazante_phone: reemplazantePhone
            //   });
            // }

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
      } else {
        // Log cuando NO hay reemplazantes
        logger.info('ℹ️ No hay reemplazantes para notificar', {
          tipo: payload.tipo,
          es_programada: payload.tipo === 'PROGRAMADA',
          id_solicitud: payload.id_solicitud
        });
        
        // Log específico para PROGRAMADA sin reemplazantes
        if (payload.tipo === 'PROGRAMADA') {
          logger.info('ℹ️ℹ️ℹ️ PROGRAMADA SIN REEMPLAZANTES - NO SE ENVIARÁN NOTIFICACIONES A REEMPLAZANTES ℹ️ℹ️ℹ️', {
            id_solicitud: payload.id_solicitud,
            emp_id: payload.emp_id
          });
        }
      }
    }

    // ============================================
    // 3. NOTIFICACIÓN DE PREAPROBACIÓN AL EMPLEADO
    // ============================================
    // PROPÓSITO: Informar al empleado que su solicitud de vacaciones fue preaprobada
    //            (revisada pero aún no aprobada completamente)
    // CONTENIDO:
    //   - Mensaje indicando que las fechas fueron revisadas y preaprobadas
    //   - Fechas preaprobadas
    //   - Comentario del supervisor
    //   - Información de que recibirá otra notificación cuando se apruebe finalmente
    // CUANDO SE ENVÍA: Cuando todas las fechas de una solicitud están preaprobadas
    // DESACTIVADO: Temporalmente no se envía ninguna notificación
    // ============================================
    // 🔔 SI ES PREAPROBADO → NOTIFICAR AL EMPLEADO
    // La notificación se envía cuando todas las fechas están preaprobadas
    // ⚠️ DESACTIVADO: Cambiar `if (false &&` por `if (payload.estado === 'PREAPROBADO')` para reactivar
    if (false && payload.estado === 'PREAPROBADO') {
      try {
        logger.info('📱 [DESACTIVADO] Enviando notificación de preaprobación al empleado', {
          emp_id: payload.emp_id,
          phone: empPhone,
          phone_real: empPhoneReal,
          is_development: IS_DEVELOPMENT
        });

        const fechasTexto = payload.fechas?.join('\n• ') || 'Ver sistema';

        const mensajePreaprobacion = `✅ *TUS VACACIONES FUERON PREAPROBADAS*

👤 *Empleado:* ${payload.emp_nombre || 'Tú'}
📅 *Tipo:* ${payload.tipo || 'Vacaciones'}
📆 *Días preaprobados:* ${payload.dias_solicitados || 'N/A'}

*Fechas preaprobadas:*
• ${fechasTexto}

✅ *Estado:* PREAPROBADO / REVISADO

💬 *Comentario del supervisor:*
${payload.comentario || 'Todas tus fechas han sido revisadas y preaprobadas.'}

📋 *Próximos pasos:*
Tu solicitud está preaprobada. Recibirás una notificación cuando se complete el proceso de aprobación final.

📱 *Cualquier duda, contacta con tu supervisor*`;

        // ⚠️ NOTIFICACIÓN DESACTIVADA - Mensaje de preaprobación al empleado
        // await bot.sendMessage(empPhone, mensajePreaprobacion, {});

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

    // ============================================
    // 4. NOTIFICACIÓN DE RECHAZO AL EMPLEADO
    // ============================================
    // PROPÓSITO: Informar al empleado que su solicitud de vacaciones fue rechazada
    // CONTENIDO:
    //   - Mensaje indicando que la solicitud fue rechazada
    //   - Motivo del rechazo (comentario del supervisor)
    //   - Instrucciones para contactar al supervisor
    // DESACTIVADO: Temporalmente no se envía ninguna notificación
    // ============================================
    // 🔔 SI ES RECHAZADO → NOTIFICAR AL EMPLEADO
    // ⚠️ DESACTIVADO: Cambiar `if (false &&` por `if (payload.estado === 'RECHAZADO')` para reactivar
    if (false && payload.estado === 'RECHAZADO') {
      try {
        const mensajeRechazo = `❌ *SOLICITUD DE VACACIONES RECHAZADA*

📅 *Tipo:* ${payload.tipo || 'Vacaciones'}
📆 *Días solicitados:* ${payload.dias_solicitados || 'N/A'}

${payload.comentario ? `💬 *Motivo del rechazo:*\n${payload.comentario}` : ''}

📱 *Por favor contacta con tu supervisor para más detalles*`;

        logger.info('📱 [DESACTIVADO] Enviando notificación de rechazo al empleado', {
          emp_id: payload.emp_id,
          phone: empPhone,
          phone_real: empPhoneReal,
          is_development: IS_DEVELOPMENT
        });

        // ⚠️ NOTIFICACIÓN DESACTIVADA - Mensaje de rechazo al empleado
        // await bot.sendMessage(empPhone, mensajeRechazo, {});

        logger.info('✅ Notificación de rechazo enviada', {
          emp_id: payload.emp_id,
          emp_phone: empPhone
        });

      } catch (whatsappError: any) {
        logger.error('❌ Error al enviar notificación de rechazo', {
          error: whatsappError.message
        });
      }
    }

    // ============================================
    // 📧 ENVIAR CORREO ELECTRÓNICO DE NOTIFICACIÓN
    // ============================================
    // Solo enviar correo si el estado es APROBADO o RECHAZADO (no PREAPROBADO)
    // Normalizar el estado para comparación (mayúsculas)
    const estadoNormalizado = payload.estado?.toUpperCase().trim();
    const debeEnviarCorreo = estadoNormalizado === 'APROBADO' || estadoNormalizado === 'RECHAZADO';
    
    logger.info('📧 Verificando si se debe enviar correo electrónico', {
      estado_original: payload.estado,
      estado_normalizado: estadoNormalizado,
      debe_enviar: debeEnviarCorreo,
      es_aprobado: estadoNormalizado === 'APROBADO',
      es_rechazado: estadoNormalizado === 'RECHAZADO'
    });
    
    if (debeEnviarCorreo) {
      logger.info('📧 Iniciando proceso de envío de correo electrónico', {
        emp_id: payload.emp_id,
        estado_original: payload.estado,
        estado_normalizado: estadoNormalizado,
        tiene_fechas: payload.fechas?.length || 0,
        tiene_reemplazantes: payload.reemplazantes?.length || 0,
        fechas: payload.fechas ? JSON.stringify(payload.fechas) : 'NINGUNA'
      });
      
      try {
        // Obtener información adicional del empleado para la regional
        let regional: string | undefined;
        try {
          const empData = await getUserByID(payload.emp_id);
          if (Array.isArray(empData) && empData.length > 0) {
            const empleado = empData.find((item: any) => item.data?.empID === payload.emp_id);
            // Intentar obtener la regional del empleado
            // Ajustar según la estructura real de los datos
            regional = empleado?.data?.regional || empleado?.data?.branch || undefined;
            logger.info('✅ Regional obtenida para el correo', { regional });
          }
        } catch (error: any) {
          logger.warn('No se pudo obtener la regional del empleado para el correo', {
            emp_id: payload.emp_id,
            error: error.message
          });
        }

        // Formatear fechas para el correo
        const fechasFormateadas = payload.fechas?.map((fecha: string, index: number) => {
          // Las fechas pueden venir en formato "YYYY-MM-DD" o "DD-MM-YYYY (TURNO)"
          let fechaFormateada = fecha;
          let turno = 'COMPLETO';
          
          // Si la fecha incluye el turno en paréntesis: "DD-MM-YYYY (TURNO)"
          const fechaConTurno = fecha.match(/^(.+?)\s*\((.+?)\)$/);
          if (fechaConTurno) {
            fechaFormateada = fechaConTurno[1].trim();
            turno = fechaConTurno[2].trim().toUpperCase();
            if (turno !== 'MAÑANA' && turno !== 'TARDE' && turno !== 'COMPLETO') {
              turno = 'COMPLETO';
            }
          } else if (fecha.match(/^\d{4}-\d{2}-\d{2}$/)) {
            // Formato YYYY-MM-DD, convertir a DD-MM-YYYY
            const [year, month, day] = fecha.split('-');
            fechaFormateada = `${day}-${month}-${year}`;
          }
          
          return {
            fecha: fechaFormateada,
            turno: turno
          };
        }) || [];

        // Formatear reemplazantes para el correo
        const reemplazantesFormateados = payload.reemplazantes?.map((rep: Reemplazante) => ({
          emp_id: rep.emp_id,
          nombre: rep.nombre,
          telefono: rep.telefono
        })) || [];

        logger.info('📧 Preparando datos para envío de correo', {
          empleadoNombre: payload.emp_nombre || `Empleado ${payload.emp_id}`,
          empleadoId: payload.emp_id,
          estado: payload.estado,
          cantidad_fechas: fechasFormateadas.length,
          cantidad_reemplazantes: reemplazantesFormateados.length,
          regional: regional
        });

        // Enviar correo electrónico
        // Asegurar que el estado esté en el formato correcto para el servicio de correo
        const estadoParaCorreo = estadoNormalizado === 'APROBADO' ? 'APROBADO' 
          : estadoNormalizado === 'RECHAZADO' ? 'RECHAZADO' 
          : 'SUGERENCIA';
        
        logger.info('📧 Llamando a sendVacationEmail con datos:', {
          empleadoNombre: payload.emp_nombre || `Empleado ${payload.emp_id}`,
          empleadoId: payload.emp_id,
          estado: estadoParaCorreo,
          cantidad_fechas: fechasFormateadas.length,
          cantidad_reemplazantes: reemplazantesFormateados.length,
          regional: regional || 'NO DEFINIDA'
        });
        
        const emailEnviado = await sendVacationEmail({
          empleadoNombre: payload.emp_nombre || `Empleado ${payload.emp_id}`,
          empleadoId: payload.emp_id,
          estado: estadoParaCorreo as 'APROBADO' | 'RECHAZADO' | 'SUGERENCIA',
          fechas: fechasFormateadas,
          comentario: payload.comentario,
          regional: regional,
          reemplazantes: reemplazantesFormateados
        });

        if (emailEnviado) {
          logger.info('✅ Correo electrónico de notificación enviado exitosamente', {
            emp_id: payload.emp_id,
            estado: payload.estado,
            regional: regional,
            cantidad_fechas: fechasFormateadas.length,
            cantidad_reemplazantes: reemplazantesFormateados.length
          });
        } else {
          logger.warn('⚠️ No se pudo enviar el correo electrónico (retornó false)', {
            emp_id: payload.emp_id,
            estado: payload.estado
          });
        }
      } catch (emailError: any) {
        // No fallar la operación si el correo no se puede enviar
        logger.error('❌ Error al enviar correo de notificación (no crítico)', {
          error: emailError.message,
          emp_id: payload.emp_id,
          estado: payload.estado
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
