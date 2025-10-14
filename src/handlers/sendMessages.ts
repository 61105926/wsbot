import { InMemoryQueue } from "../classes/Queue";
import { getAllUsers } from "../services/getAllUsers";
import { Bot } from "./bot.interface";

const wsQueue = InMemoryQueue.instance();

export const sendMessagesHandler = async (bot: Bot, req: any, res: any) => {
  if (!bot) {
    res.end("Lo sentimos no hay un numero conectado al servidor");
    return;
  }

  const { messages }: { messages: string } = req.body;
  const file = req.file;
  try {
    const parsedMessages = JSON.parse(messages);
    if (wsQueue.getActiveCount() > 0) {
      return res.end("Ya existen mensajes en cola.");
    }
    const users = await getAllUsers();
    if (!file) {
      for (const user of users) {
        wsQueue.add(async () => {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          for (const message of parsedMessages) {
            await bot.sendMessage(
              user.phone,
              message.replace("{{link}}", user.linkURL),
              {}
            );
          }
          return;
        });
      }
      res.end("Mensajes añadidos a la cola");
      return;
    }
    for (const user of users) {
      wsQueue.add(async () => {

        // 
        await new Promise((resolve) => setTimeout(resolve, 2000));

        for (let index = 0; index < parsedMessages.length; index++) {
          if (index === 0) {
            await bot.sendMessage(
              user.phone,
              parsedMessages[index].replace("{{link}}", user.linkURL).replace("{{nombre}}", user.fullName),
              { media: req.file.path }
            );
          } else {
            await bot.sendMessage(
              user.phone,
              parsedMessages[index].replace("{{link}}", user.linkURL).replace("{{nombre}}", user.fullName),
              {}
            );
          }
        }
        return;
      });
    }
    res.end("Mensajes añadidos a la cola");
    return;
  } catch (error) {
    console.log(error);
    res.end("Error en el servidor");
  }
};
