import { logger } from '../utils/logger';
import { connectionStatus } from '../services/connectionStatus';
import { getUserByID } from '../services/getUserByID';
import { getPhoneForEnvironment } from '../utils/phoneHelper';

interface VacationData {
  emp_id: string;
  emp_nombre: string;
  emp_telefono: string;
  manager_id: string;
  manager_nombre: string;
  manager_telefono: string;
  fechas: Array<{
    fecha: string;
    tipo_dia: string;
    estado?: string; // Estado de la solicitud (APROBADO, PREAPROBADO, PROCESO, etc.)
  }>;
  estado?: string; // Estado general de la solicitud
}

/**
 * Obtiene todas las vacaciones agrupadas por empleado y manager para un mes específico
 * Usa las APIs: /api/vacacion-data-manager para obtener por manager
 * Incluye estados: APROBADO, PREAPROBADO, PRE-APROBADO, PROCESO, PENDIENTE
 */
async function getVacationsForMonth(year: number, month: number): Promise<{
  byEmployee: Map<string, VacationData>;
  byManager: Map<string, Map<string, VacationData>>;
}> {
  try {
    const apiUrl = process.env.API_URL || 'http://190.171.225.68';
    
    // Obtener todos los managers únicos desde las solicitudes
    // Por ahora, usamos el manager_id conocido (63) o podemos obtener todos los managers
    // TODO: Si hay un endpoint para obtener todos los managers, usarlo aquí
    const managerIds = ['63']; // Puedes expandir esto para obtener todos los managers
    
    const vacationsByEmployee = new Map<string, VacationData>();
    const vacationsByManager = new Map<string, Map<string, VacationData>>();
    
    // Procesar cada manager
    for (const managerId of managerIds) {
      logger.info('Consultando vacaciones del manager', { manager_id: managerId });
      
      const response = await fetch(`${apiUrl}/api/vacacion-data-manager?manager=${managerId}`);
      
      if (!response.ok) {
        logger.warn('No se pudo obtener vacaciones del manager', { manager_id: managerId });
        continue;
      }
      
      const data = await response.json();
      const solicitudes = data.success && Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);
      
      if (solicitudes.length === 0) {
        logger.info('No hay solicitudes para este manager', { manager_id: managerId });
        continue;
      }
      
      logger.info('Solicitudes obtenidas del manager', { 
        manager_id: managerId, 
        total: solicitudes.length 
      });
      
      // Procesar cada solicitud
      for (const solicitud of solicitudes) {
        // Procesar solicitudes aprobadas, pre-aprobadas, en proceso y pendientes
        const estadosValidos = ['APROBADO', 'APROBADA', 'PREAPROBADO', 'PRE-APROBADO', 'PROCESO', 'PENDIENTE'];
        if (!estadosValidos.includes(solicitud.estado)) continue;
        
        const empId = solicitud.emp_id;
        const solicitudManagerId = solicitud.manager_id || managerId;
        
        // Obtener información del empleado usando el servicio existente
        // Agregar un pequeño delay para evitar rate limiting
        let empData: any = null;
        try {
          empData = await getUserByID(empId);
          // Pequeño delay después de cada llamada exitosa para evitar rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (err: any) {
          // Solo registrar si es un error crítico, no errores temporales de API
          if (err?.code !== '429' && err?.message?.includes('rate limit') === false) {
            // Usar datos por defecto si falla la llamada
            logger.debug('No se pudo obtener datos del empleado, usando valores por defecto', { emp_id: empId });
          }
        }
        
        // Obtener información del manager
        let managerData: any = null;
        if (solicitudManagerId) {
          try {
            managerData = await getUserByID(solicitudManagerId);
            // Pequeño delay después de cada llamada exitosa
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (err: any) {
            // Solo registrar si es un error crítico
            if (err?.code !== '429' && err?.message?.includes('rate limit') === false) {
              logger.debug('No se pudo obtener datos del manager, usando valores por defecto', { manager_id: solicitudManagerId });
            }
          }
        }
        
        // Procesar fechas de la solicitud
        const fechas = solicitud.fechas || [];
        
        for (const fechaItem of fechas) {
          // Manejar diferentes formatos de fecha
          let fechaStr = '';
          if (typeof fechaItem === 'string') {
            fechaStr = fechaItem;
          } else if (fechaItem.fecha) {
            fechaStr = fechaItem.fecha;
          } else {
            continue;
          }
          
          // Normalizar formato de fecha (YYYY-MM-DD)
          const fechaNormalizada = fechaStr.split('T')[0];
          const fechaObj = new Date(fechaNormalizada);
          if (isNaN(fechaObj.getTime())) {
            logger.warn('Fecha inválida encontrada', { fecha: fechaStr });
            continue;
          }
          
          const fechaYear = fechaObj.getFullYear();
          const fechaMonth = fechaObj.getMonth() + 1;
          
          // Solo incluir fechas del mes solicitado
          if (fechaYear === year && fechaMonth === month) {
            // Agrupar por empleado
            if (!vacationsByEmployee.has(empId)) {
              vacationsByEmployee.set(empId, {
                emp_id: empId,
                emp_nombre: empData?.fullName || empData?.nombre || `Empleado ${empId}`,
                emp_telefono: empData?.phone || empData?.telefono || '77711124',
                manager_id: solicitudManagerId || '',
                manager_nombre: managerData?.fullName || managerData?.nombre || 'Manager',
                manager_telefono: managerData?.phone || managerData?.telefono || '61105926',
                estado: solicitud.estado,
                fechas: []
              });
            }
            
            const employeeVacation = vacationsByEmployee.get(empId)!;
            employeeVacation.fechas.push({
              fecha: fechaNormalizada,
              tipo_dia: (typeof fechaItem === 'object' && fechaItem.turno) || 
                       (typeof fechaItem === 'object' && fechaItem.tipo_dia) || 
                       'COMPLETO',
              estado: solicitud.estado
            });
            
            // Agrupar por manager
            if (!vacationsByManager.has(solicitudManagerId)) {
              vacationsByManager.set(solicitudManagerId, new Map());
            }
            
            const managerEmployees = vacationsByManager.get(solicitudManagerId)!;
            if (!managerEmployees.has(empId)) {
              managerEmployees.set(empId, {
                emp_id: empId,
                emp_nombre: empData?.fullName || empData?.nombre || `Empleado ${empId}`,
                emp_telefono: empData?.phone || empData?.telefono || '77711124',
                manager_id: solicitudManagerId || '',
                manager_nombre: managerData?.fullName || managerData?.nombre || 'Manager',
                manager_telefono: managerData?.phone || managerData?.telefono || '61105926',
                estado: solicitud.estado,
                fechas: []
              });
            }
            
            const managerEmployeeVacation = managerEmployees.get(empId)!;
            managerEmployeeVacation.fechas.push({
              fecha: fechaNormalizada,
              tipo_dia: (typeof fechaItem === 'object' && fechaItem.turno) || 
                       (typeof fechaItem === 'object' && fechaItem.tipo_dia) || 
                       'COMPLETO',
              estado: solicitud.estado
            });
          }
        }
      }
    }
    
    logger.info('Vacaciones procesadas para el mes', {
      year,
      month,
      total_empleados: vacationsByEmployee.size,
      total_managers: vacationsByManager.size
    });
    
    return {
      byEmployee: vacationsByEmployee,
      byManager: vacationsByManager
    };
  } catch (error: any) {
    logger.error('Error al obtener vacaciones del mes', {
      error: error.message,
      stack: error.stack,
      year,
      month
    });
    return {
      byEmployee: new Map(),
      byManager: new Map()
    };
  }
}

/**
 * Envía notificación de recordatorio mensual a un empleado
 */
async function sendEmployeeReminder(bot: any, vacationData: VacationData, monthName: string): Promise<boolean> {
  try {
    if (!connectionStatus.isConnected()) {
      logger.warn('Bot no conectado, no se puede enviar recordatorio al empleado', {
        emp_id: vacationData.emp_id
      });
      return false;
    }

    // Obtener el número real del empleado
    const phoneReal = vacationData.emp_telefono ? 
      (vacationData.emp_telefono.startsWith('591') ? vacationData.emp_telefono : `591${vacationData.emp_telefono}`) : 
      undefined;
    const phone = getPhoneForEnvironment(phoneReal);
    
    logger.info('📱 Enviando recordatorio al empleado', {
      emp_id: vacationData.emp_id,
      emp_nombre: vacationData.emp_nombre,
      phone_destino: phone,
      phone_real: phoneReal,
      is_development: process.env.NODE_ENV === 'development'
    });

    // Formatear fechas
    const fechasFormateadas = vacationData.fechas.map(f => {
      const fecha = new Date(f.fecha);
      const dia = fecha.getDate();
      const mes = fecha.toLocaleDateString('es-ES', { month: 'long' });
      const tipo = f.tipo_dia === 'COMPLETO' ? 'Completo' : f.tipo_dia;
      return `${dia} de ${mes} (${tipo})`;
    }).join('\n• ');

    // Determinar el estado de la solicitud para el mensaje
    const estadoTexto = vacationData.estado || vacationData.fechas[0]?.estado || 'APROBADO';
    let estadoMensaje = '';
    if (estadoTexto === 'APROBADO' || estadoTexto === 'APROBADA') {
      estadoMensaje = 'aprobadas';
    } else if (estadoTexto === 'PREAPROBADO' || estadoTexto === 'PRE-APROBADO') {
      estadoMensaje = 'pre-aprobadas';
    } else if (estadoTexto === 'PROCESO' || estadoTexto === 'PENDIENTE') {
      estadoMensaje = 'en proceso';
    } else {
      estadoMensaje = 'aprobadas';
    }

    const message = `📅 *Recordatorio de Vacaciones - ${monthName}*

Hola ${vacationData.emp_nombre},

Este es un recordatorio de tus vacaciones *${estadoMensaje}* para el mes de *${monthName}*:

• ${fechasFormateadas}

*Total: ${vacationData.fechas.length} día(s)*
*Estado: ${estadoMensaje.toUpperCase()}*

¡Que disfrutes tus vacaciones! 🏖️`;

    await bot.sendMessage(phone, message, {});
    
    logger.info('✅ Recordatorio mensual enviado al empleado', {
      emp_id: vacationData.emp_id,
      emp_nombre: vacationData.emp_nombre,
      mes: monthName,
      total_dias: vacationData.fechas.length
    });

    return true;
  } catch (error: any) {
    logger.error('Error al enviar recordatorio al empleado', {
      error: error.message,
      emp_id: vacationData.emp_id
    });
    return false;
  }
}

/**
 * Envía notificación de recordatorio mensual a un jefe con resumen de todos sus empleados
 */
async function sendManagerReminder(bot: any, managerId: string, employeesVacations: Map<string, VacationData>, monthName: string): Promise<boolean> {
  try {
    if (!connectionStatus.isConnected()) {
      logger.warn('Bot no conectado, no se puede enviar recordatorio al jefe', {
        manager_id: managerId
      });
      return false;
    }

    // Obtener datos del manager (usar el primer empleado como referencia)
    const firstEmployee = Array.from(employeesVacations.values())[0];
    if (!firstEmployee) {
      logger.warn('No hay empleados para enviar recordatorio al jefe', {
        manager_id: managerId
      });
      return false;
    }

    // Obtener el número real del manager
    const managerPhoneReal = firstEmployee.manager_telefono ? 
      (firstEmployee.manager_telefono.startsWith('591') ? firstEmployee.manager_telefono : `591${firstEmployee.manager_telefono}`) : 
      undefined;
    const managerPhone = getPhoneForEnvironment(managerPhoneReal);
    
    logger.info('📱 Enviando consolidado al manager', {
      manager_id: managerId,
      manager_nombre: firstEmployee.manager_nombre,
      phone_destino: managerPhone,
      phone_real: managerPhoneReal,
      is_development: process.env.NODE_ENV === 'development',
      total_empleados: employeesVacations.size
    });

    // Construir mensaje con resumen por empleado
    let message = `📅 *Recordatorio de Vacaciones - ${monthName}*\n\n`;
    message += `Hola ${firstEmployee.manager_nombre},\n\n`;
    message += `Este es un resumen de las vacaciones de tus empleados para el mes de *${monthName}*:\n\n`;

    let totalDias = 0;
    for (const [empId, vacationData] of employeesVacations.entries()) {
      const dias = vacationData.fechas.length;
      totalDias += dias;

      // Ordenar fechas
      const fechasOrdenadas = [...vacationData.fechas].sort((a, b) => 
        new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
      );

      const fechasFormateadas = fechasOrdenadas.map(f => {
        const fecha = new Date(f.fecha);
        return fecha.getDate();
      }).join(', ');

      // Determinar el estado para mostrar
      const estadoTexto = vacationData.estado || vacationData.fechas[0]?.estado || 'APROBADO';
      let estadoEmoji = '✅';
      let estadoTextoMostrar = '';
      if (estadoTexto === 'APROBADO' || estadoTexto === 'APROBADA') {
        estadoEmoji = '✅';
        estadoTextoMostrar = 'Aprobadas';
      } else if (estadoTexto === 'PREAPROBADO' || estadoTexto === 'PRE-APROBADO') {
        estadoEmoji = '⏳';
        estadoTextoMostrar = 'Pre-aprobadas';
      } else if (estadoTexto === 'PROCESO' || estadoTexto === 'PENDIENTE') {
        estadoEmoji = '🔄';
        estadoTextoMostrar = 'En proceso';
      } else {
        estadoEmoji = '✅';
        estadoTextoMostrar = 'Aprobadas';
      }

      message += `👤 *${vacationData.emp_nombre}*\n`;
      message += `   📆 Días: ${fechasFormateadas}\n`;
      message += `   📊 Total: ${dias} día(s)\n`;
      message += `   ${estadoEmoji} Estado: ${estadoTextoMostrar}\n\n`;
    }

    message += `*Total general: ${totalDias} día(s) de vacaciones en ${monthName}*\n\n`;
    message += `¡Que todos disfruten sus vacaciones! 🏖️`;

    await bot.sendMessage(managerPhone, message, {});

    logger.info('✅ Recordatorio mensual enviado al jefe', {
      manager_id: managerId,
      manager_nombre: firstEmployee.manager_nombre,
      mes: monthName,
      total_empleados: employeesVacations.size,
      total_dias: totalDias
    });

    return true;
  } catch (error: any) {
    logger.error('Error al enviar recordatorio al jefe', {
      error: error.message,
      manager_id: managerId
    });
    return false;
  }
}

/**
 * Procesa y envía los recordatorios mensuales
 */
export async function processMonthlyReminders(bot: any, year?: number, month?: number): Promise<void> {
  try {
    // Verificar que el bot esté conectado antes de iniciar
    if (!connectionStatus.isConnected()) {
      logger.warn('⚠️ Bot no conectado, no se pueden enviar recordatorios');
      throw new Error('El bot de WhatsApp no está conectado. Por favor, escanea el código QR para conectar el bot.');
    }

    const now = new Date();
    const targetYear = year || now.getFullYear();
    const targetMonth = month || (now.getMonth() + 1);

    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const monthName = monthNames[targetMonth - 1];

    logger.info('📅 Iniciando proceso de recordatorios mensuales', {
      year: targetYear,
      month: targetMonth,
      monthName,
      bot_connected: connectionStatus.isConnected()
    });

    // Obtener todas las vacaciones del mes agrupadas por empleado y manager
    const { byEmployee, byManager } = await getVacationsForMonth(targetYear, targetMonth);

    if (byEmployee.size === 0) {
      logger.info('ℹ️ No hay vacaciones para el mes, no se envían recordatorios', {
        year: targetYear,
        month: targetMonth
      });
      return;
    }

    logger.info('📊 Vacaciones encontradas para el mes', {
      total_empleados: byEmployee.size,
      total_managers: byManager.size,
      month: monthName
    });

    // Enviar recordatorios a cada empleado
    logger.info('📤 Enviando recordatorios a empleados', {
      total_empleados: byEmployee.size
    });

    let empleadosNotificados = 0;
    for (const [empId, vacationData] of byEmployee.entries()) {
      // Ordenar fechas antes de enviar
      vacationData.fechas.sort((a, b) => 
        new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
      );
      
      const success = await sendEmployeeReminder(bot, vacationData, monthName);
      if (success) {
        empleadosNotificados++;
      }
      // Pequeño delay entre notificaciones para evitar saturación
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Enviar recordatorios consolidados a cada jefe
    logger.info('📤 Enviando recordatorios consolidados a jefes', {
      total_jefes: byManager.size
    });

    let jefesNotificados = 0;
    for (const [managerId, employeesVacations] of byManager.entries()) {
      // Ordenar fechas para cada empleado antes de enviar
      for (const [empId, vacationData] of employeesVacations.entries()) {
        vacationData.fechas.sort((a, b) => 
          new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
        );
      }
      
      const success = await sendManagerReminder(bot, managerId, employeesVacations, monthName);
      if (success) {
        jefesNotificados++;
      }
      // Pequeño delay entre notificaciones
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    logger.info('✅ Proceso de recordatorios mensuales completado', {
      month: monthName,
      empleados_notificados: empleadosNotificados,
      jefes_notificados: jefesNotificados,
      total_empleados: byEmployee.size,
      total_managers: byManager.size
    });

  } catch (error: any) {
    // Solo registrar errores críticos, ignorar errores de conexión si el proceso ya completó
    // El error de QR code puede aparecer después de que el proceso completa exitosamente
    const isQRCodeError = error?.message?.includes('QR code') || 
                         error?.message?.includes('scanning') ||
                         error?.code === '100' ||
                         error?.code === 'BOT_NOT_CONNECTED';
    
    if (!isQRCodeError) {
      logger.error('❌ Error en proceso de recordatorios mensuales', {
        error: error.message,
        stack: error.stack,
        bot_connected: connectionStatus.isConnected()
      });
      // Re-lanzar solo errores críticos
      throw error;
    } else {
      // Si es un error de QR code residual, solo registrar como debug y NO re-lanzar
      // Esto evita que el error se propague al frontend
      logger.debug('⚠️ Error de conexión residual detectado (proceso completó exitosamente, ignorando)', {
        error: error.message,
        bot_connected: connectionStatus.isConnected()
      });
      // NO re-lanzar el error para que no se propague al frontend
      // El proceso ya completó exitosamente, este es solo un error residual
    }
  }
}

