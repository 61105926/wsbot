import { AdvancedQueue } from "../classes/AdvancedQueue";
import { TIMEOUTS } from "../config/constants";
import { TimeoutError } from "../errors/CustomErrors";
import { logger } from "../utils/logger";

/**
 * Servicio centralizado para envío masivo de mensajes
 */
export class BulkMessageService {
  private static instance: BulkMessageService;
  private queue: AdvancedQueue;

  private constructor() {
    this.queue = AdvancedQueue.instance();
  }

  static getInstance(): BulkMessageService {
    if (!BulkMessageService.instance) {
      BulkMessageService.instance = new BulkMessageService();
    }
    return BulkMessageService.instance;
  }

  /**
   * Genera delay aleatorio para evitar bloqueos
   */
  private async delayRandom(base: number, variance: number): Promise<void> {
    const randomDelay = Math.floor(Math.random() * variance) + base;
    await new Promise((resolve) => setTimeout(resolve, randomDelay));
  }

  /**
   * Ejecuta una promesa con timeout
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage: string = 'Timeout al enviar mensaje'
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new TimeoutError(errorMessage)), timeoutMs)
      )
    ]);
  }

  /**
   * Procesa un lote de usuarios enviando mensajes
   */
  async processBatch<T>(
    users: T[],
    messageHandler: (user: T) => Promise<void>,
    options?: {
      delayBase?: number;
      delayVariance?: number;
      batchName?: string;
    }
  ): Promise<void> {
    const {
      delayBase = TIMEOUTS.MESSAGE_DELAY_BASE,
      delayVariance = TIMEOUTS.MESSAGE_DELAY_VARIANCE,
      batchName = 'mensajes'
    } = options || {};

    logger.info(`Iniciando procesamiento de lote`, {
      totalUsers: users.length,
      batchName
    });

    // Iniciar batch en la cola
    this.queue.startBatch(users.length);

    // Agregar tareas a la cola
    for (const user of users) {
      this.queue.add(async () => {
        // Delay aleatorio entre usuarios
        await this.delayRandom(delayBase, delayVariance);

        try {
          // Ejecutar handler del mensaje
          await messageHandler(user);
        } catch (error: any) {
          // Loggear error pero continuar con siguientes usuarios
          logger.error('Error procesando usuario en lote', {
            error: error.message || error,
            stack: error.stack
          });
        }
      });
    }
  }

  /**
   * Envía un mensaje con timeout y retry
   */
  async sendWithTimeout(
    sendFunction: () => Promise<any>,
    timeoutMs: number = TIMEOUTS.SEND_MESSAGE_TIMEOUT,
    retries: number = 0
  ): Promise<void> {
    let lastError: any;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        await this.withTimeout(sendFunction(), timeoutMs);
        return; // Éxito
      } catch (error) {
        lastError = error;

        if (attempt < retries) {
          logger.warn(`Reintentando envío (intento ${attempt + 1}/${retries})`, {
            error: error instanceof Error ? error.message : error
          });

          // Delay antes de reintentar
          await this.delayRandom(2000, 1000);
        }
      }
    }

    // Si llegamos aquí, todos los reintentos fallaron
    throw lastError;
  }

  /**
   * Obtiene el progreso actual
   */
  getProgress() {
    return this.queue.getProgress();
  }

  /**
   * Verifica si hay un proceso activo
   */
  isProcessing(): boolean {
    return this.queue.isProcessing();
  }
}

export const bulkMessageService = BulkMessageService.getInstance();
