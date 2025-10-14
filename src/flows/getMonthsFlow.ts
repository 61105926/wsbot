import { addKeyword, EVENTS } from "@builderbot/bot";
import axios from "axios";
import fs from "fs/promises";
import path from "path";
import { API_CONFIG } from "../config/config";
import { TIMEOUTS, PATHS } from "../config/constants";
import { FLOW_MESSAGES } from "../config/flowMessages";
import { MessageBuilderService } from "../services/messageBuilder.service";
import { logger } from "../utils/logger";
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

    logger.info('Usuario seleccionando mes', {
      flow: 'getMonths',
      phone: ctx.from,
      input
    });

    // Validar entrada
    if (!isNumericString(input)) {
      logger.warn('Entrada inválida en getMonthsFlow', {
        phone: ctx.from,
        input
      });

      await flowDynamic([{ body: FLOW_MESSAGES.ERRORS.INVALID_MONTH }]);
      return gotoFlow(getMonthsFlow);
    }

    const monthsDict = getMonthDictionary();

    if (!monthsDict.has(input)) {
      logger.warn('Mes no disponible seleccionado', {
        phone: ctx.from,
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
      phone: ctx.from,
      month: monthCode
    });

    try {
      await flowDynamic([{ body: FLOW_MESSAGES.PROMPTS.SENDING_DOCUMENT }]);

      // Construir URL usando servicio
      const payslipUrl = MessageBuilderService.buildPayslipApiUrl(
        API_CONFIG.PAYSLIP_API_BASE,
        ctx.from,
        monthCode
      );

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

      logger.http('Descargando PDF desde API', {
        url: payslipUrl,
        fileName
      });

      // Descargar PDF con timeout
      const { data: pdfData } = await axios.get(payslipUrl, {
        responseType: 'arraybuffer',
        headers: { 'Accept': 'application/pdf' },
        timeout: TIMEOUTS.DOWNLOAD_PDF_TIMEOUT
      });

      // Guardar temporalmente
      await fs.writeFile(tmpPath, pdfData);

      logger.info('Enviando PDF al usuario', {
        phone: ctx.from,
        fileName
      });

      // Enviar documento
      await flowDynamic([{ media: tmpPath }]);

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
        phone: ctx.from,
        month: monthCode
      });

    } catch (error: any) {
      logger.error('Error al procesar boleta en flow', {
        flow: 'getMonths',
        phone: ctx.from,
        month: monthCode,
        error: error.message || error,
        stack: error.stack
      });

      await flowDynamic([{ body: FLOW_MESSAGES.ERRORS.USER_NOT_FOUND }]);
    }
  });
