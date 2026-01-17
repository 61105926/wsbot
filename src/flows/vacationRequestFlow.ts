import { addKeyword, EVENTS } from "@builderbot/bot";
import { FLOW_MESSAGES } from "../config/flowMessages";
import { FRONTEND_CONFIG } from "../config/config";
import { GEMINI_CONFIG } from "../config/config";
import { logger } from "../utils/logger";
import { extractRealPhoneFromContext } from "../utils/phoneHelper";
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Delays naturales para simular comportamiento humano
 */
const naturalDelay = (baseMs: number = 2000, messageLength: number = 0) => {
  const typingDelay = messageLength > 0 ? (messageLength / 5) * 1000 : 0;
  const totalDelay = baseMs + typingDelay;
  const variance = totalDelay * (0.2 + Math.random() * 0.2);
  const finalDelay = totalDelay + variance;
  return new Promise(resolve => setTimeout(resolve, Math.max(1000, Math.min(8000, finalDelay))));
};

const thinkingDelay = () => {
  return new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 2500));
};

const typingSimulation = (messageLength: number) => {
  const charsPerSecond = 3 + Math.random() * 4;
  const seconds = messageLength / charsPerSecond;
  return Math.max(500, Math.min(5000, seconds * 1000));
};

/**
 * Flow para solicitud de vacaciones
 * Envía un link al frontend con solo el teléfono codificado en base64
 */
export const vacationRequestFlow = addKeyword([EVENTS.ACTION])
  .addAction(async (ctx, { flowDynamic }) => {
    const phoneInfo = await extractRealPhoneFromContext(ctx);
    const normalizedPhone = phoneInfo.normalizedPhone || phoneInfo.phone.replace(/^591/, '');

    logger.info('Usuario solicitando vacaciones', {
      flow: 'vacationRequest',
      phone: phoneInfo.phone,
      normalizedPhone: normalizedPhone,
      lid: phoneInfo.isRealPhone ? undefined : phoneInfo.lid
    });

    try {
      // Usar el número normalizado (sin 591) para las APIs
      const phoneNumber = String(normalizedPhone);
      // Codificar el teléfono en base64
      const encodedPhone = Buffer.from(phoneNumber).toString('base64');

      // Construir URL con teléfono codificado
      const frontendUrl = `${FRONTEND_CONFIG.BASE_URL}${FRONTEND_CONFIG.VACATION_REQUEST}?data=${encodedPhone}`;

      logger.info('URL de vacaciones generada', {
        phone: phoneInfo.phone,
        normalizedPhone: normalizedPhone,
        lid: phoneInfo.isRealPhone ? undefined : phoneInfo.lid,
        phoneNumber: phoneNumber,
        encodedPhone: encodedPhone,
        urlLength: frontendUrl.length
      });

      // Generar mensaje natural y variado para el enlace
      let vacationMessage = '';
      
      if (GEMINI_CONFIG.ENABLED) {
        try {
          const genAI = new GoogleGenerativeAI(GEMINI_CONFIG.API_KEY);
          const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
          
          const prompts = [
            `Eres RRHH. Envía este enlace de forma natural: ${frontendUrl}. Escribe un mensaje amigable de 2 líneas máximo.`,
            `Como RRHH, comparte este enlace de vacaciones de forma casual: ${frontendUrl}. Máximo 2 líneas.`,
            `Envía este enlace de solicitud de vacaciones de forma natural: ${frontendUrl}. Mensaje corto y amigable.`
          ];
          
          const prompt = prompts[Math.floor(Math.random() * prompts.length)];
          const result = await model.generateContent(prompt);
          const response = await result.response;
          vacationMessage = response.text().trim().replace(frontendUrl, frontendUrl); // Asegurar que el URL esté
        } catch (e) {
          // Fallback
          vacationMessage = `Perfecto, aquí está el enlace para completar tu solicitud:\n\n${frontendUrl}`;
        }
      } else {
        // Fallback sin Gemini con variaciones
        const messages = [
          `Perfecto, aquí está el enlace para completar tu solicitud:\n\n${frontendUrl}`,
          `Te envío el enlace para tu solicitud de vacaciones:\n\n${frontendUrl}`,
          `Aquí tienes el enlace para completar tu solicitud:\n\n${frontendUrl}`
        ];
        vacationMessage = messages[Math.floor(Math.random() * messages.length)];
      }
      
      // Simular tiempo de escritura
      const typingTime = typingSimulation(vacationMessage.length);
      await thinkingDelay(); // Simular que está "preparando" el enlace
      await naturalDelay(typingTime, vacationMessage.length);
      
      await flowDynamic([{ body: vacationMessage }]);

      logger.info('Link de vacaciones enviado exitosamente', {
        phone: phoneInfo.phone,
        lid: phoneInfo.isRealPhone ? undefined : phoneInfo.lid
      });

    } catch (error: any) {
      logger.error('Error al procesar solicitud de vacaciones', {
        flow: 'vacationRequest',
        phone: phoneInfo.phone,
        lid: phoneInfo.isRealPhone ? undefined : phoneInfo.lid,
        error: error.message || error,
        stack: error.stack
      });

      await flowDynamic([{
        body: FLOW_MESSAGES.VACATION.ERROR
      }]);
    }
  });
