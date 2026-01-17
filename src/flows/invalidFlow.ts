import { addKeyword, EVENTS } from "@builderbot/bot";
import { FLOW_MESSAGES } from "../config/flowMessages";
import { logger } from "../utils/logger";
import { extractRealPhoneFromContext } from "../utils/phoneHelper";
import { naturalConversationFlow } from "./naturalConversationFlow";
import { GEMINI_CONFIG } from "../config/config";
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Delay natural para simular tiempo de escritura de una persona
 */
const naturalDelay = (baseMs: number = 2000, messageLength: number = 0) => {
  const typingDelay = messageLength > 0 ? (messageLength / 5) * 1000 : 0;
  const totalDelay = baseMs + typingDelay;
  const variance = totalDelay * (0.2 + Math.random() * 0.2);
  const finalDelay = totalDelay + variance;
  return new Promise(resolve => setTimeout(resolve, Math.max(1000, Math.min(8000, finalDelay))));
};

const thinkingDelay = () => {
  // 2 a 5 segundos (más realista)
  return new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
};

const typingSimulation = (messageLength: number) => {
  const charsPerSecond = 3 + Math.random() * 4;
  const seconds = messageLength / charsPerSecond;
  return Math.max(500, Math.min(5000, seconds * 1000));
};

/**
 * Flow para manejar opciones inválidas o mensajes no reconocidos
 * Ahora usa Gemini para entender el mensaje y responder naturalmente
 */
export const invalidFlow = addKeyword(EVENTS.ACTION).addAction(
  async (ctx, { flowDynamic, gotoFlow, endFlow }) => {
    const phoneInfo = await extractRealPhoneFromContext(ctx);
    const userMessage = ctx.body?.trim() || '';
    const userName = ctx.pushName || 'Usuario';
    
    logger.info('Mensaje no reconocido, usando conversación natural', {
      flow: 'invalid',
      phone: phoneInfo.phone,
      normalizedPhone: phoneInfo.normalizedPhone,
      message: userMessage
    });

    // Si el mensaje está vacío o es muy corto, responder simple
    if (!userMessage || userMessage.length < 2) {
      const greetings = [
        'Hola, ¿en qué puedo ayudarte?',
        'Hola, ¿qué necesitas?',
        'Buenos días, ¿en qué te ayudo?',
        'Hola, ¿qué tal?'
      ];
      const greeting = greetings[Math.floor(Math.random() * greetings.length)];
      const typingTime = typingSimulation(greeting.length);
      await naturalDelay(typingTime, greeting.length);
      await flowDynamic([{ body: greeting }]);
      return endFlow();
    }

    // Usar Gemini para entender y responder
    if (GEMINI_CONFIG.ENABLED) {
      try {
        await thinkingDelay(); // Simular que está "pensando"

        // Prompts variados para evitar respuestas repetitivas
        const promptVariations = [
          `Eres una persona de RRHH de MINOIL S.A., Bolivia, escribiendo por WhatsApp.
${userName} te escribió: "${userMessage}"

Responde como PERSONA REAL. Sé natural, variado y conversacional. NUNCA uses "en qué puedo ayudarte".

INTENCIONES:
- "boleta": quiere boleta de pago
- "vacaciones": quiere vacaciones
- "saludo": solo saludo
- "pregunta": tiene pregunta
- "otro": otra cosa

JSON:
{
  "intention": "boleta|vacaciones|saludo|pregunta|otro",
  "response": "respuesta natural y variada (máx 2 líneas, NO uses 'en qué puedo ayudarte')",
  "month": "mes o null",
  "year": "año o 2025"
}

Varía tu respuesta cada vez.`,

          `Eres compañero de RRHH en MINOIL S.A.
${userName} escribió: "${userMessage}"

Responde naturalmente, como persona real. Varía tu estilo.

- "boleta": boleta de pago
- "vacaciones": vacaciones
- "saludo": saludo
- "pregunta": pregunta
- "otro": otra cosa

JSON:
{
  "intention": "boleta|vacaciones|saludo|pregunta|otro",
  "response": "respuesta natural, variada (máx 2 líneas)",
  "month": "mes o null",
  "year": "año o 2025"
}

NUNCA uses "en qué puedo ayudarte". Sé conversacional.`
        ];
        
        const prompt = promptVariations[Math.floor(Math.random() * promptVariations.length)];

        const genAI = new GoogleGenerativeAI(GEMINI_CONFIG.API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text().trim();

        let parsedResponse: any;
        try {
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsedResponse = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('No se encontró JSON');
          }
        } catch (e) {
          // Fallback variado
          const fallbackGreetings = [
            'Hola, ¿qué tal?',
            'Hola, ¿qué necesitas?',
            'Buenos días, ¿en qué te ayudo?',
            'Hola, dime qué necesitas'
          ];
          parsedResponse = { 
            intention: 'otro', 
            response: fallbackGreetings[Math.floor(Math.random() * fallbackGreetings.length)]
          };
        }

        // Simular tiempo de escritura
        const typingTime = typingSimulation(parsedResponse.response.length);
        await naturalDelay(typingTime, parsedResponse.response.length);
        await flowDynamic([{ body: parsedResponse.response }]);

        // Manejar intención con delays naturales
        if (parsedResponse.intention === 'boleta') {
          await thinkingDelay(); // Simular que está "buscando"
          const { getMonthsFlow } = await import('./getMonthsFlow');
          await gotoFlow(getMonthsFlow);
        } else if (parsedResponse.intention === 'vacaciones') {
          await thinkingDelay(); // Simular que está "preparando"
          const { vacationRequestFlow } = await import('./vacationRequestFlow');
          await gotoFlow(vacationRequestFlow);
        }

      } catch (error: any) {
        logger.error('Error en invalidFlow con Gemini', { error: error.message });
        const fallbackMessages = [
          'Hola, ¿qué tal?',
          'Hola, ¿qué necesitas?',
          'Buenos días, ¿en qué te ayudo?',
          'Hola, dime qué necesitas',
          '¿Qué puedo hacer por ti?'
        ];
        const fallbackMessage = fallbackMessages[Math.floor(Math.random() * fallbackMessages.length)];
        const typingTime = typingSimulation(fallbackMessage.length);
        await naturalDelay(typingTime, fallbackMessage.length);
        await flowDynamic([{ body: fallbackMessage }]);
      }
    } else {
      // Fallback sin Gemini con variaciones
      const fallbackMessages = [
        'No entendí bien. ¿Puedes ser más específico?',
        'Disculpa, ¿puedes repetir?',
        'No estoy seguro de qué necesitas. ¿Puedes explicarme?'
      ];
      const fallbackMessage = fallbackMessages[Math.floor(Math.random() * fallbackMessages.length)];
      const typingTime = typingSimulation(fallbackMessage.length);
      await naturalDelay(typingTime, fallbackMessage.length);
      await flowDynamic([{ body: fallbackMessage }]);
    }

    return endFlow();
  }
);
