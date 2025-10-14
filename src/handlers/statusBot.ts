import { Bot } from "./bot.interface";
import { connectionStatus } from "../services/connectionStatus";
import { sendJSON, asyncHandler } from "../utils/response";

const handler = async (_bot: Bot, _req: any, res: any) => {
  const isConnected = connectionStatus.isConnected();

  sendJSON(res, 200, {
    status: "ok",
    connected: isConnected,
    timestamp: new Date().toISOString()
  });
};

export const statusBotHandler = asyncHandler(handler);
