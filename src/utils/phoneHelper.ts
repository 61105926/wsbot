import { IS_DEVELOPMENT } from '../config/config';

/**
 * Número de teléfono para desarrollo/pruebas
 */
const DEV_PHONE = '59161105926';

/**
 * Determina el número de teléfono a usar según el entorno
 * En desarrollo: usa el número de prueba
 * En producción: usa el número real proporcionado
 * 
 * @param realPhone - Número de teléfono real del usuario
 * @returns Número de teléfono a usar (real en producción, de prueba en desarrollo)
 */
export function getPhoneForEnvironment(realPhone: string | undefined | null): string {
  if (IS_DEVELOPMENT) {
    return DEV_PHONE;
  }
  
  // En producción, usar el número real
  if (!realPhone) {
    // Si no hay número real, usar el de desarrollo como fallback
    // pero loguear un warning
    console.warn('⚠️ No se proporcionó número de teléfono real, usando número de desarrollo como fallback');
    return DEV_PHONE;
  }
  
  // Asegurar que el número tenga el prefijo 591 si no lo tiene
  if (!realPhone.startsWith('591')) {
    return `591${realPhone}`;
  }
  
  return realPhone;
}

