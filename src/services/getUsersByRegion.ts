import axios from "axios";

interface ResponseAPI {
  data: DataAPI;
}

interface DataAPI {
  fullName: string;
  empID: string;
  phone: string;
  jwt: string;
  regional?: string;
}

interface User {
  fullName: string;
  empID: string;
  phone: string;
  linkURL: string;
  regional: string;
}

const API_URL = "http://190.171.225.68/api/survey";

export async function getUsersByRegions(regions: string[]): Promise<User[]> {
  try {
    const response = await axios.get(API_URL);
    const items = response.data as ResponseAPI[];

    // Filtrar usuarios por regionales seleccionadas
    return items
      .filter((item) => {
        if (!item.data.regional) return false;
        return regions.includes(item.data.regional);
      })
      .map((item) => ({
        fullName: item.data.fullName,
        empID: item.data.empID,
        phone: `591${item.data.phone}`,
        linkURL: item.data.jwt,
        regional: item.data.regional || "Sin regional"
      }));
  } catch (error) {
    console.error("Error fetching users by region:", error);
    throw error;
  }
}
