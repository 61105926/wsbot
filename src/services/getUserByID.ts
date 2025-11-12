import axios from "axios";
import { API_CONFIG } from "../config/config";
import { ExternalAPIError } from "../errors/CustomErrors";
import { loggers } from "../utils/logger";

/**
 * Obtiene información de un usuario por su ID de empleado
 */
export async function getUserByID(empID: string) {
  try {
    // Usar la misma API que otros servicios para obtener datos del empleado
    const url = `${API_CONFIG.SURVEY_API}?empID=${empID}`;
    loggers.externalApiCall(url, 'GET');

    const response = await axios.get(url, {
      timeout: 5000 // Timeout de 5 segundos
    });
    return response.data;
  } catch (error: any) {
    // Verificar si es un error no crítico (rate limiting, timeout, etc.)
    const isNonCriticalError = error?.code === 'ECONNABORTED' || // Timeout
                              error?.code === 'ETIMEDOUT' ||
                              error?.response?.status === 429 || // Rate limit
                              error?.response?.status === 503 || // Service unavailable
                              error?.response?.status === 504; // Gateway timeout
    
    if (isNonCriticalError) {
      // Solo registrar como debug para errores no críticos
      loggers.externalApiError(API_CONFIG.SURVEY_API, error, 'debug');
    } else {
      // Registrar como error para errores críticos
      loggers.externalApiError(API_CONFIG.SURVEY_API, error);
    }
    
    throw new ExternalAPIError(
      'Error al obtener usuario por ID',
      error
    );
  }
}
