import { MONTH_NAMES, GREETINGS, FAREWELLS } from "../config/constants";
import { User } from "../dto/models.dto";
import { GeminiService } from "./geminiService";
import { GEMINI_CONFIG } from "../config/config";

/**
 * Servicio para construir mensajes personalizados
 */
export class MessageBuilderService {
  /**
   * Obtiene un elemento aleatorio de un array
   */
  private static getRandomItem<T>(items: readonly T[]): T {
    return items[Math.floor(Math.random() * items.length)];
  }

  /**
   * Convierte mes YYYYMM a nombre del mes
   */
  static getMonthName(monthCode: string): string {
    const monthNum = parseInt(monthCode.substring(4, 6));
    const monthName = MONTH_NAMES[monthNum - 1];
    return monthName.charAt(0) + monthName.slice(1).toLowerCase();
  }

  /**
   * Convierte mes YYYYMM a año
   */
  static getYear(monthCode: string): string {
    return monthCode.substring(0, 4);
  }

  /**
   * Construye el nombre del archivo PDF para boleta
   */
  static buildPayslipFileName(user: User, monthCode: string): string {
    const monthName = this.getMonthName(monthCode);
    const year = this.getYear(monthCode);
    return `${user.fullName} ${monthName} ${year}.pdf`;
  }

  /**
   * Construye mensaje personalizado para envío de boleta
   * Usa Gemini AI para generar mensajes naturales si está habilitado
   */
  static async buildPayslipMessage(user: User, monthCode: string): Promise<string> {
    const monthName = this.getMonthName(monthCode);
    const year = this.getYear(monthCode);

    // Si Gemini está habilitado, usarlo para generar mensaje natural
    if (GEMINI_CONFIG.ENABLED) {
      try {
        const geminiMessage = await GeminiService.generatePayslipMessage(
          user.fullName,
          monthName,
          year,
          {
            regional: (user as any).regional,
            cargo: (user as any).cargo,
            departamento: (user as any).departamento
          }
        );
        return geminiMessage;
      } catch (error: any) {
        // Si falla Gemini, usar fallback tradicional
        console.warn('⚠️ Gemini falló, usando mensaje tradicional:', error.message);
      }
    }

    // Fallback: mensaje tradicional con variaciones
    const saludo = this.getRandomItem(GREETINGS);
    const despedida = this.getRandomItem(FAREWELLS);

    return `📄 *Boleta de Pago – ${monthName} ${year}*\n\n${saludo} *${user.fullName}*,\n\nPonemos a tu disposición tu boleta de pago correspondiente al mes de ${monthName.toLowerCase()} ${year}.\n\n\n💼 *MINOIL S.A.*\n_Recursos Humanos_\n\n${despedida}`;
  }

  /**
   * Reemplaza variables en un mensaje
   * Usa Gemini AI para generar mensajes naturales si está habilitado
   */
  static async replaceVariables(
    message: string,
    variables: Record<string, string>,
    userInfo?: {
      regional?: string;
      cargo?: string;
      departamento?: string;
    }
  ): Promise<string> {
    // Si Gemini está habilitado y tenemos nombre de usuario, usar Gemini
    if (GEMINI_CONFIG.ENABLED && variables.nombre) {
      try {
        const geminiMessage = await GeminiService.generateRegionalMessage(
          message,
          variables.nombre,
          userInfo
        );
        return geminiMessage;
      } catch (error: any) {
        // Si falla Gemini, usar reemplazo tradicional
        console.warn('⚠️ Gemini falló, usando reemplazo tradicional:', error.message);
      }
    }

    // Fallback: reemplazo tradicional de variables
    let result = message;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value);
    }
    return result;
  }

  /**
   * Construye URL para API de boletas
   */
  static buildPayslipApiUrl(
    baseUrl: string,
    phone: string,
    monthCode: string
  ): string {
    // Quitar prefijo 591 - la API espera solo 8 dígitos
    const phoneNumber = phone.substring(3);
    return `${baseUrl}?numero=${phoneNumber}&fecha=${monthCode}`;
  }
}
