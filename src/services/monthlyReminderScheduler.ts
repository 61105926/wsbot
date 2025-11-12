import cron from 'node-cron';
import { logger } from '../utils/logger';

let reminderTask: cron.ScheduledTask | null = null;
let processRemindersFn: (() => Promise<void>) | null = null;

/**
 * Inicia el scheduler de recordatorios mensuales
 * Se ejecuta el día 1 de cada mes a las 9:00 AM
 */
export function startMonthlyReminderScheduler(processReminders: () => Promise<void>): void {
  if (reminderTask) {
    logger.warn('⚠️ El scheduler de recordatorios mensuales ya está iniciado');
    return;
  }

  processRemindersFn = processReminders;

  // Ejecutar el día 1 de cada mes a las 9:00 AM
  // Formato cron: minuto hora día mes día-semana
  // '0 9 1 * *' = minuto 0, hora 9, día 1, cualquier mes, cualquier día de la semana
  reminderTask = cron.schedule('0 9 1 * *', async () => {
    logger.info('⏰ Ejecutando recordatorios mensuales programados (día 1 del mes)');
    
    if (processRemindersFn) {
      try {
        await processRemindersFn();
      } catch (error: any) {
        logger.error('❌ Error al ejecutar recordatorios mensuales', {
          error: error.message,
          stack: error.stack
        });
      }
    }
  }, {
    scheduled: true,
    timezone: 'America/La_Paz' // Zona horaria de Bolivia
  });

  logger.info('✅ Scheduler de recordatorios mensuales iniciado (día 1 de cada mes a las 9:00 AM)');
}

/**
 * Detiene el scheduler de recordatorios mensuales
 */
export function stopMonthlyReminderScheduler(): void {
  if (reminderTask) {
    reminderTask.stop();
    reminderTask = null;
    processRemindersFn = null;
    logger.info('⏹️ Scheduler de recordatorios mensuales detenido');
  }
}

/**
 * Ejecuta manualmente los recordatorios (útil para pruebas)
 */
export async function triggerMonthlyReminders(): Promise<void> {
  if (processRemindersFn) {
    logger.info('🔔 Ejecutando recordatorios mensuales manualmente');
    try {
      await processRemindersFn();
    } catch (error: any) {
      logger.error('❌ Error al ejecutar recordatorios mensuales manualmente', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  } else {
    throw new Error('El scheduler no está iniciado');
  }
}

