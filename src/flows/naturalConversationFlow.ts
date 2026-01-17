import { addKeyword, EVENTS } from "@builderbot/bot";
import { GeminiService } from "../services/geminiService";
import { logger } from "../utils/logger";
import { extractRealPhoneFromContext } from "../utils/phoneHelper";
import { getMonthsFlow } from "./getMonthsFlow";
import { vacationRequestFlow } from "./vacationRequestFlow";
import { FRONTEND_CONFIG } from "../config/config";
import { GEMINI_CONFIG } from "../config/config";
import { getAllUsers } from "../services/getAllUsers";
import { MessageBuilderService } from "../services/messageBuilder.service";
import { API_CONFIG } from "../config/config";
import { TIMEOUTS, PATHS } from "../config/constants";
import axios from "axios";
import fs from "fs/promises";
import path from "path";
import { getMonthDictionary, dateToYYYYMM, getStringDate } from "../utils/flowHelpers";
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Delay natural para simular tiempo de escritura de una persona
 * Varía según la longitud del mensaje y agrega aleatoriedad
 */
const naturalDelay = (baseMs: number = 2000, messageLength: number = 0) => {
  // Calcular delay basado en longitud del mensaje (personas escriben ~5 caracteres por segundo)
  const typingDelay = messageLength > 0 ? (messageLength / 5) * 1000 : 0;
  // Delay base + tiempo de escritura + aleatoriedad (20-40% más)
  const totalDelay = baseMs + typingDelay;
  const variance = totalDelay * (0.2 + Math.random() * 0.2); // 20-40% de variación
  const finalDelay = totalDelay + variance;
  
  // Mínimo 1 segundo, máximo 8 segundos (muy natural)
  return new Promise(resolve => setTimeout(resolve, Math.max(1000, Math.min(8000, finalDelay))));
};

/**
 * Delay aleatorio más natural (como pensando antes de responder)
 */
const thinkingDelay = () => {
  // 2 a 5 segundos (tiempo de "pensar" - más realista)
  return new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
};

/**
 * Simula tiempo de escritura basado en longitud del mensaje
 */
const typingSimulation = (messageLength: number) => {
  // Personas escriben aproximadamente 3-7 caracteres por segundo
  const charsPerSecond = 3 + Math.random() * 4;
  const seconds = messageLength / charsPerSecond;
  // Mínimo 0.5s, máximo 5s
  return Math.max(500, Math.min(5000, seconds * 1000));
};

/**
 * Flow conversacional natural que entiende lenguaje natural
 * Se activa en el welcome y también puede ser llamado desde otros flows
 */
export const naturalConversationFlow = addKeyword([EVENTS.WELCOME])
  .addAction(async (ctx, { flowDynamic, gotoFlow }) => {
    const phoneInfo = await extractRealPhoneFromContext(ctx);
    const normalizedPhone = phoneInfo.normalizedPhone || phoneInfo.phone.replace(/^591/, '');
    const userMessage = ctx.body?.trim() || '';
    const userName = ctx.pushName || 'Usuario';

    // Delay natural antes de responder (simular que está "leyendo" el mensaje)
    // Delay más largo para parecer más humano (2-5 segundos)
    await thinkingDelay();

    logger.info('Mensaje recibido en conversación natural', {
      phone: phoneInfo.phone,
      normalizedPhone: normalizedPhone,
      isRealPhone: phoneInfo.isRealPhone,
      message: userMessage,
      userName
    });

    try {
      // Obtener información del usuario si existe
      let userInfo: any = null;
      try {
        const allUsers = await getAllUsers();
        // Usar el número normalizado (sin 591) para buscar
        const searchPhone = normalizedPhone;
        userInfo = allUsers.find(u => 
          u.phone.replace('591', '') === searchPhone ||
          u.phone === phoneInfo.phone ||
          u.phone.replace('591', '') === phoneInfo.phone.replace(/^591/, '')
        );
      } catch (e) {
        // Continuar sin información del usuario
      }

      // Usar Gemini para entender la intención y generar respuesta natural
      if (GEMINI_CONFIG.ENABLED) {
        try {
          // Generar prompt variado para evitar respuestas repetitivas
          const promptVariations = [
            `Eres una persona de Recursos Humanos de MINOIL S.A. en Bolivia, escribiendo por WhatsApp.
${userName} te escribió: "${userMessage}"

${userInfo ? `Conoces a ${userInfo.fullName} (ID: ${userInfo.empID}).` : ''}

Como persona real, analiza qué necesita y responde de forma NATURAL y VARIADA. NUNCA uses frases como "en qué puedo ayudarte" o "cómo puedo ayudarte". Sé conversacional.

INTENCIONES:
- "boleta": quiere su boleta de pago/salario (NO "boleta de vacaciones")
- "vacaciones": quiere solicitar vacaciones o hablar de vacaciones
- "saludo": solo está saludando
- "otro": cualquier otra cosa

RESPONDE SOLO JSON:
{
  "intention": "boleta|vacaciones|saludo|otro",
  "response": "respuesta natural, variada y conversacional (máximo 2 líneas, NUNCA uses 'en qué puedo ayudarte')",
  "month": "mes mencionado o null",
  "year": "año mencionado o 2025"
}

IMPORTANTE: Varía tu respuesta cada vez. Si es saludo, responde como si fueras un compañero de trabajo, no un bot.`,

            `Eres ${userInfo?.fullName ? `el asistente de RRHH que conoce a ${userInfo.fullName}` : 'un asistente de RRHH'} de MINOIL S.A.
${userName} te escribió: "${userMessage}"

Responde como una PERSONA REAL escribiendo por WhatsApp. Sé natural, amigable y VARIADO. Evita frases robóticas.

¿Qué necesita?
- "boleta": boleta de pago (NO de vacaciones)
- "vacaciones": solicitar vacaciones
- "saludo": solo saludo
- "otro": otra cosa

JSON:
{
  "intention": "boleta|vacaciones|saludo|otro",
  "response": "respuesta natural y variada, como persona real (máx 2 líneas)",
  "month": "mes o null",
  "year": "año o 2025"
}

NUNCA uses "en qué puedo ayudarte". Varía tu estilo cada vez.`,

            `Eres un compañero de trabajo de RRHH en MINOIL S.A., Bolivia.
${userName} te escribió: "${userMessage}"

${userInfo ? `Conoces a ${userInfo.fullName}.` : ''}

Responde de forma NATURAL, como si estuvieras chateando por WhatsApp. Sé conversacional y VARIADO.

Detecta:
- "boleta": quiere boleta de pago
- "vacaciones": quiere vacaciones
- "saludo": solo saludo
- "otro": otra cosa

JSON:
{
  "intention": "boleta|vacaciones|saludo|otro",
  "response": "respuesta natural, variada, como persona real (máx 2 líneas, NO uses 'en qué puedo ayudarte')",
  "month": "mes o null",
  "year": "año o 2025"
}

IMPORTANTE: Cada respuesta debe ser diferente. Si es saludo, responde como compañero, no como bot.`
          ];

          const prompt = promptVariations[Math.floor(Math.random() * promptVariations.length)];

          // Verificar que la API key esté configurada
          if (!GEMINI_CONFIG.API_KEY || GEMINI_CONFIG.API_KEY === '' || GEMINI_CONFIG.API_KEY === 'YOUR_GEMINI_API_KEY') {
            throw new Error('API key de Gemini no configurada o inválida');
          }

          logger.debug('Llamando a Gemini API', {
            promptLength: prompt.length,
            hasApiKey: !!GEMINI_CONFIG.API_KEY,
            apiKeyPrefix: GEMINI_CONFIG.API_KEY?.substring(0, 10) + '...'
          });

          let genAI: GoogleGenerativeAI;
          let model: any;
          let result: any;
          let response: any;
          let text: string = '';

          try {
            genAI = new GoogleGenerativeAI(GEMINI_CONFIG.API_KEY);
            
            // Lista de modelos a intentar (en orden de prioridad)
            // Nota: El error indica que los modelos no están en v1beta
            // Probamos con diferentes nombres que pueden funcionar
            const modelNames = [
                'gemini-3-flash-preview',   // Gratis dentro del free tier
                'gemini-2.5-flash',         // Gratis dentro del free tier
                'gemini-2.5-flash-lite',    // Gratis dentro del free tier
                'gemini-2.0-flash',         // Gratis dentro del free tier
                'gemma-3',                  // Modelo abierto, gratis
                'gemma-3n'                  // Variante ligera, gratis
              ];
              
            
            logger.debug('Modelos a intentar', { modelos: modelNames });
            
            let lastError: any = null;
            
            for (const modelName of modelNames) {
              try {
                logger.debug(`Intentando con modelo: ${modelName}`);
                
                // Limpiar el nombre del modelo (remover 'models/' si está presente)
                const cleanModelName = modelName.replace(/^models\//, '');
                
                // Intentar con diferentes configuraciones
                try {
                  // Primero intentar sin especificar versión (usa v1 por defecto)
                  model = genAI.getGenerativeModel({ model: cleanModelName });
                } catch (configError: any) {
                  // Si falla, intentar con configuración explícita
                  logger.warn(`Error al configurar modelo ${cleanModelName}, intentando alternativa`, {
                    error: configError.message
                  });
                  model = genAI.getGenerativeModel({ 
                    model: cleanModelName,
                    // No especificamos versión, deja que use la predeterminada
                  });
                }
                
                result = await model.generateContent(prompt);
                response = await result.response;
                
                // Obtener el texto de la respuesta de forma segura
                let responseText: string = '';
                try {
                  responseText = response.text();
                } catch (textError: any) {
                  logger.warn(`Error al obtener texto de la respuesta`, {
                    error: textError.message,
                    responseType: typeof response,
                    responseKeys: Object.keys(response || {})
                  });
                  responseText = '';
                }
                
                text = responseText ? responseText.trim() : '';
                
                logger.info(`✅ Modelo ${cleanModelName} funcionó correctamente`, {
                  model: cleanModelName,
                  textLength: text.length,
                  textPreview: text.substring(0, 200),
                  rawTextLength: responseText?.length || 0,
                  hasText: !!text
                });
                
                // Si el texto está vacío, continuar con el siguiente modelo
                if (!text || text === '') {
                  logger.warn(`Modelo ${cleanModelName} funcionó pero la respuesta está vacía, intentando siguiente modelo`, {
                    responseText: responseText?.substring(0, 50) || 'null/undefined',
                    responseType: typeof response
                  });
                  lastError = new Error(`Modelo ${cleanModelName} respondió pero el texto está vacío`);
                  continue;
                }
                
                // Si llegamos aquí, el modelo funcionó y tiene texto
                logger.info(`✅✅✅ Modelo ${cleanModelName} funcionó y tiene texto válido`, {
                  textLength: text.length
                });
                break; // Si funciona y tiene texto, salir del loop
              } catch (modelError: any) {
                lastError = modelError;
                
                // Log detallado con el mensaje completo
                const errorMsg = modelError.message || 'Sin mensaje de error';
                const errorCode = modelError.code || 'Sin código';
                const errorStatus = modelError.status || 'Sin status';
                
                logger.warn(`Modelo ${modelName} falló: ${errorMsg}`, {
                  modelo: modelName,
                  mensaje: errorMsg,
                  codigo: errorCode,
                  status: errorStatus,
                  detalles: modelError.details ? JSON.stringify(modelError.details) : null,
                  respuesta: modelError.response?.data ? JSON.stringify(modelError.response.data) : null,
                  stack: modelError.stack?.substring(0, 300) || null
                });
                
                // También mostrar en consola para debugging inmediato
                console.error(`\n❌ [GEMINI ERROR - ${modelName}]`);
                console.error(`   Mensaje: ${errorMsg}`);
                console.error(`   Código: ${errorCode}`);
                console.error(`   Status: ${errorStatus}`);
                if (modelError.details) console.error(`   Detalles:`, modelError.details);
                if (modelError.response?.data) console.error(`   Respuesta API:`, modelError.response.data);
                console.error('');
                
                continue; // Intentar siguiente modelo
              }
            }
            
            // Si todos los modelos fallaron
            if (!text || text === '') {
              const finalError = lastError || new Error('Todos los modelos de Gemini fallaron');
              
              // Log detallado del último error
              const finalErrorMsg = finalError.message || 'Error desconocido';
              const finalErrorCode = (finalError as any).code || 'Sin código';
              const finalErrorStatus = (finalError as any).status || 'Sin status';
              
              logger.error(`Todos los modelos de Gemini fallaron: ${finalErrorMsg}`, {
                error: finalErrorMsg,
                errorName: finalError.name,
                errorCode: finalErrorCode,
                errorStatus: finalErrorStatus,
                errorDetails: JSON.stringify((finalError as any).details || {}),
                errorResponse: JSON.stringify((finalError as any).response?.data || {}),
                apiKeyPrefix: GEMINI_CONFIG.API_KEY?.substring(0, 15) + '...',
                apiKeyLength: GEMINI_CONFIG.API_KEY?.length,
                apiKeyIsValid: !!(GEMINI_CONFIG.API_KEY && GEMINI_CONFIG.API_KEY !== '' && GEMINI_CONFIG.API_KEY !== 'YOUR_GEMINI_API_KEY'),
                stack: finalError.stack?.substring(0, 1000)
              });
              
              // Mostrar error completo en consola
              console.error('\n❌❌❌ TODOS LOS MODELOS DE GEMINI FALLARON ❌❌❌');
              console.error(`   Error: ${finalErrorMsg}`);
              console.error(`   Código: ${finalErrorCode}`);
              console.error(`   Status: ${finalErrorStatus}`);
              if ((finalError as any).details) console.error(`   Detalles:`, (finalError as any).details);
              if ((finalError as any).response?.data) console.error(`   Respuesta API:`, (finalError as any).response.data);
              console.error(`   API Key (prefijo): ${GEMINI_CONFIG.API_KEY?.substring(0, 20)}...`);
              console.error('');
              
              throw finalError;
            }
          } catch (geminiError: any) {
            const errorDetails = {
              error: geminiError.message,
              errorName: geminiError.name,
              errorCode: geminiError.code,
              errorStatus: geminiError.status,
              errorDetails: JSON.stringify(geminiError.details || {}),
              errorResponse: JSON.stringify(geminiError.response?.data || {}),
              errorStatusText: geminiError.response?.statusText,
              apiKeyPrefix: GEMINI_CONFIG.API_KEY?.substring(0, 15) + '...',
              apiKeyLength: GEMINI_CONFIG.API_KEY?.length,
              apiKeyIsValid: !!(GEMINI_CONFIG.API_KEY && GEMINI_CONFIG.API_KEY !== '' && GEMINI_CONFIG.API_KEY !== 'YOUR_GEMINI_API_KEY'),
              stack: geminiError.stack?.substring(0, 1000)
            };
            
            logger.error('Error específico de Gemini API', errorDetails);
            
            // Si es un error de autenticación, dar mensaje más claro
            if (geminiError.message?.includes('API_KEY') || 
                geminiError.message?.includes('401') || 
                geminiError.message?.includes('403') ||
                geminiError.message?.includes('authentication') ||
                geminiError.message?.includes('unauthorized') ||
                geminiError.status === 401 ||
                geminiError.status === 403) {
              throw new Error(`Error de autenticación con Gemini API. Verifica que la API key sea válida y tenga permisos. Error: ${geminiError.message}`);
            }
            
            // Si es un error de cuota, dar mensaje específico
            if (geminiError.message?.includes('quota') || 
                geminiError.message?.includes('429') ||
                geminiError.status === 429) {
              throw new Error(`Cuota de Gemini API excedida. Error: ${geminiError.message}`);
            }
            
            throw new Error(`Error de Gemini API: ${geminiError.message || 'Error desconocido'}`);
          }

          // Parsear respuesta JSON
          let parsedResponse: any;
          try {
            // Limpiar el texto para extraer solo el JSON
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              parsedResponse = JSON.parse(jsonMatch[0]);
            } else {
              throw new Error('No se encontró JSON en la respuesta');
            }
          } catch (e) {
            logger.warn('Error al parsear respuesta de Gemini, usando fallback', { text });
            // Fallback variado y natural
            const fallbackGreetings = [
              'Hola, ¿qué tal?',
              'Hola, ¿qué necesitas?',
              'Buenos días, ¿en qué te ayudo?',
              'Hola, dime qué necesitas',
              'Buenos días, ¿qué puedo hacer por ti?'
            ];
            parsedResponse = { 
              intention: 'otro', 
              response: fallbackGreetings[Math.floor(Math.random() * fallbackGreetings.length)]
            };
          }

          // Simular tiempo de escritura basado en longitud del mensaje
          const responseLength = parsedResponse.response.length;
          const typingTime = typingSimulation(responseLength);
          
          // Delay antes de responder (pensando + escribiendo)
          await naturalDelay(typingTime, responseLength);
          
          await flowDynamic([{ body: parsedResponse.response }]);

          // Manejar la intención con delays naturales
          if (parsedResponse.intention === 'boleta') {
            await thinkingDelay(); // Simular que está "buscando"
            
            // Si se mencionó un mes específico, intentar obtenerlo directamente
            if (parsedResponse.month) {
              const monthNames: Record<string, string> = {
                'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
                'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
                'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
              };
              
              const monthNum = monthNames[parsedResponse.month.toLowerCase()];
              if (monthNum) {
                const year = parsedResponse.year || '2025';
                const monthCode = `${year}${monthNum}`;

                // Enviar boleta directamente
                await sendPayslipDirectly(ctx, phoneInfo, monthCode, flowDynamic);
              } else {
                // Mes no reconocido, mostrar lista
                await gotoFlow(getMonthsFlow);
              }
            } else {
              // Si no se mencionó mes, mostrar lista de meses
              await gotoFlow(getMonthsFlow);
            }
          } else if (parsedResponse.intention === 'vacaciones') {
            await thinkingDelay(); // Simular que está "preparando" el enlace
            
            // Generar mensaje natural para vacaciones con variaciones
            try {
              const genAI = new GoogleGenerativeAI(GEMINI_CONFIG.API_KEY);
              const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
              
              // Variaciones de prompts para hacer mensajes más diversos
              const vacationPrompts = [
                `Eres un asistente de RRHH. ${userName} quiere solicitar vacaciones. Responde de forma natural y amigable (como persona real) ofreciendo el enlace. Máximo 2 líneas. Varía el estilo.`,
                `Como asistente de RRHH, ${userName} necesita solicitar vacaciones. Escribe un mensaje natural y casual ofreciendo el enlace. Máximo 2 líneas.`,
                `${userName} quiere pedir vacaciones. Responde como una persona real de RRHH, amigable y profesional. Ofrece el enlace. Máximo 2 líneas.`
              ];
              
              const randomPrompt = vacationPrompts[Math.floor(Math.random() * vacationPrompts.length)];
              const result = await model.generateContent(randomPrompt);
              const response = await result.response;
              const vacationMessage = response.text().trim();
              
              const typingTime = typingSimulation(vacationMessage.length);
              await naturalDelay(typingTime, vacationMessage.length);
              await flowDynamic([{ body: vacationMessage }]);
              await thinkingDelay();
            } catch (e: any) {
              logger.warn('Error al generar mensaje de vacaciones con Gemini, usando fallback', {
                error: e.message,
                errorCode: e.code
              });
              // Fallback con variaciones
              const fallbackMessages = [
                'Perfecto, te envío el enlace para que completes tu solicitud de vacaciones.',
                'Claro, aquí está el enlace para tu solicitud de vacaciones.',
                'Te paso el enlace para que completes tu solicitud. 👍'
              ];
              const fallbackMessage = fallbackMessages[Math.floor(Math.random() * fallbackMessages.length)];
              const typingTime = typingSimulation(fallbackMessage.length);
              await naturalDelay(typingTime, fallbackMessage.length);
              await flowDynamic([{ body: fallbackMessage }]);
              await thinkingDelay();
            }
            
            await gotoFlow(vacationRequestFlow);
          }
          // Si es saludo u otro, ya se respondió naturalmente

        } catch (error: any) {
          logger.error('Error en conversación natural con Gemini', {
            error: error.message,
            errorName: error.name,
            errorCode: error.code,
            errorStatus: error.status,
            stack: error.stack,
            phone: phoneInfo.phone,
            userMessage: userMessage,
            userName: userName,
            geminiEnabled: GEMINI_CONFIG.ENABLED,
            hasApiKey: !!GEMINI_CONFIG.API_KEY,
            apiKeyLength: GEMINI_CONFIG.API_KEY?.length || 0,
            apiKeyPrefix: GEMINI_CONFIG.API_KEY?.substring(0, 10) || 'N/A'
          });
          
          // Fallback: intentar entender el mensaje de forma simple con respuestas variadas
          const lowerMessage = userMessage.toLowerCase();
          
          // Respuestas variadas para saludo genérico
          const genericGreetings = [
            `Hola ${userName}, ¿qué tal?`,
            `Hola, ¿qué necesitas?`,
            `Buenos días ${userName}, ¿en qué te ayudo?`,
            `Hola, dime qué necesitas`,
            `Buenos días, ¿qué puedo hacer por ti?`,
            `Hola ${userName}, ¿qué pasa?`
          ];
          let fallbackResponse = genericGreetings[Math.floor(Math.random() * genericGreetings.length)];
          
          // Verificar primero si es sobre vacaciones (tiene prioridad sobre boleta)
          if (lowerMessage.includes('vacacion') || lowerMessage.includes('día') || lowerMessage.includes('dias') || 
              lowerMessage.includes('boleta de vacacion') || lowerMessage.includes('boleta vacacion')) {
            const vacationResponses = [
              'Perfecto, te envío el enlace para que completes tu solicitud de vacaciones.',
              'Claro, aquí está el enlace para tu solicitud de vacaciones.',
              'Te paso el enlace para que completes tu solicitud. 👍',
              'Listo, aquí tienes el enlace para solicitar tus vacaciones.'
            ];
            fallbackResponse = vacationResponses[Math.floor(Math.random() * vacationResponses.length)];
            const typingTime = typingSimulation(fallbackResponse.length);
            await naturalDelay(typingTime, fallbackResponse.length);
            await flowDynamic([{ body: fallbackResponse }]);
            await thinkingDelay();
            await gotoFlow(vacationRequestFlow);
            return;
          } 
          // Luego verificar si es boleta de pago (solo si no es de vacaciones)
          else if ((lowerMessage.includes('boleta') && !lowerMessage.includes('vacacion')) || 
                   lowerMessage.includes('pago') || lowerMessage.includes('sueldo') || lowerMessage.includes('salario')) {
            const payslipResponses = [
              'Claro, te ayudo con tu boleta de pago. ¿De qué mes la necesitas?',
              'Perfecto, ¿de qué mes necesitas tu boleta?',
              'Te ayudo con eso. ¿Qué mes buscas?',
              'Claro, dime de qué mes es la boleta que necesitas.'
            ];
            fallbackResponse = payslipResponses[Math.floor(Math.random() * payslipResponses.length)];
            const typingTime = typingSimulation(fallbackResponse.length);
            await naturalDelay(typingTime, fallbackResponse.length);
            await flowDynamic([{ body: fallbackResponse }]);
            await thinkingDelay();
            await gotoFlow(getMonthsFlow);
            return;
          }
          
          // Si es solo saludo, responder de forma variada
          if (lowerMessage.match(/^(hola|buenos días|buenas tardes|buenas noches|hi|hello)$/i)) {
            const greetingResponses = [
              `Hola ${userName}, ¿qué tal?`,
              `Buenos días ${userName}, ¿en qué te ayudo?`,
              `Hola, ¿qué necesitas?`,
              `Buenos días, ¿qué puedo hacer por ti?`,
              `Hola ${userName}, dime qué necesitas`
            ];
            fallbackResponse = greetingResponses[Math.floor(Math.random() * greetingResponses.length)];
          }
          
          const typingTime = typingSimulation(fallbackResponse.length);
          await naturalDelay(typingTime, fallbackResponse.length);
          await flowDynamic([{ body: fallbackResponse }]);
        }
      } else {
        // Si Gemini no está habilitado, responder de forma simple pero natural y variada
        const simpleGreetings = [
          `Hola ${userName}, ¿qué tal?`,
          `Hola, ¿qué necesitas?`,
          `Buenos días ${userName}, ¿en qué te ayudo?`,
          `Hola, ¿qué pasa?`,
          `Buenos días, ¿qué puedo hacer por ti?`,
          `Hola ${userName}, dime qué necesitas`,
          `Hola, ¿en qué te puedo ayudar?`
        ];
        const greeting = simpleGreetings[Math.floor(Math.random() * simpleGreetings.length)];
        const typingTime = typingSimulation(greeting.length);
        await naturalDelay(typingTime, greeting.length);
        await flowDynamic([{ body: greeting }]);
      }

    } catch (error: any) {
      logger.error('Error en naturalConversationFlow', {
        error: error.message,
        phone: phoneInfo.phone
      });

      // Respuesta de error variada
      const errorGreetings = [
        'Hola, ¿qué tal?',
        'Hola, ¿qué necesitas?',
        'Buenos días, ¿en qué te ayudo?',
        'Hola, dime qué necesitas'
      ];
      const errorGreeting = errorGreetings[Math.floor(Math.random() * errorGreetings.length)];
      const typingTime = typingSimulation(errorGreeting.length);
      await naturalDelay(typingTime, errorGreeting.length);
      await flowDynamic([{ body: errorGreeting }]);
    }
  });

/**
 * Función auxiliar para enviar boleta directamente
 */
async function sendPayslipDirectly(
  ctx: any,
  phoneInfo: any,
  monthCode: string,
  flowDynamic: any
) {
  try {
    await flowDynamic([{ body: 'Buscando tu boleta... 📄' }]);
    await naturalDelay(2000);

    const phoneForApi = phoneInfo.isRealPhone ? phoneInfo.phone : phoneInfo.lid;
    const payslipUrl = MessageBuilderService.buildPayslipApiUrl(
      API_CONFIG.PAYSLIP_API_BASE,
      phoneForApi,
      monthCode
    );

    const fileName = `${monthCode}.pdf`;
    const tmpDir = path.join(__dirname, `../../${PATHS.TMP_DIR}`);
    const tmpPath = path.join(tmpDir, fileName);

    await fs.mkdir(tmpDir, { recursive: true });

    const { data: pdfData } = await axios.get(payslipUrl, {
      responseType: 'arraybuffer',
      headers: { 'Accept': 'application/pdf' },
      timeout: TIMEOUTS.DOWNLOAD_PDF_TIMEOUT
    });

    await fs.writeFile(tmpPath, pdfData);

    // Mensajes variados después de enviar
    const successMessages = [
      'Listo, ahí está tu boleta. Cualquier consulta, avísame 👍',
      'Ahí tienes tu boleta. Si necesitas algo más, dime.',
      'Listo, te la envié. Cualquier duda, me avisas.',
      'Ya está, ahí tienes tu boleta. 👍',
      'Listo, ahí está. Si tienes alguna pregunta, avísame.'
    ];
    const successMessage = successMessages[Math.floor(Math.random() * successMessages.length)];
    
    // Delay antes de enviar el PDF (simular que está "preparando")
    await thinkingDelay();
    await flowDynamic([{ media: tmpPath }]);
    
    // Delay antes del mensaje de confirmación
    const typingTime = typingSimulation(successMessage.length);
    await naturalDelay(typingTime, successMessage.length);
    await flowDynamic([{ body: successMessage }]);

    // Limpiar archivo
    try {
      await fs.unlink(tmpPath);
    } catch (e) {
      // Ignorar error de limpieza
    }

  } catch (error: any) {
    logger.error('Error al enviar boleta directamente', {
      error: error.message,
      monthCode
    });

    // Mensajes de error variados y naturales
    const errorMessages = [
      'Lo siento, no pude encontrar tu boleta. ¿Puedes decirme el mes específico que necesitas?',
      'Uy, no encontré tu boleta. ¿Me puedes decir de qué mes la necesitas?',
      'No pude encontrarla. ¿De qué mes es la boleta que buscas?',
      'No la encontré. ¿Puedes especificar el mes?'
    ];
    const errorMessage = errorMessages[Math.floor(Math.random() * errorMessages.length)];
    const typingTime = typingSimulation(errorMessage.length);
    await naturalDelay(typingTime, errorMessage.length);
    await flowDynamic([{ body: errorMessage }]);
  }
}
