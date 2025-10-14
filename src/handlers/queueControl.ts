import { AdvancedQueue } from "../classes/AdvancedQueue";
import { Bot } from "./bot.interface";
import { sendSuccess, asyncHandler } from "../utils/response";
import { SUCCESS_MESSAGES } from "../config/constants";

const queue = AdvancedQueue.instance();

// Handler para pausar
const pauseHandlerInternal = async (_bot: Bot, _req: any, res: any) => {
  queue.pause();
  sendSuccess(res, {
    message: SUCCESS_MESSAGES.QUEUE_PAUSED,
    status: "paused"
  });
};

// Handler para reanudar
const resumeHandlerInternal = async (_bot: Bot, _req: any, res: any) => {
  queue.resume();
  sendSuccess(res, {
    message: SUCCESS_MESSAGES.QUEUE_RESUMED,
    status: "resumed"
  });
};

// Handler para cancelar
const cancelHandlerInternal = async (_bot: Bot, _req: any, res: any) => {
  queue.cancel();
  sendSuccess(res, {
    message: SUCCESS_MESSAGES.QUEUE_CANCELLED,
    status: "cancelled"
  });
};

// Handler para resetear
const resetHandlerInternal = async (_bot: Bot, _req: any, res: any) => {
  queue.reset();
  sendSuccess(res, {
    message: SUCCESS_MESSAGES.QUEUE_RESET,
    status: "reset"
  });
};

// Exportar handlers con manejo de errores
export const pauseHandler = asyncHandler(pauseHandlerInternal);
export const resumeHandler = asyncHandler(resumeHandlerInternal);
export const cancelHandler = asyncHandler(cancelHandlerInternal);
export const resetHandler = asyncHandler(resetHandlerInternal);
