import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '../utils/logger';
import { GEMINI_CONFIG } from '../config/config';

// Inicializar Gemini con la API key
const genAI = new GoogleGenerativeAI(GEMINI_CONFIG.API_KEY);

/**
 * Servicio para generar mensajes naturales usando Gemini AI
 * Hace que los mensajes parezcan escritos por una persona real
 */
export class GeminiService {
  private static model = genAI.getGenerativeModel({ model: 'gemini-pro' });

  /**
   * Genera un mensaje natural y personalizado para boletas de pago
   */
  static async generatePayslipMessage(
    userName: string,
    monthName: string,
    year: string,
    userInfo?: {
      regional?: string;
      cargo?: string;
      departamento?: string;
    }
  ): Promise<string> {
    try {
      const prompt = `Eres un asistente de Recursos Humanos de MINOIL S.A. en Bolivia. 
Escribe un mensaje de WhatsApp NATURAL y PERSONALIZADO (como si fueras una persona real, no un bot) 
para informar a ${userName}${userInfo?.cargo ? ` (${userInfo.cargo})` : ''}${userInfo?.regional ? ` de ${userInfo.regional}` : ''} 
que su boleta de pago de ${monthName} ${year} está lista.

REQUISITOS:
- El mensaje debe sonar como si lo escribiera una persona real, no un bot
- Debe ser amigable y profesional
- Máximo 4 líneas
- Incluye un emoji relevante al inicio
- Menciona que el documento está adjunto
- Firma como "MINOIL S.A. - Recursos Humanos"
- NO uses asteriscos para negritas, escribe naturalmente
- Varía el estilo cada vez (a veces más formal, a veces más casual)

Ejemplo de estilo natural:
"Hola ${userName}, tu boleta de ${monthName} ya está lista 📄 Te la adjunto aquí. Cualquier consulta, avísame. Saludos, RRHH MINOIL"

Escribe SOLO el mensaje, sin explicaciones adicionales:`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();

      logger.info('✅ Mensaje generado por Gemini', {
        userName,
        monthName,
        messageLength: text.length
      });

      return text;
    } catch (error: any) {
      logger.error('❌ Error al generar mensaje con Gemini', {
        error: error.message,
        userName,
        monthName
      });

      // Fallback a mensaje simple si Gemini falla
      return `Hola ${userName}, tu boleta de pago de ${monthName} ${year} está lista. Te la adjunto aquí. 📄\n\nMINOIL S.A. - Recursos Humanos`;
    }
  }

  /**
   * Genera un mensaje natural y personalizado para mensajes regionales
   */
  static async generateRegionalMessage(
    baseMessage: string,
    userName: string,
    userInfo?: {
      regional?: string;
      cargo?: string;
      departamento?: string;
    }
  ): Promise<string> {
    try {
      const prompt = `Eres un asistente de Recursos Humanos de MINOIL S.A. en Bolivia.
Tienes que comunicar el siguiente mensaje a ${userName}${userInfo?.cargo ? ` (${userInfo.cargo})` : ''}${userInfo?.regional ? ` de ${userInfo.regional}` : ''}:

MENSAJE ORIGINAL:
"${baseMessage}"

REQUISITOS:
- Reescribe el mensaje de forma NATURAL y PERSONALIZADA (como si fueras una persona real escribiendo)
- Mantén la información importante del mensaje original
- Haz que suene como una conversación real, no como un mensaje automático
- Máximo 6 líneas
- Incluye un emoji relevante
- Varía el estilo (a veces más formal, a veces más casual)
- NO uses asteriscos para negritas, escribe naturalmente
- Si el mensaje original tiene variables como {{nombre}} o {{link}}, reemplázalas con los valores reales

Escribe SOLO el mensaje reescrito, sin explicaciones adicionales:`;

      // Reemplazar variables en el mensaje base antes de enviarlo a Gemini
      let processedMessage = baseMessage
        .replace(/\{\{nombre\}\}/g, userName)
        .replace(/\{\{link\}\}/g, 'el enlace adjunto');

      const result = await this.model.generateContent(prompt.replace('MENSAJE ORIGINAL:\n"' + baseMessage + '"', 'MENSAJE ORIGINAL:\n"' + processedMessage + '"'));
      const response = await result.response;
      const text = response.text().trim();

      logger.info('✅ Mensaje regional generado por Gemini', {
        userName,
        messageLength: text.length
      });

      return text;
    } catch (error: any) {
      logger.error('❌ Error al generar mensaje regional con Gemini', {
        error: error.message,
        userName
      });

      // Fallback: reemplazar variables en el mensaje original
      return baseMessage
        .replace(/\{\{nombre\}\}/g, userName)
        .replace(/\{\{link\}\}/g, 'el enlace adjunto');
    }
  }

  /**
   * Genera una respuesta natural a un mensaje del usuario
   */
  static async generateNaturalResponse(
    userMessage: string,
    userName: string,
    context?: string
  ): Promise<string> {
    try {
      const prompt = `Eres un asistente de Recursos Humanos de MINOIL S.A. en Bolivia.
${userName} te escribió: "${userMessage}"

${context ? `CONTEXTO: ${context}\n\n` : ''}

Responde de forma NATURAL y AMIGABLE (como una persona real, no un bot):
- Sé conciso pero amigable
- Responde la pregunta o atiende la solicitud
- Máximo 3-4 líneas
- Incluye un emoji si es apropiado
- NO uses asteriscos para negritas
- Varía el estilo según el contexto

Escribe SOLO la respuesta, sin explicaciones adicionales:`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();

      logger.info('✅ Respuesta generada por Gemini', {
        userName,
        messageLength: text.length
      });

      return text;
    } catch (error: any) {
      logger.error('❌ Error al generar respuesta con Gemini', {
        error: error.message,
        userName
      });

      return 'Gracias por tu mensaje. Te responderé pronto.';
    }
  }
}
