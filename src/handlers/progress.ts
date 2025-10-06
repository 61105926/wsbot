import { AdvancedQueue } from "../classes/AdvancedQueue";
import { Bot } from "./bot,interface";

const queue = AdvancedQueue.instance();

export const progressHandler = async (bot: Bot, req: any, res: any) => {
  try {
    const progress = queue.getProgress();

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(progress));
  } catch (error) {
    console.error("❌ Error en progress:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Error en el servidor" }));
  }
};
