import { logger } from '../utils/logger';

interface PendingNotification {
  emp_id: string;
  manager_id: string;
  manager_phone: string;
  nombreEmpleado: string;
  fechas: Array<{ fecha: string; turno: string }>;
  comentario: string;
  managerPhoneBase64: string;
  timestamp: number;
}

class VacationNotificationQueue {
  private pendingNotifications: Map<string, PendingNotification> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private readonly DEBOUNCE_TIME = 15000; // 15 segundos para agrupar notificaciones (aumentado para dar más tiempo)
  private processing: Set<string> = new Set(); // Para evitar procesamiento concurrente

  /**
   * Agrega una notificación a la cola de agrupación
   * Si hay otra notificación pendiente del mismo empleado, la agrupa
   */
  addNotification(
    emp_id: string,
    manager_id: string,
    manager_phone: string,
    nombreEmpleado: string,
    fecha: string,
    turno: string,
    comentario: string,
    managerPhoneBase64: string,
    sendCallback: (notification: PendingNotification) => Promise<void>
  ): void {
    const key = `${emp_id}-${manager_id}`;
    const now = Date.now();
    
    // Procesar inmediatamente - la lógica interna maneja la agrupación
    this._addNotificationInternal(key, emp_id, manager_id, manager_phone, nombreEmpleado, fecha, turno, comentario, managerPhoneBase64, sendCallback, now);
  }
  
  private _addNotificationInternal(
    key: string,
    emp_id: string,
    manager_id: string,
    manager_phone: string,
    nombreEmpleado: string,
    fecha: string,
    turno: string,
    comentario: string,
    managerPhoneBase64: string,
    sendCallback: (notification: PendingNotification) => Promise<void>,
    now: number
  ): void {

    // Si ya hay una notificación pendiente, agregar esta fecha a la lista
    if (this.pendingNotifications.has(key)) {
      const existing = this.pendingNotifications.get(key)!;
      
      // Verificar si la fecha ya existe para evitar duplicados
      const fechaExiste = existing.fechas.some(f => f.fecha === fecha);
      if (!fechaExiste) {
        existing.fechas.push({ fecha, turno });
        existing.timestamp = now;
        
        logger.info('📦 Agrupando notificación de vacación programada', {
          emp_id,
          total_fechas: existing.fechas.length,
          fechas: existing.fechas.map(f => f.fecha),
          nueva_fecha: fecha
        });
      } else {
        logger.info('⚠️ Fecha ya existe en la notificación pendiente, ignorando duplicado', {
          emp_id,
          fecha,
          total_fechas: existing.fechas.length
        });
        return; // No hacer nada más si la fecha ya existe
      }

      // Reiniciar el timer para dar más tiempo a que lleguen más solicitudes
      if (this.timers.has(key)) {
        clearTimeout(this.timers.get(key)!);
        logger.info('⏱️ Timer reiniciado, esperando más solicitudes', {
          emp_id,
          tiempo_restante: `${this.DEBOUNCE_TIME / 1000} segundos`
        });
      }
    } else {
      // Crear nueva notificación pendiente
      this.pendingNotifications.set(key, {
        emp_id,
        manager_id,
        manager_phone,
        nombreEmpleado,
        fechas: [{ fecha, turno }],
        comentario,
        managerPhoneBase64,
        timestamp: now
      });

      logger.info('📝 Nueva notificación de vacación programada agregada a la cola', {
        emp_id,
        fecha,
        esperando_mas: true
      });
    }

    // Programar el envío después del tiempo de debounce
    // Cancelar cualquier timer existente primero
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key)!);
    }
    
    const timer = setTimeout(async () => {
      const notification = this.pendingNotifications.get(key);
      if (notification) {
        logger.info('⏰ Tiempo de espera completado, enviando notificación consolidada', {
          emp_id,
          total_fechas: notification.fechas.length,
          fechas: notification.fechas.map(f => f.fecha)
        });

        // Enviar la notificación consolidada
        await sendCallback(notification);

        // Limpiar
        this.pendingNotifications.delete(key);
        this.timers.delete(key);
        
        logger.info('✅ Notificación consolidada enviada y limpiada de la cola', {
          emp_id,
          total_fechas: notification.fechas.length
        });
      }
    }, this.DEBOUNCE_TIME);

    this.timers.set(key, timer);
    
    logger.info('⏱️ Timer programado para notificación consolidada', {
      emp_id,
      tiempo_espera: `${this.DEBOUNCE_TIME / 1000} segundos`,
      total_fechas_pendientes: this.pendingNotifications.get(key)?.fechas.length || 0
    });
  }

  /**
   * Limpia todas las notificaciones pendientes (útil para testing o reset)
   */
  clear(): void {
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
    this.pendingNotifications.clear();
  }
}

export const vacationNotificationQueue = new VacationNotificationQueue();

