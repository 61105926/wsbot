import fs from "fs";
import { Bot } from "./bot.interface";

export const messageHandler = async (bot: Bot, req: any, res: any) => {
  if (!bot) {
    res.end("Lo sentimos no hay un numero conectado al servidor");
    return;
  }
  try {
    const file = req.file;
    const { messages } = req.body;
    const parsedMessages = JSON.parse(messages);
    // if (!file) {
    //   for (const message of parsedMessages) {
    //     await bot.sendMessage("59169997657", message, {});
    //   }
    //   return res.end("send");
    // }
    // for (let index = 0; index < parsedMessages.length; index++) {
    //   if (index === 0) {
    //     await bot.sendMessage("59169997657", parsedMessages[index], {
    //       media: req.file.path,
    //     });
    //   } else {
    //     await bot.sendMessage("59169997657", parsedMessages[index], {});
    //   }
    // }
    fs.unlinkSync(req.file.path);
    return res.end("send");
  } catch (error) {
    console.log(error);
    res.end("Server error");
  }
};
