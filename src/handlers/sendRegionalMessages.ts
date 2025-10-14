import { getUsersByRegions } from "../services/getUsersByRegion";
import { Bot } from "./bot.interface";
import { connectionStatus } from "../services/connectionStatus";
import { sendSuccess, asyncHandler } from "../utils/response";
import { validateDTO, SendRegionalMessagesDTO } from "../dto/request.dto";
import { bulkMessageService } from "../services/bulkMessage.service";
import { MessageBuilderService } from "../services/messageBuilder.service";
import { TIMEOUTS, ERROR_MESSAGES, SUCCESS_MESSAGES } from "../config/constants";
import { BotNotAvailableError, WhatsAppNotConnectedError, QueueBusyError, NotFoundError } from "../errors/CustomErrors";
import { logger, loggers } from "../utils/logger";
import { UserWithRegional } from "../dto/models.dto";

const handler = async (bot: Bot, req: any, res: any) => {
  // Validar que el bot esté disponible
  if (!bot) {
    throw new BotNotAvailableError();
  }

  // Verificar conexión de WhatsApp
  if (!connectionStatus.isConnected()) {
    throw new WhatsAppNotConnectedError();
  }

  // Validar datos de entrada
  const { messages, regions } = validateDTO(SendRegionalMessagesDTO, req.body);
  const file = req.file;

  logger.info("Iniciando envío de mensajes regionales", {
    regions,
    totalMessages: messages.length,
    hasFile: !!file
  });

  // Verificar si ya hay un proceso activo
  if (bulkMessageService.isProcessing()) {
    throw new QueueBusyError();
  }

  // Obtener usuarios de las regionales seleccionadas
  const users = await getUsersByRegions(regions);

  if (users.length === 0) {
    throw new NotFoundError(ERROR_MESSAGES.NO_USERS_IN_REGION);
  }

  loggers.batchStarted(users.length, 'mensajes regionales');

  // Procesar lote de usuarios
  await bulkMessageService.processBatch<UserWithRegional>(
    users,
    async (user: UserWithRegional) => {
      logger.info(`Procesando mensajes para ${user.fullName} (${user.regional})`);

      // Enviar cada mensaje
      for (let index = 0; index < messages.length; index++) {
        const message = MessageBuilderService.replaceVariables(messages[index], {
          nombre: user.fullName,
          link: user.linkURL
        });

        // Si es el primer mensaje y hay archivo, enviarlo con el archivo
        if (index === 0 && file) {
          await bulkMessageService.sendWithTimeout(
            () => bot.sendMessage(user.phone, message, { media: file.path }),
            TIMEOUTS.SEND_MESSAGE_TIMEOUT
          );
        } else {
          await bulkMessageService.sendWithTimeout(
            () => bot.sendMessage(user.phone, message, {}),
            TIMEOUTS.SEND_MESSAGE_TIMEOUT
          );
        }
      }

      loggers.messageSent(user, 'mensajes regionales');
    },
    {
      batchName: 'mensajes regionales'
    }
  );

  // Responder al cliente
  sendSuccess(res, {
    message: SUCCESS_MESSAGES.BULK_SEND_STARTED,
    totalUsers: users.length,
    regions
  });
};

export const sendRegionalMessagesHandler = asyncHandler(handler);
