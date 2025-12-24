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

/**
 * Extrae el número real de WhatsApp desde el contexto de BuilderBot
 * Intenta obtener el número desde ctx.key?.remoteJid o ctx.pushName
 * Si no está disponible, devuelve el LID con información adicional
 * 
 * @param ctx - Contexto de BuilderBot
 * @returns Objeto con el número real (si está disponible) y el LID original
 */
export function extractRealPhoneFromContext(ctx: any): {
  phone: string;
  lid: string;
  isRealPhone: boolean;
} {
  const lid = ctx.from || '';
  
  // Intentar obtener el número real desde ctx.key?.remoteJid
  // En Sherpa, remoteJid tiene el formato: "59161105926@s.whatsapp.net"
  let realPhone: string | null = null;
  
  try {
    // Intentar desde ctx.key?.remoteJid (formato Sherpa)
    if (ctx?.key?.remoteJid) {
      const jid = ctx.key.remoteJid;
      
      // Verificar si es un número real (termina en @s.whatsapp.net) o un LID (termina en @lid)
      if (jid.endsWith('@s.whatsapp.net')) {
        // Es un número real: "59161105926@s.whatsapp.net" -> "59161105926"
        const match = jid.match(/^(\d+)@s\.whatsapp\.net$/);
        if (match && match[1]) {
          realPhone = match[1];
        }
      } else if (jid.endsWith('@lid')) {
        // Es un LID: "153059917307993@lid" -> NO es número real
        // No extraer como número real
        realPhone = null;
      } else {
        // Formato desconocido, intentar extraer de todos modos
        const match = jid.match(/^(\d+)@/);
        if (match && match[1]) {
          realPhone = match[1];
        }
      }
    }
    
    // Si no se encontró, intentar desde ctx.pushName o ctx.key?.participant
    if (!realPhone && ctx?.key?.participant) {
      const participant = ctx.key.participant;
      const match = participant.match(/^(\d+)@/);
      if (match && match[1]) {
        realPhone = match[1];
      }
    }
    
    // Si aún no se encontró, verificar si ctx.from ya es un número real (no un LID)
    // Verificar que NO contenga @lid y que sea solo dígitos (posiblemente con prefijo 591)
    if (!realPhone && lid && !lid.includes('@lid') && !lid.includes('@') && /^\d+$/.test(lid.replace(/^591/, ''))) {
      // Si ctx.from parece un número real (solo dígitos, posiblemente con prefijo 591, sin @)
      realPhone = lid;
    }
  } catch (error) {
    // Si hay algún error al extraer, continuar con el LID
    console.debug('Error al extraer número real del contexto:', error);
  }
  
  // Si encontramos un número real, devolverlo
  if (realPhone) {
    return {
      phone: realPhone,
      lid: lid,
      isRealPhone: true
    };
  }
  
  // Si no, devolver el LID con una nota
  return {
    phone: lid,
    lid: lid,
    isRealPhone: false
  };
}

