import { AdvancedQueue } from "../classes/AdvancedQueue";
import { Bot } from "./bot,interface";

const queue = AdvancedQueue.instance();

// Handler para pausar
export const pauseHandler = async (bot: Bot, req: any, res: any) => {
  try {
    queue.pause();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        message: "Envío pausado",
        status: "paused"
      })
    );
  } catch (error) {
    console.error("❌ Error en pause:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Error en el servidor" }));
  }
};

// Handler para reanudar
export const resumeHandler = async (bot: Bot, req: any, res: any) => {
  try {
    queue.resume();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        message: "Envío reanudado",
        status: "resumed"
      })
    );
  } catch (error) {
    console.error("❌ Error en resume:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Error en el servidor" }));
  }
};

// Handler para cancelar
export const cancelHandler = async (bot: Bot, req: any, res: any) => {
  try {
    queue.cancel();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        message: "Envío cancelado",
        status: "cancelled"
      })
    );
  } catch (error) {
    console.error("❌ Error en cancel:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Error en el servidor" }));
  }
};

// Handler para resetear
export const resetHandler = async (bot: Bot, req: any, res: any) => {
  try {
    queue.reset();
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        message: "Estado reseteado",
        status: "reset"
      })
    );
  } catch (error) {
    console.error("❌ Error en reset:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Error en el servidor" }));
  }
};
