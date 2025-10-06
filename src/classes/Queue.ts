type TaskFunction<T> = () => Promise<T>;

interface QueueItem<T> {
  task: TaskFunction<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
}

export class InMemoryQueue<T = any> {
  private static _instance: InMemoryQueue<any>;
  private queue: QueueItem<T>[] = [];
  private activeJob: QueueItem<T> | null = null;
  private processing = false;

  public static instance(): InMemoryQueue {
    if (!InMemoryQueue._instance) {
      InMemoryQueue._instance = new InMemoryQueue();
    }
    return InMemoryQueue._instance;
  }

  // Agregar tarea a la cola
  add(task: TaskFunction<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.processQueue().catch((err) =>
        console.error("Error processing queue:", err)
      );
    });
  }

  // Procesar la cola
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    this.activeJob = this.queue.shift() as QueueItem<T>;

    try {
      const result = await this.activeJob.task();
      this.activeJob.resolve(result);
    } catch (error) {
      this.activeJob.reject(error);
    } finally {
      this.activeJob = null;
      this.processing = false;
      if (this.queue.length > 0) {
        this.processQueue().catch((err) =>
          console.error("Error processing queue:", err)
        );
      }
    }
  }

  // Obtener el número de tareas activas
  getActiveCount(): number {
    return this.activeJob ? this.queue.length + 1 : 0;
  }

  // Obtener el número de tareas en espera
  getWaitingCount(): number {
    return this.queue.length;
  }

  // Detener la tarea activa (si es posible)
  stopActiveTask(): void {
    if (this.activeJob) {
      // Aquí podrías implementar una lógica para cancelar la tarea si es cancelable
      this.queue = [];
      this.activeJob = null;
      this.processing = false;
    }
  }
}
