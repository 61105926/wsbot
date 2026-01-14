import { Bot } from './bot.interface';
import { sendJSON, asyncHandler } from '../utils/response';
import { logger } from '../utils/logger';
import { getUserByID } from '../services/getUserByID';

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
      body: JSON.stringify(req.body)
    });

    const payload: VacationPayload = req.body;
    
    // Función helper para calcular días totales considerando medio día = 0.5
    const calcularDiasTotales = (detalle: VacationDetail[]): number => {
      return detalle.reduce((total, d) => {
        const turno = d.turno || d.tipo_dia || 'COMPLETO';
        if (turno === 'MAÑANA' || turno === 'TARDE') {
          return total + 0.5;
        }
        return total + 1;
      }, 0);
    };

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

    // Calcular días totales
    const diasTotales = calcularDiasTotales(payload.detalle);
    
    // Log de la solicitud recibida
    logger.info('Solicitud de vacaciones procesada', {
      solicitud_id: solicitudId,
      emp_id: payload.emp_id,
      tipo: payload.tipo,
      manager_id: payload.manager_id,
      dias_solicitados: diasTotales,
      cantidad_fechas: payload.detalle.length,
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

    // Notificaciones por WhatsApp eliminadas - solo se usan correos electrónicos

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
        dias_solicitados: diasTotales,
        cantidad_fechas: payload.detalle.length,
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
