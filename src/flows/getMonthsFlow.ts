import { addKeyword, EVENTS } from "@builderbot/bot";
import axios from "axios";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { API_CONFIG } from "../config/config";
import { TIMEOUTS, PATHS } from "../config/constants";
import { FLOW_MESSAGES } from "../config/flowMessages";
import { MessageBuilderService } from "../services/messageBuilder.service";
import { logger } from "../utils/logger";
import { extractRealPhoneFromContext } from "../utils/phoneHelper";
import {
  getMonthDictionary,
  getStringDate,
  dateToYYYYMM,
  isNumericString,
  buildMonthsList
} from "../utils/flowHelpers";

/**
 * Flow para selección y envío de boletas de pago por mes
 */

const monthsAnswer = `${FLOW_MESSAGES.MONTHS.TITLE}
${buildMonthsList()}
`;

export const getMonthsFlow = addKeyword([EVENTS.ACTION])
  .addAnswer(monthsAnswer)
  .addAction({ capture: true }, async (ctx, { flowDynamic, gotoFlow }) => {
    const input = ctx.body.trim();
    const phoneInfo = await extractRealPhoneFromContext(ctx);

    logger.info('Usuario seleccionando mes', {
      flow: 'getMonths',
      phone: phoneInfo.phone,
      lid: phoneInfo.isRealPhone ? undefined : phoneInfo.lid,
      input
    });

    // Validar entrada
    if (!isNumericString(input)) {
      logger.warn('Entrada inválida en getMonthsFlow', {
        phone: phoneInfo.phone,
        lid: phoneInfo.isRealPhone ? undefined : phoneInfo.lid,
        input
      });

      await flowDynamic([{ body: FLOW_MESSAGES.ERRORS.INVALID_MONTH }]);
      return gotoFlow(getMonthsFlow);
    }

    const monthsDict = getMonthDictionary();

    if (!monthsDict.has(input)) {
      logger.warn('Mes no disponible seleccionado', {
        phone: phoneInfo.phone,
        lid: phoneInfo.isRealPhone ? undefined : phoneInfo.lid,
        input
      });

      await flowDynamic([{ body: FLOW_MESSAGES.ERRORS.INVALID_MONTH }]);
      return gotoFlow(getMonthsFlow);
    }

    // Obtener fecha seleccionada
    const selectedDate = monthsDict.get(input)!;
    const monthCode = dateToYYYYMM(selectedDate);

    logger.info('Descargando boleta para usuario', {
      flow: 'getMonths',
      phone: phoneInfo.phone,
      lid: phoneInfo.isRealPhone ? undefined : phoneInfo.lid,
      month: monthCode
    });

    try {
      // Mensajes variados mientras busca
      const searchingMessages = [
        'Buscando tu boleta... 📄',
        'Déjame buscar tu boleta...',
        'Un momento, buscando...',
        'Buscando, un segundo...',
        'Ya te la busco...'
      ];
      const searchingMessage = searchingMessages[Math.floor(Math.random() * searchingMessages.length)];
      
      // Simular tiempo de escritura
      const typingTime = Math.max(1000, Math.min(3000, searchingMessage.length * 50));
      await new Promise(resolve => setTimeout(resolve, typingTime));
      await flowDynamic([{ body: searchingMessage }]);
      
      // Simular tiempo de búsqueda
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));

      // TEMPORAL: Usar PDF de prueba desde URL externa
      const payslipUrl = 'https://www.edu.xunta.gal/centros/iesastelleiras/?q=system/files/Matriz+de+Valoraci%C3%B3n+de+Exposiciones+Orales.pdf';
      
      // Obtener número desde ctx.remoteJid → viene en phoneInfo.phone (ej: 59177711124)
      // Quitar el 591 → resultado: 77711124
      // let phoneForApi = phoneInfo.phone;
      // if (phoneForApi.startsWith('591')) {
      //   phoneForApi = phoneForApi.substring(3);
      // }

      // Construir URL usando servicio (comentado temporalmente para prueba)
      // const payslipUrl = MessageBuilderService.buildPayslipApiUrl(
      //   API_CONFIG.PAYSLIP_API_BASE,
      //   phoneForApi,
      //   monthCode
      // );

      // Construir nombre de archivo
      const fileName = `${getStringDate(selectedDate)}.pdf`;
      const tmpDir = path.join(__dirname, `../../${PATHS.TMP_DIR}`);
      const tmpPath = path.join(tmpDir, fileName);

      // Asegurar que existe el directorio temporal
      try {
        await fs.mkdir(tmpDir, { recursive: true });
      } catch (e) {
        // Directorio ya existe
      }

      logger.http('Descargando PDF desde URL', {
        url: payslipUrl,
        fileName
      });

      // Descargar PDF con timeout usando stream para evitar cargar todo en memoria
      const writer = fsSync.createWriteStream(tmpPath);
      const pdfResponse = await axios.get(payslipUrl, {
        responseType: 'stream',
        headers: { 'Accept': 'application/pdf' },
        timeout: TIMEOUTS.DOWNLOAD_PDF_TIMEOUT
      });

      // Esperar a que el stream termine de escribir
      await new Promise<void>((resolve, reject) => {
        pdfResponse.data.pipe(writer);
        writer.on('finish', () => {
          logger.info('PDF descargado y guardado exitosamente', {
            fileName,
            path: tmpPath
          });
          resolve();
        });
        writer.on('error', (error: Error) => {
          logger.error('Error al escribir PDF', { error: error.message });
          reject(error);
        });
      });

      // Verificar que el archivo existe y tiene contenido
      const fileStats = await fs.stat(tmpPath);
      if (fileStats.size === 0) {
        throw new Error('El archivo PDF está vacío');
      }

      logger.info('Enviando PDF al usuario', {
        phone: phoneInfo.phone,
        lid: phoneInfo.isRealPhone ? undefined : phoneInfo.lid,
        fileName,
        fileSize: fileStats.size,
        filePath: tmpPath
      });

      // Mensajes de éxito variados
      const successMessages = [
        'Listo, ahí está tu boleta. Cualquier consulta, avísame 👍',
        'Ahí tienes tu boleta. Si necesitas algo más, dime.',
        'Listo, te la envié. Cualquier duda, me avisas.',
        'Ya está, ahí tienes tu boleta. 👍'
      ];
      const successMessage = successMessages[Math.floor(Math.random() * successMessages.length)];
      
      // Delay antes de enviar
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
      
      // Obtener provider para enviar el archivo directamente
      const { connectionStatus } = await import('../services/connectionStatus');
      const provider = connectionStatus.getProvider();
      
      if (!provider) {
        throw new Error('Provider no disponible para enviar el archivo');
      }
      
      // Usar ctx.from directamente (puede ser LID o número real)
      const recipientPhone = ctx.from || phoneInfo.phone;
      
      // Verificar que tmpPath está definido
      if (!tmpPath || typeof tmpPath !== 'string') {
        throw new Error(`tmpPath no está definido o no es válido: ${tmpPath}`);
      }
      
      // Asegurar que tmpPath es una ruta absoluta válida
      const absolutePath = path.resolve(tmpPath);
      
      // Verificar que la ruta es válida
      if (!absolutePath || typeof absolutePath !== 'string' || absolutePath.length === 0) {
        throw new Error(`Ruta de archivo inválida después de resolve: ${absolutePath} (tmpPath original: ${tmpPath})`);
      }
      
      // Verificar que el archivo existe
      try {
        await fs.access(absolutePath);
      } catch (error) {
        throw new Error(`El archivo no existe: ${absolutePath} (tmpPath original: ${tmpPath})`);
      }
      
      logger.debug('Enviando PDF con provider', {
        recipientPhone: recipientPhone,
        filePath: absolutePath,
        tmpPath: tmpPath,
        fileName: fileName,
        exists: true,
        size: fileStats.size,
        hasSendFile: typeof provider.sendFile === 'function',
        hasSendMessage: typeof provider.sendMessage === 'function'
      });
      
      // Intentar usar sendFile si está disponible, sino usar sendMessage
      try {
        if (typeof provider.sendFile === 'function') {
          logger.debug('Usando provider.sendFile', {
            recipientPhone: recipientPhone,
            filePath: absolutePath,
            fileName: fileName
          });
          await provider.sendFile(recipientPhone, absolutePath, { mimetype: 'application/pdf', filename: fileName });
        } else if (typeof provider.sendMessage === 'function') {
          logger.debug('Usando provider.sendMessage con media', {
            recipientPhone: recipientPhone,
            filePath: absolutePath
          });
          await provider.sendMessage(recipientPhone, '', { media: absolutePath });
        } else {
          throw new Error('No se encontró método sendFile ni sendMessage en el provider');
        }
        
        logger.info('PDF enviado exitosamente con provider', {
          recipientPhone: recipientPhone,
          fileName: fileName,
          filePath: absolutePath
        });
      } catch (sendError: any) {
        logger.error('Error al enviar PDF con provider', {
          error: sendError.message,
          errorStack: sendError.stack,
          recipientPhone: recipientPhone,
          filePath: absolutePath,
          tmpPath: tmpPath,
          fileName: fileName
        });
        throw sendError;
      }
      
      // Delay antes del mensaje de confirmación
      await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
      await flowDynamic([{ body: successMessage }]);

      // ✅ CRÍTICO: Limpiar archivo temporal
      try {
        await fs.unlink(tmpPath);
        logger.debug('Archivo temporal eliminado', { path: tmpPath });
      } catch (cleanupError) {
        logger.warn('No se pudo eliminar archivo temporal', {
          path: tmpPath,
          error: cleanupError
        });
      }

      logger.info('Boleta enviada exitosamente', {
        phone: phoneInfo.phone,
        lid: phoneInfo.isRealPhone ? undefined : phoneInfo.lid,
        month: monthCode
      });

    } catch (error: any) {
      logger.error('Error al procesar boleta en flow', {
        flow: 'getMonths',
        phone: phoneInfo.phone,
        lid: phoneInfo.isRealPhone ? undefined : phoneInfo.lid,
        month: monthCode,
        error: error.message || error,
        stack: error.stack
      });

      await flowDynamic([{ body: FLOW_MESSAGES.ERRORS.USER_NOT_FOUND }]);
    }
  });
