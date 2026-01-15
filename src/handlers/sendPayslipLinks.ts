import { getAllUsers } from "../services/getAllUsers";
import { Bot } from "./bot.interface";
import { connectionStatus } from "../services/connectionStatus";
import { sendSuccess, asyncHandler } from "../utils/response";
import { validateDTO, SendPayslipLinksDTO } from "../dto/request.dto";
import { bulkMessageService } from "../services/bulkMessage.service";
import { MessageBuilderService } from "../services/messageBuilder.service";
import { API_CONFIG } from "../config/config";
import { TIMEOUTS, ERROR_MESSAGES, SUCCESS_MESSAGES, PATHS } from "../config/constants";
import { BotNotAvailableError, WhatsAppNotConnectedError, QueueBusyError, NotFoundError } from "../errors/CustomErrors";
import { logger, loggers } from "../utils/logger";
import { User } from "../dto/models.dto";
import axios from "axios";
import fs from "fs";
import path from "path";

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
  const { month } = validateDTO(SendPayslipLinksDTO, req.body);

  loggers.batchStarted(0, `boletas ${month}`);

  // Verificar si ya hay un proceso activo
  if (bulkMessageService.isProcessing()) {
    throw new QueueBusyError();
  }

  // Obtener todos los usuarios
  const users = await getAllUsers();

  if (users.length === 0) {
    throw new NotFoundError(ERROR_MESSAGES.NO_USERS_FOUND);
  }

  loggers.batchStarted(users.length, `boletas ${month}`);

  // Procesar lote de usuarios
  await bulkMessageService.processBatch<User>(
    users,
    async (user: User) => {
      logger.info(`Procesando boleta para ${user.fullName}`);

      // Construir URL de API
      const payslipUrl = MessageBuilderService.buildPayslipApiUrl(
        API_CONFIG.PAYSLIP_API_BASE,
        user.phone,
        month
      );

      // Construir nombre de archivo
      const fileName = MessageBuilderService.buildPayslipFileName(user, month);

      // Construir mensaje (ahora es async porque usa Gemini)
      const message = await MessageBuilderService.buildPayslipMessage(user, month);

      // Descargar PDF usando streams para no cargar todo en memoria
      logger.http(`Descargando PDF desde: ${payslipUrl}`);

      const tmpDir = path.join(__dirname, `../../${PATHS.TMP_DIR}`);
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }

      const pdfPath = path.join(tmpDir, fileName);

      // Usar stream para descargar y guardar directamente
      const writer = fs.createWriteStream(pdfPath);
      const pdfResponse = await axios.get(payslipUrl, {
        responseType: 'stream',
        timeout: TIMEOUTS.DOWNLOAD_PDF_TIMEOUT
      });

      await new Promise<void>((resolve, reject) => {
        pdfResponse.data.pipe(writer);
        writer.on('finish', () => resolve());
        writer.on('error', reject);
      });

      // Enviar mensaje con PDF
      await bulkMessageService.sendWithTimeout(
        () => bot.sendMessage(user.phone, message, { media: pdfPath }),
        TIMEOUTS.SEND_DOCUMENT_TIMEOUT
      );

      // Eliminar archivo temporal inmediatamente después de enviar
      try {
        if (fs.existsSync(pdfPath)) {
          fs.unlinkSync(pdfPath);
          logger.debug(`Archivo temporal eliminado: ${fileName}`);
        }
      } catch (e) {
        logger.warn(`No se pudo eliminar archivo temporal: ${fileName}`, e);
      }

      loggers.messageSent(user, 'boleta');
    },
    {
      batchName: 'boletas'
    }
  );

  // Responder al cliente
  sendSuccess(res, {
    message: SUCCESS_MESSAGES.PAYSLIP_SEND_STARTED,
    month,
    totalUsers: users.length
  });
};

export const sendPayslipLinksHandler = asyncHandler(handler);
