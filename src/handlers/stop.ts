import { InMemoryQueue } from "../classes/Queue";

const wsQueue = InMemoryQueue.instance();

export const stopHandler = async (bot: any, req: any, res: any) => {
  wsQueue.stopActiveTask();
  res.end("tareas eliminadas exitosamente");
};
