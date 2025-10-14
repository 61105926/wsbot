import axios from "axios";
import { API_CONFIG } from "../config/config";
import { ExternalAPIError } from "../errors/CustomErrors";
import { loggers } from "../utils/logger";

/**
 * Obtiene información de un usuario por su número de teléfono
 */
export const getUserByPhone = async (phoneNumber: string) => {
  try {
    const url = `${API_CONFIG.BACKEND_API}${phoneNumber}`;
    loggers.externalApiCall(url, 'GET');

    const response = await axios.get(url);
    return response.data;
  } catch (error: any) {
    loggers.externalApiError(API_CONFIG.BACKEND_API, error);
    throw new ExternalAPIError(
      'Error al obtener usuario por teléfono de la API externa',
      error
    );
  }
}