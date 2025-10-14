import { getRegionales } from "../services/getRegionales";
import { Bot } from "./bot.interface";
import { sendSuccess, asyncHandler } from "../utils/response";

const handler = async (_bot: Bot, _req: any, res: any) => {
  const regionales = await getRegionales();

  sendSuccess(res, { regionales });
};

export const regionalesHandler = asyncHandler(handler);
