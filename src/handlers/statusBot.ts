import { Bot } from "./bot,interface";
import { connectionStatus } from "../services/connectionStatus";

export const statusBotHandler = async (bot: Bot, req: any, res: any) => {
  try {
    // Verificar si el bot está conectado usando el connectionStatus
    const isConnected = connectionStatus.isConnected();

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        connected: isConnected,
        timestamp: new Date().toISOString()
      })
    );
  } catch (error) {
    console.error("❌ Error en statusBot:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Error en el servidor", connected: false }));
  }
};
