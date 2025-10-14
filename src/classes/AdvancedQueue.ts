type TaskFunction<T> = () => Promise<T>;

interface QueueItem<T> {
  task: TaskFunction<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
  id: string;
}

interface ProgressData {
  batchId: string | null;
  total: number;
  completed: number;
  failed: number;
  pending: number;
  percentage: number;
  isActive: boolean;
  isPaused: boolean;
  isCancelled: boolean;
}

export class AdvancedQueue<T = any> {
  private static _instance: AdvancedQueue<any>;
  private queue: QueueItem<T>[] = [];
  private activeJob: QueueItem<T> | null = null;
  private processing = false;
  private paused = false;
  private cancelled = false;
  private batchId: string | null = null;
  private totalTasks = 0;
  private completedTasks = 0;
  private failedTasks = 0;

  public static instance(): AdvancedQueue {
    if (!AdvancedQueue._instance) {
      AdvancedQueue._instance = new AdvancedQueue();
    }
    return AdvancedQueue._instance;
  }

  // Agregar tarea a la cola
  add(task: TaskFunction<T>, id?: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const itemId = id || `task_${Date.now()}_${Math.random()}`;
      this.queue.push({ task, resolve, reject, id: itemId });

      if (!this.processing && !this.paused && !this.cancelled) {
        this.processQueue().catch((err) =>
          console.error("Error processing queue:", err)
        );
      }
    });
  }

  // Iniciar un nuevo lote de tareas
  startBatch(taskCount: number): string {
    this.batchId = `batch_${Date.now()}`;
    this.totalTasks = taskCount;
    this.completedTasks = 0;
    this.failedTasks = 0;
    this.paused = false;
    this.cancelled = false;
    return this.batchId;
  }

  // Procesar la cola
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    if (this.paused || this.cancelled) return;

    this.processing = true;
    this.activeJob = this.queue.shift() as QueueItem<T>;

    try {
      const result = await this.activeJob.task();
      this.activeJob.resolve(result);
      this.completedTasks++;
    } catch (error) {
      this.activeJob.reject(error);
      this.failedTasks++;
      console.error("Task failed:", error);
    } finally {
      this.activeJob = null;
      this.processing = false;

      // Si fue cancelado, limpiar la cola
      if (this.cancelled) {
        this.queue = [];
        return;
      }

      // Continuar procesando si no está pausado o cancelado
      if (this.queue.length > 0 && !this.paused && !this.cancelled) {
        this.processQueue().catch((err) =>
          console.error("Error processing queue:", err)
        );
      } else if (this.queue.length === 0 && this.totalTasks > 0) {
        // Batch completado, limpiar estado
        console.log(`✅ Batch ${this.batchId} completado: ${this.completedTasks}/${this.totalTasks} exitosos, ${this.failedTasks} fallidos`);

        // Liberar memoria después de completar el batch
        if (global.gc) {
          setTimeout(() => {
            global.gc!();
            console.log("🗑️ Memoria limpiada después de completar batch");
          }, 1000);
        }
      }
    }
  }

  // Pausar el procesamiento
  pause(): void {
    this.paused = true;
    console.log("✋ Queue paused");
  }

  // Reanudar el procesamiento
  resume(): void {
    if (!this.paused) return;

    this.paused = false;
    console.log("▶️ Queue resumed");

    if (this.queue.length > 0 && !this.processing) {
      this.processQueue().catch((err) =>
        console.error("Error processing queue:", err)
      );
    }
  }

  // Cancelar todo el procesamiento
  cancel(): void {
    this.cancelled = true;
    this.paused = false;
    this.queue = [];
    console.log("❌ Queue cancelled");
  }

  // Reset completo del estado
  reset(): void {
    this.queue = [];
    this.activeJob = null;
    this.processing = false;
    this.paused = false;
    this.cancelled = false;
    this.batchId = null;
    this.totalTasks = 0;
    this.completedTasks = 0;
    this.failedTasks = 0;
    console.log("🧹 Queue reset");

    // Forzar garbage collection si está disponible
    if (global.gc) {
      global.gc();
      console.log("🗑️ Garbage collection ejecutado");
    }
  }

  // Obtener datos de progreso
  getProgress(): ProgressData {
    const pending = this.queue.length + (this.activeJob ? 1 : 0);
    const percentage = this.totalTasks > 0
      ? Math.round((this.completedTasks / this.totalTasks) * 100)
      : 0;

    return {
      batchId: this.batchId,
      total: this.totalTasks,
      completed: this.completedTasks,
      failed: this.failedTasks,
      pending: pending,
      percentage: percentage,
      isActive: this.processing || this.queue.length > 0,
      isPaused: this.paused,
      isCancelled: this.cancelled
    };
  }

  // Obtener el número de tareas activas
  getActiveCount(): number {
    return this.activeJob ? this.queue.length + 1 : this.queue.length;
  }

  // Obtener el número de tareas en espera
  getWaitingCount(): number {
    return this.queue.length;
  }

  // Verificar si está pausado
  isPaused(): boolean {
    return this.paused;
  }

  // Verificar si está cancelado
  isCancelled(): boolean {
    return this.cancelled;
  }

  // Verificar si está procesando
  isProcessing(): boolean {
    return this.processing || this.queue.length > 0;
  }
}
