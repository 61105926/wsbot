import { Bot } from './bot.interface';
import { getVacationConfig, saveVacationConfig } from '../services/configService';
import { sendJSON, asyncHandler } from '../utils/response';
import { logger } from '../utils/logger';

/**
 * GET /vacation-config
 * Obtiene la configuración actual de vacaciones
 */
const getConfigHandler = async (_bot: Bot, _req: any, res: any) => {
  try {
    logger.http('GET /vacation-config - Obteniendo configuración de vacaciones');

    const config = await getVacationConfig();

    sendJSON(res, 200, {
      success: true,
      data: config,
      message: 'Configuración de vacaciones obtenida'
    });
  } catch (error: any) {
    logger.error('Error en GET /vacation-config', {
      error: error.message,
      stack: error.stack
    });

    sendJSON(res, 500, {
      success: false,
      message: 'Error al obtener configuración de vacaciones'
    });
  }
};

/**
 * POST /vacation-config
 * Actualiza la configuración de vacaciones
 */
const updateConfigHandler = async (_bot: Bot, req: any, res: any) => {
  try {
    const { programmedVacationsEnabled, updatedBy } = req.body;

    logger.http('POST /vacation-config - Actualizando configuración', {
      programmedEnabled: programmedVacationsEnabled,
      updatedBy
    });

    // Validar que el campo existe
    if (typeof programmedVacationsEnabled !== 'boolean') {
      return sendJSON(res, 400, {
        success: false,
        message: 'El campo programmedVacationsEnabled es requerido y debe ser boolean'
      });
    }

    const updatedConfig = await saveVacationConfig({
      programmedVacationsEnabled,
      updatedBy
    });

    sendJSON(res, 200, {
      success: true,
      data: updatedConfig,
      message: 'Configuración actualizada correctamente'
    });
  } catch (error: any) {
    logger.error('Error en POST /vacation-config', {
      error: error.message,
      stack: error.stack
    });

    sendJSON(res, 500, {
      success: false,
      message: 'Error al actualizar configuración de vacaciones'
    });
  }
};

/**
 * POST /vacation-config/toggle
 * Toggle rápido de vacaciones programadas
 */
const toggleConfigHandler = async (_bot: Bot, req: any, res: any) => {
  try {
    const { updatedBy } = req.body;

    logger.http('POST /vacation-config/toggle - Toggle de vacaciones programadas', {
      updatedBy
    });

    const currentConfig = await getVacationConfig();
    const updatedConfig = await saveVacationConfig({
      programmedVacationsEnabled: !currentConfig.programmedVacationsEnabled,
      updatedBy
    });

    sendJSON(res, 200, {
      success: true,
      data: updatedConfig,
      message: `Vacaciones programadas ${updatedConfig.programmedVacationsEnabled ? 'habilitadas' : 'deshabilitadas'}`
    });
  } catch (error: any) {
    logger.error('Error en POST /vacation-config/toggle', {
      error: error.message,
      stack: error.stack
    });

    sendJSON(res, 500, {
      success: false,
      message: 'Error al cambiar configuración de vacaciones'
    });
  }
};

export const getVacationConfigHandler = asyncHandler(getConfigHandler);
export const updateVacationConfigHandler = asyncHandler(updateConfigHandler);
export const toggleVacationConfigHandler = asyncHandler(toggleConfigHandler);
