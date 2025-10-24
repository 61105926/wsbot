import { Bot } from './bot.interface';
import { sendJSON, asyncHandler } from '../utils/response';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

/**
 * GET /api/vacation-data/:id
 * Obtiene los datos completos de una solicitud de vacación incluyendo reemplazantes
 */
const handleGetVacationData = async (bot: Bot, req: any, res: any) => {
  try {
    const solicitudId = req.params.id;
    
    if (!solicitudId) {
      return sendJSON(res, 400, {
        status: 'error',
        message: 'ID de solicitud requerido'
      });
    }

    logger.info('Obteniendo datos de solicitud', { solicitud_id: solicitudId });

    // Buscar en los logs de solicitudes almacenadas
    const logsDir = path.join(__dirname, '../../logs');
    const logFiles = fs.readdirSync(logsDir).filter(file => file.includes('combined')).sort();
    
    logger.info('Archivos de log encontrados', { logFiles, logsDir });
    
    let solicitudData = null;
    
    for (const logFile of logFiles) {
      const logPath = path.join(logsDir, logFile);
      const logContent = fs.readFileSync(logPath, 'utf8');
      
      // Buscar la línea que contiene los datos de la solicitud
      const lines = logContent.split('\n');
      logger.info('Buscando en archivo de log', { logFile, totalLines: lines.length });
      
      for (const line of lines) {
        if (line.includes('"Datos de la solicitud"')) {
          logger.info('🔍 Línea con "Datos de la solicitud" encontrada', { 
            line: line.substring(0, 100) + '...',
            logFile 
          });
          try {
            const logEntry = JSON.parse(line);
            logger.info('🔍 Log entry parsed', { 
              metadata_solicitud_id: logEntry.metadata?.solicitud_id,
              buscando_solicitud_id: solicitudId,
              coincide: logEntry.metadata?.solicitud_id === solicitudId
            });
            // Verificar si el solicitud_id en el metadata coincide
            if (logEntry.metadata?.solicitud_id === solicitudId) {
              logger.info('✅ Línea encontrada', { line: line.substring(0, 200) + '...' });
              const payloadStr = logEntry.metadata?.payload;
              if (payloadStr) {
                solicitudData = JSON.parse(payloadStr);
                logger.info('✅ Datos de solicitud encontrados en logs', { 
                  solicitud_id: solicitudId,
                  reemplazantes: solicitudData.reemplazantes?.length || 0
                });
                break;
              }
            }
          } catch (parseError) {
            logger.warn('Error al parsear línea de log', { error: parseError });
          }
        }
      }
      
      if (solicitudData) break;
    }

    if (!solicitudData) {
      logger.warn('No se encontraron datos de la solicitud', { solicitud_id: solicitudId });
      return sendJSON(res, 404, {
        status: 'error',
        message: 'Solicitud no encontrada'
      });
    }

    // Retornar los datos de la solicitud
    return sendJSON(res, 200, {
      status: 'success',
      data: {
        emp_id: solicitudData.emp_id,
        tipo: solicitudData.tipo,
        comentario: solicitudData.comentario,
        manager_id: solicitudData.manager_id,
        detalle: solicitudData.detalle,
        reemplazantes: solicitudData.reemplazantes || []
      }
    });

  } catch (error: any) {
    logger.error('❌ Error al obtener datos de solicitud:', error);
    return sendJSON(res, 500, {
      status: 'error',
      message: 'Error interno del servidor',
      error: error.message
    });
  }
};

export const getVacationDataHandler = asyncHandler(handleGetVacationData);
