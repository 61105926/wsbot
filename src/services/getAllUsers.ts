import axios from "axios";
import { API_CONFIG } from "../config/config";
import { PHONE_PREFIX } from "../config/constants";
import { ExternalAPIError } from "../errors/CustomErrors";
import { loggers } from "../utils/logger";
import { ResponseAPI, User } from "../dto/models.dto";

/**
 * Obtiene todos los usuarios del sistema
 */
export async function getAllUsers(): Promise<User[]> {
  try {
    loggers.externalApiCall(API_CONFIG.SURVEY_API, 'GET');

    const response = await axios.get<ResponseAPI[]>(API_CONFIG.SURVEY_API);
    const items = response.data;

    return items.map((item) => ({
      fullName: item.data.fullName,
      empID: item.data.empID,
      phone: `${PHONE_PREFIX}${item.data.phone}`,
      linkURL: item.data.jwt,
    }));
  } catch (error: any) {
    loggers.externalApiError(API_CONFIG.SURVEY_API, error);
    throw new ExternalAPIError(
      'Error al obtener usuarios de la API externa',
      error
    );
  }
}
