import axios from "axios";
import { API_CONFIG } from "../config/config";
import { ExternalAPIError } from "../errors/CustomErrors";
import { logger, loggers } from "../utils/logger";

/**
 * Respuesta de la API de empleado
 */
export interface EmployeeData {
  [key: string]: any;
}

/**
 * Obtiene información completa de un empleado por su número de teléfono
 */
export async function getEmployeeData(phoneNumber: string): Promise<EmployeeData> {
  try {
    // Extraer solo los 8 dígitos del número (quitar prefijo 591)
    const mobile = phoneNumber.length > 8 ? phoneNumber.substring(3) : phoneNumber;

    const url = `${API_CONFIG.EMPLOYEE_API}?mobile=${mobile}`;
    loggers.externalApiCall(url, 'GET');

    const response = await axios.get<EmployeeData>(url);

    if (!response.data) {
      throw new Error('No se encontró información del empleado');
    }

    logger.info('Datos de empleado obtenidos exitosamente', {
      phone: mobile,
      hasData: !!response.data
    });

    return response.data;
  } catch (error: any) {
    loggers.externalApiError(API_CONFIG.EMPLOYEE_API, error);
    throw new ExternalAPIError(
      'Error al obtener datos del empleado desde la API externa',
      error
    );
  }
}

/**
 * Codifica datos de empleado en base64
 */
export function encodeEmployeeData(data: EmployeeData): string {
  try {
    const jsonString = JSON.stringify(data);
    const base64Encoded = Buffer.from(jsonString).toString('base64');

    logger.debug('Datos de empleado codificados en base64', {
      originalSize: jsonString.length,
      encodedSize: base64Encoded.length
    });

    return base64Encoded;
  } catch (error: any) {
    logger.error('Error al codificar datos en base64', { error: error.message });
    throw new Error('Error al codificar datos del empleado');
  }
}
