/**
 * Helpers para flows conversacionales
 */

import { MONTH_NAMES } from "../config/constants";

/**
 * Formatea una fecha en formato "MES AÑO"
 */
export function getStringDate(date: Date): string {
  const formattedDate = date.toLocaleDateString("es", {
    month: "long",
    year: "numeric"
  });

  const [month, year] = formattedDate.split("de");
  return `${month.trim().toUpperCase()} ${year.trim()}`;
}

/**
 * Genera diccionario de meses disponibles para boletas
 * Retorna Map con número de opción -> fecha del mes
 */
export function getMonthDictionary(): Map<string, Date> {
  const today = new Date();
  const months: Date[] = [];
  const currentMonth = today.getMonth() - 1;

  // Si estamos antes del día 3, mostrar un mes adicional hacia atrás
  const startMonthIndex = today.getDate() <= 2 ? 1 : 0;

  // Generar últimos 7 meses
  for (let i = startMonthIndex; i < startMonthIndex + 7; i++) {
    months.push(new Date(today.getFullYear(), currentMonth - i, 1));
  }

  return new Map(months.map((date, index) => [(index + 1).toString(), date]));
}

/**
 * Convierte Date a formato YYYYMM
 */
export function dateToYYYYMM(date: Date): string {
  const month = ('0' + (date.getMonth() + 1)).slice(-2);
  const year = date.getFullYear();
  return `${year}${month}`;
}

/**
 * Genera mensaje con lista de meses disponibles
 */
export function buildMonthsList(): string {
  const monthsDict = getMonthDictionary();
  const monthsList = Array.from(monthsDict.entries())
    .map(([key, date]) => `${key}. ${getStringDate(date)}`)
    .join('\n');

  return monthsList;
}

/**
 * Sanitiza número de teléfono (remueve prefijo 591)
 */
export function sanitizePhone(phone: string): string {
  return phone.startsWith('591') ? phone.slice(3) : phone;
}

/**
 * Valida que un string sea solo números
 */
export function isNumericString(value: string): boolean {
  return /^\d+$/.test(value.trim());
}
