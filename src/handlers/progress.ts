import { AdvancedQueue } from "../classes/AdvancedQueue";
import { Bot } from "./bot.interface";
import { sendJSON, asyncHandler } from "../utils/response";

const queue = AdvancedQueue.instance();

const handler = async (_bot: Bot, _req: any, res: any) => {
  const progress = queue.getProgress();
  sendJSON(res, 200, progress);
};

export const progressHandler = asyncHandler(handler);
