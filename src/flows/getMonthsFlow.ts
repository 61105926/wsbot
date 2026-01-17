import { addKeyword, EVENTS } from "@builderbot/bot";
import axios from "axios";
import fs from "fs/promises";
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
    const normalizedPhone = phoneInfo.normalizedPhone || phoneInfo.phone.replace(/^591/, '');

    logger.info('Usuario seleccionando mes', {
      flow: 'getMonths',
      phone: phoneInfo.phone,
      normalizedPhone: normalizedPhone,
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

    // Obtener número desde ctx.remoteJid (viene en phoneInfo.phone) y quitar el 591
    // Ejemplo: 59177711124 -> 77711124
    let phoneForApi = phoneInfo.phone;
    if (phoneForApi.startsWith('591')) {
      phoneForApi = phoneForApi.substring(3);
    }

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
      
      logger.info('Construyendo URL de boleta', {
        phone: phoneInfo.phone,
        phoneForApi: phoneForApi,
        monthCode: monthCode
      });
      
      const payslipUrl = MessageBuilderService.buildPayslipApiUrl(
        API_CONFIG.PAYSLIP_API_BASE,
        phoneForApi,
        monthCode
      );
      
      logger.info('URL de boleta construida exitosamente', {
        url: payslipUrl,
        phoneForApi: phoneForApi
      });

      // Construir nombre de archivo
      const fileName = `${getStringDate(selectedDate)}.pdf`;
      const tmpDir = path.resolve(__dirname, `../../${PATHS.TMP_DIR}`);
      const tmpPath = path.resolve(tmpDir, fileName);

      // Asegurar que existe el directorio temporal
      try {
        await fs.mkdir(tmpDir, { recursive: true });
      } catch (e) {
        // Directorio ya existe
      }

      logger.http('Descargando PDF desde API', {
        url: payslipUrl,
        fileName,
        tmpPath: tmpPath,
        phoneForApi: phoneForApi
      });

      // Descargar PDF con timeout
      const { data: pdfData } = await axios.get(payslipUrl, {
        responseType: 'arraybuffer',
        headers: { 'Accept': 'application/pdf' },
        timeout: TIMEOUTS.DOWNLOAD_PDF_TIMEOUT
      });

      logger.info('PDF descargado exitosamente', {
        size: pdfData.length,
        fileName,
        tmpPath: tmpPath
      });

      // Guardar temporalmente
      await fs.writeFile(tmpPath, pdfData);
      
      // Verificar que el archivo se guardó correctamente
      const fileStats = await fs.stat(tmpPath);
      logger.info('Archivo guardado correctamente', {
        path: tmpPath,
        size: fileStats.size,
        exists: true
      });

      logger.info('Enviando PDF al usuario', {
        phone: phoneInfo.phone,
        lid: phoneInfo.isRealPhone ? undefined : phoneInfo.lid,
        fileName,
        tmpPath: tmpPath
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
      
      // Enviar PDF usando la ruta absoluta
      // Verificar que el archivo existe antes de enviarlo
      const fileExists = await fs.access(tmpPath).then(() => true).catch(() => false);
      
      if (!fileExists) {
        throw new Error(`El archivo no existe: ${tmpPath}`);
      }
      
      logger.debug('Enviando archivo', {
        media: tmpPath,
        pathType: typeof tmpPath,
        pathLength: tmpPath.length,
        fileExists: fileExists,
        isAbsolute: path.isAbsolute(tmpPath)
      });
      
      // Usar ctx.from directamente (puede ser LID o número real)
      // El provider de SendWave puede manejar ambos formatos
      const recipientPhone = ctx.from || phoneInfo.phone;
      
      // Usar el provider directamente para enviar el archivo (más confiable que flowDynamic)
      const { connectionStatus } = await import('../services/connectionStatus');
      const provider = connectionStatus.getProvider();
      
      let messageSent = false;
      
      if (provider) {
        try {
          const fileStats = await fs.stat(tmpPath);
          logger.info('Enviando PDF', {
            recipientPhone: recipientPhone,
            phoneInfoPhone: phoneInfo.phone,
            tmpPath: tmpPath,
            fileExists: fileExists,
            fileSize: fileStats.size,
            isAbsolute: path.isAbsolute(tmpPath),
            hasProviderSendMessage: typeof provider.sendMessage === 'function',
            hasVendorSendMessage: provider.vendor && typeof provider.vendor.sendMessage === 'function'
          });
          
          // Intentar primero con provider.sendMessage
          if (typeof provider.sendMessage === 'function') {
            logger.debug('Intentando enviar con provider.sendMessage');
            const sendResult = await provider.sendMessage(recipientPhone, '', { media: tmpPath });
            logger.info('PDF enviado exitosamente con provider.sendMessage', {
              recipientPhone: recipientPhone,
              result: sendResult ? 'OK' : 'No result'
            });
            messageSent = true;
          } 
          // Si no funciona, intentar con vendor.sendMessage
          else if (provider.vendor && typeof provider.vendor.sendMessage === 'function') {
            logger.debug('Intentando enviar con provider.vendor.sendMessage');
            const sendResult = await provider.vendor.sendMessage(recipientPhone, '', { media: tmpPath });
            logger.info('PDF enviado exitosamente con vendor.sendMessage', {
              recipientPhone: recipientPhone,
              result: sendResult ? 'OK' : 'No result'
            });
            messageSent = true;
          } else {
            throw new Error('No se encontró método sendMessage en provider ni vendor');
          }
        } catch (sendError: any) {
          logger.error('Error al enviar PDF', {
            error: sendError.message,
            errorCode: sendError.code,
            stack: sendError.stack,
            recipientPhone: recipientPhone,
            tmpPath: tmpPath
          });
          throw sendError; // Re-lanzar para que se capture en el catch principal
        }
      } else {
        // Fallback: usar flowDynamic (puede fallar con archivos)
        logger.warn('Provider no disponible, usando flowDynamic', {
          tmpPath: tmpPath
        });
        
        try {
          await flowDynamic([{ media: tmpPath }]);
          messageSent = true;
        } catch (flowError: any) {
          logger.error('Error al enviar PDF con flowDynamic', {
            error: flowError.message,
            stack: flowError.stack,
            tmpPath: tmpPath
          });
          throw flowError;
        }
      }
      
      // Solo continuar si el mensaje se envió correctamente
      if (messageSent) {
        // Delay antes del mensaje de confirmación
        await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));
        await flowDynamic([{ body: successMessage }]);
      }

      // ✅ CRÍTICO: Limpiar archivo temporal SOLO después de enviar
      // Esperar un poco más para asegurar que el envío se complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      
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
        phoneForApi: phoneInfo.phone.startsWith('591') ? phoneInfo.phone.substring(3) : phoneInfo.phone,
        month: monthCode,
        error: error.message || error,
        errorCode: error.code,
        errorStatus: error.response?.status,
        errorData: error.response?.data,
        stack: error.stack
      });

      await flowDynamic([{ body: FLOW_MESSAGES.ERRORS.USER_NOT_FOUND }]);
    }
  });
