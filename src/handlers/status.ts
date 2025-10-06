
import { InMemoryQueue } from "../classes/Queue";

const wsQueue = InMemoryQueue.instance();

export const statusHandler = async (bot:any, req:any, res:any) => {
    try {
      const jobs = wsQueue.getActiveCount();
      res.end(`Mensajes en cola ${String(jobs)}`);
    } catch (error) {
      console.error("Error obteniendo el estado de los trabajos:", error);
      res.end("Error obteniendo el estado de los trabajos");
    }
  }