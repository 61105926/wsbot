import axios from "axios";

const API_URL = "http://190.171.225.68:8006/api/survey";

interface ResponseAPI {
  data: {
    regional?: string;
    [key: string]: any;
  };
}

export async function getRegionales(): Promise<string[]> {
  try {
    const response = await axios.get(API_URL);
    const items = response.data as ResponseAPI[];

    // Extraer regionales únicas normalizando a mayúsculas
    const regionalesSet = new Set<string>();
    items.forEach((item) => {
      if (item.data.regional) {
        // Normalizar a mayúsculas para evitar duplicados (LPZ, lpz, Lpz -> LPZ)
        const normalizedRegional = item.data.regional.trim().toUpperCase();
        regionalesSet.add(normalizedRegional);
      }
    });

    const regionales = Array.from(regionalesSet).sort();

    console.log(`✅ Regionales obtenidas: ${regionales.length}`, regionales);

    return regionales.length > 0 ? regionales : [
      'La Paz',
      'Santa Cruz',
      'Cochabamba',
      'Oruro',
      'Tarija',
      'Potosí',
      'Chuquisaca',
      'Beni',
      'Pando'
    ];
  } catch (error) {
    console.error("Error fetching regionales:", error);
    // Fallback a regionales por defecto
    return [
      'La Paz',
      'Santa Cruz',
      'Cochabamba',
      'Oruro',
      'Tarija',
      'Potosí',
      'Chuquisaca',
      'Beni',
      'Pando'
    ];
  }
}
