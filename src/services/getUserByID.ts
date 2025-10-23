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

    const response = await axios.get(url);
    return response.data;
  } catch (error: any) {
    loggers.externalApiError(API_CONFIG.SURVEY_API, error);
    throw new ExternalAPIError(
      'Error al obtener usuario por ID',
      error
    );
  }
}
