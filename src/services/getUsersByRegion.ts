import axios from "axios";
import { API_CONFIG } from "../config/config";
import { PHONE_PREFIX } from "../config/constants";
import { ExternalAPIError } from "../errors/CustomErrors";
import { loggers } from "../utils/logger";
import { ResponseAPI, UserWithRegional } from "../dto/models.dto";

/**
 * Obtiene usuarios filtrados por regionales
 */
export async function getUsersByRegions(regions: string[]): Promise<UserWithRegional[]> {
  try {
    loggers.externalApiCall(API_CONFIG.SURVEY_API, 'GET');

    const response = await axios.get<ResponseAPI[]>(API_CONFIG.SURVEY_API);
    const items = response.data;

    // Normalizar regionales de entrada a mayúsculas para comparación
    const normalizedRegions = regions.map(r => r.trim().toUpperCase());

    // Filtrar usuarios por regionales seleccionadas
    const filteredUsers = items
      .filter((item) => {
        if (!item.data.regional) return false;
        // Normalizar la regional del usuario para comparación
        const userRegional = item.data.regional.trim().toUpperCase();
        return normalizedRegions.includes(userRegional);
      })
      .map((item) => ({
        fullName: item.data.fullName,
        empID: item.data.empID,
        phone: `${PHONE_PREFIX}${item.data.phone}`,
        linkURL: item.data.jwt,
        regional: item.data.regional || "Sin regional"
      }));

    return filteredUsers;
  } catch (error: any) {
    loggers.externalApiError(API_CONFIG.SURVEY_API, error);
    throw new ExternalAPIError(
      'Error al obtener usuarios por región de la API externa',
      error
    );
  }
}
