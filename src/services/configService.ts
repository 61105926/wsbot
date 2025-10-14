import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger';

/**
 * Configuración del sistema de vacaciones
 */
interface VacationConfig {
  programmedVacationsEnabled: boolean;
  lastUpdated: string;
  updatedBy?: string;
}

const CONFIG_FILE = path.join(__dirname, '../../config/vacation-settings.json');

/**
 * Configuración por defecto
 */
const DEFAULT_CONFIG: VacationConfig = {
  programmedVacationsEnabled: true,
  lastUpdated: new Date().toISOString(),
};

/**
 * Asegurar que existe el directorio de configuración
 */
async function ensureConfigDir() {
  const configDir = path.dirname(CONFIG_FILE);
  try {
    await fs.mkdir(configDir, { recursive: true });
  } catch (error) {
    // Directorio ya existe
  }
}

/**
 * Leer configuración de vacaciones
 */
export async function getVacationConfig(): Promise<VacationConfig> {
  try {
    await ensureConfigDir();
    const data = await fs.readFile(CONFIG_FILE, 'utf-8');
    const config = JSON.parse(data);

    logger.info('Configuración de vacaciones leída', {
      programmedEnabled: config.programmedVacationsEnabled
    });

    return config;
  } catch (error: any) {
    // Si el archivo no existe, crear con valores por defecto
    if (error.code === 'ENOENT') {
      logger.info('Archivo de configuración no existe, creando con valores por defecto');
      await saveVacationConfig(DEFAULT_CONFIG);
      return DEFAULT_CONFIG;
    }

    logger.error('Error al leer configuración de vacaciones', {
      error: error.message
    });

    return DEFAULT_CONFIG;
  }
}

/**
 * Guardar configuración de vacaciones
 */
export async function saveVacationConfig(config: Partial<VacationConfig>): Promise<VacationConfig> {
  try {
    await ensureConfigDir();

    // Leer configuración actual sin recursión
    let currentConfig: VacationConfig;
    try {
      const data = await fs.readFile(CONFIG_FILE, 'utf-8');
      currentConfig = JSON.parse(data);
    } catch {
      currentConfig = DEFAULT_CONFIG;
    }

    // Merge con nueva configuración
    const updatedConfig: VacationConfig = {
      ...currentConfig,
      ...config,
      lastUpdated: new Date().toISOString(),
    };

    // Guardar en archivo
    await fs.writeFile(
      CONFIG_FILE,
      JSON.stringify(updatedConfig, null, 2),
      'utf-8'
    );

    logger.info('Configuración de vacaciones guardada', {
      programmedEnabled: updatedConfig.programmedVacationsEnabled,
      updatedBy: updatedConfig.updatedBy
    });

    return updatedConfig;
  } catch (error: any) {
    logger.error('Error al guardar configuración de vacaciones', {
      error: error.message
    });
    throw new Error('Error al guardar configuración');
  }
}

/**
 * Toggle de vacaciones programadas
 */
export async function toggleProgrammedVacations(): Promise<VacationConfig> {
  const currentConfig = await getVacationConfig();
  return saveVacationConfig({
    programmedVacationsEnabled: !currentConfig.programmedVacationsEnabled
  });
}
