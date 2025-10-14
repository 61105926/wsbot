import fs from 'fs';
import path from 'path';
import { PATHS } from '../config/constants';
import { logger } from '../utils/logger';

/**
 * Servicio para limpiar archivos temporales antiguos
 */
export class TmpCleanupService {
  private static instance: TmpCleanupService;
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): TmpCleanupService {
    if (!TmpCleanupService.instance) {
      TmpCleanupService.instance = new TmpCleanupService();
    }
    return TmpCleanupService.instance;
  }

  /**
   * Inicia la limpieza automática de archivos temporales
   * @param intervalMinutes Intervalo en minutos entre limpiezas (por defecto 30 minutos)
   * @param maxAgeMinutes Edad máxima de archivos en minutos (por defecto 60 minutos)
   */
  startAutoCleanup(intervalMinutes: number = 30, maxAgeMinutes: number = 60): void {
    if (this.cleanupInterval) {
      logger.warn('Auto-limpieza ya está activa');
      return;
    }

    logger.info(`Iniciando auto-limpieza de archivos temporales cada ${intervalMinutes} minutos`);

    // Ejecutar limpieza inmediatamente
    this.cleanupOldFiles(maxAgeMinutes);

    // Programar limpiezas periódicas
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldFiles(maxAgeMinutes);
    }, intervalMinutes * 60 * 1000);
  }

  /**
   * Detiene la limpieza automática
   */
  stopAutoCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('Auto-limpieza de archivos temporales detenida');
    }
  }

  /**
   * Limpia archivos temporales antiguos
   * @param maxAgeMinutes Edad máxima de archivos en minutos
   */
  cleanupOldFiles(maxAgeMinutes: number = 60): void {
    try {
      const tmpDir = path.join(__dirname, `../../${PATHS.TMP_DIR}`);

      if (!fs.existsSync(tmpDir)) {
        return;
      }

      const now = Date.now();
      const maxAgeMs = maxAgeMinutes * 60 * 1000;
      const files = fs.readdirSync(tmpDir);

      let deletedCount = 0;
      let freedSpace = 0;

      for (const file of files) {
        const filePath = path.join(tmpDir, file);
        const stats = fs.statSync(filePath);

        // Si el archivo es más viejo que la edad máxima
        if (now - stats.mtimeMs > maxAgeMs) {
          try {
            const size = stats.size;
            fs.unlinkSync(filePath);
            deletedCount++;
            freedSpace += size;
            logger.debug(`Archivo temporal antiguo eliminado: ${file}`);
          } catch (error) {
            logger.warn(`No se pudo eliminar archivo temporal: ${file}`, error);
          }
        }
      }

      if (deletedCount > 0) {
        const freedSpaceMB = (freedSpace / (1024 * 1024)).toFixed(2);
        logger.info(`Limpieza completada: ${deletedCount} archivos eliminados, ${freedSpaceMB}MB liberados`);

        // Forzar garbage collection si está disponible
        if (global.gc) {
          global.gc();
        }
      }
    } catch (error) {
      logger.error('Error en limpieza de archivos temporales', error);
    }
  }

  /**
   * Elimina todos los archivos del directorio temporal
   */
  cleanupAllFiles(): void {
    try {
      const tmpDir = path.join(__dirname, `../../${PATHS.TMP_DIR}`);

      if (!fs.existsSync(tmpDir)) {
        return;
      }

      const files = fs.readdirSync(tmpDir);
      let deletedCount = 0;

      for (const file of files) {
        try {
          const filePath = path.join(tmpDir, file);
          fs.unlinkSync(filePath);
          deletedCount++;
        } catch (error) {
          logger.warn(`No se pudo eliminar archivo: ${file}`, error);
        }
      }

      logger.info(`Limpieza total completada: ${deletedCount} archivos eliminados`);

      // Forzar garbage collection si está disponible
      if (global.gc) {
        global.gc();
      }
    } catch (error) {
      logger.error('Error en limpieza total de archivos temporales', error);
    }
  }
}

export const tmpCleanupService = TmpCleanupService.getInstance();
