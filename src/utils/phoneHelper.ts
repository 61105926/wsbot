import { IS_DEVELOPMENT } from '../config/config';
import { connectionStatus } from '../services/connectionStatus';

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
 * Resuelve un LID a número real usando el provider de SendWave
 * 
 * @param lid - LID a resolver (ej: "74539476230262@lid")
 * @param provider - Provider de SendWave
 * @returns Número real o null si no se puede resolver
 */
async function resolveLidToPhone(lid: string, provider: any): Promise<string | null> {
  if (!provider || !lid) return null;
  
  try {
    // Intentar usar onWhatsApp del vendor de SendWave
    if (provider.vendor && typeof provider.vendor.onWhatsApp === 'function') {
      const lidJid = lid.includes('@') ? lid : `${lid}@lid`;
      const result = await provider.vendor.onWhatsApp([lidJid]);
      
      if (result && Array.isArray(result) && result.length > 0) {
        const contact = result[0];
        
        // Intentar desde jid
        if (contact?.jid) {
          const jid = contact.jid;
          if (jid.endsWith('@s.whatsapp.net')) {
            const match = jid.match(/^(\d+)@s\.whatsapp\.net$/);
            if (match && match[1]) {
              return match[1];
            }
          }
        }
        
        // Intentar desde exists (puede tener el número)
        if (contact?.exists && contact?.jid) {
          const jid = contact.jid;
          if (jid.endsWith('@s.whatsapp.net')) {
            const match = jid.match(/^(\d+)@s\.whatsapp\.net$/);
            if (match && match[1]) {
              return match[1];
            }
          }
        }
      }
    }
    
    // Intentar usar getBusinessProfile si está disponible
    if (provider.vendor && typeof provider.vendor.getBusinessProfile === 'function') {
      try {
        const lidJid = lid.includes('@') ? lid : `${lid}@lid`;
        const profile = await provider.vendor.getBusinessProfile(lidJid);
        if (profile?.phone) {
          return String(profile.phone);
        }
      } catch (e) {
        // Silenciar error
      }
    }
  } catch (error) {
    // Silenciar errores, retornar null
    console.debug('Error al resolver LID:', error);
  }
  
  return null;
}

/**
 * Extrae el número real de WhatsApp desde el contexto de BuilderBot
 * Intenta obtener el número desde múltiples fuentes del contexto
 * Si no está disponible, intenta resolver el LID usando el provider
 * 
 * @param ctx - Contexto de BuilderBot
 * @param provider - Provider opcional para resolver LIDs (si no se pasa, intenta obtenerlo de connectionStatus)
 * @returns Objeto con el número real (si está disponible) y el LID original
 */
export async function extractRealPhoneFromContext(
  ctx: any, 
  provider?: any
): Promise<{
  phone: string;
  lid: string;
  isRealPhone: boolean;
  normalizedPhone?: string; // Número sin prefijo 591 para APIs
}> {
  // Si no se pasa provider, intentar obtenerlo de connectionStatus
  if (!provider) {
    try {
      provider = connectionStatus.getProvider();
    } catch (e) {
      // Silenciar error
    }
  }
  const lid = ctx.from || '';
  
  // Intentar obtener el número real desde múltiples fuentes
  // SendWave puede enviar el número en diferentes campos
  let realPhone: string | null = null;
  
  try {
    // 1. Intentar desde ctx.key?.remoteJid (formato estándar)
    if (ctx?.key?.remoteJid) {
      const jid = ctx.key.remoteJid;
      
      // Verificar si es un número real (termina en @s.whatsapp.net)
      if (jid.endsWith('@s.whatsapp.net')) {
        const match = jid.match(/^(\d+)@s\.whatsapp\.net$/);
        if (match && match[1]) {
          realPhone = match[1];
        }
      } else if (jid.endsWith('@c.us')) {
        // Formato alternativo: número@c.us
        const match = jid.match(/^(\d+)@c\.us$/);
        if (match && match[1]) {
          realPhone = match[1];
        }
      }
    }
    
    // 2. Intentar desde ctx.key?.participant (para grupos)
    if (!realPhone && ctx?.key?.participant) {
      const participant = ctx.key.participant;
      if (participant.endsWith('@s.whatsapp.net')) {
        const match = participant.match(/^(\d+)@s\.whatsapp\.net$/);
        if (match && match[1]) {
          realPhone = match[1];
        }
      } else if (participant.endsWith('@c.us')) {
        const match = participant.match(/^(\d+)@c\.us$/);
        if (match && match[1]) {
          realPhone = match[1];
        }
      }
    }
    
    // 3. Intentar desde ctx.wid o ctx.id (SendWave puede usar estos campos)
    if (!realPhone && ctx?.wid) {
      const wid = String(ctx.wid);
      if (wid.endsWith('@s.whatsapp.net')) {
        const match = wid.match(/^(\d+)@s\.whatsapp\.net$/);
        if (match && match[1]) {
          realPhone = match[1];
        }
      } else if (!wid.includes('@lid') && /^\d+$/.test(wid.replace(/^591/, ''))) {
        // Si wid es solo dígitos (posiblemente con 591), usarlo
        realPhone = wid;
      }
    }
    
    // 4. Intentar desde ctx.id
    if (!realPhone && ctx?.id) {
      const id = String(ctx.id);
      if (id.endsWith('@s.whatsapp.net')) {
        const match = id.match(/^(\d+)@s\.whatsapp\.net$/);
        if (match && match[1]) {
          realPhone = match[1];
        }
      }
    }
    
    // 5. Intentar desde ctx.from directamente si parece un número real
    if (!realPhone && lid) {
      // Si ctx.from termina en @s.whatsapp.net o @c.us, extraer el número
      if (lid.endsWith('@s.whatsapp.net')) {
        const match = lid.match(/^(\d+)@s\.whatsapp\.net$/);
        if (match && match[1]) {
          realPhone = match[1];
        }
      } else if (lid.endsWith('@c.us')) {
        const match = lid.match(/^(\d+)@c\.us$/);
        if (match && match[1]) {
          realPhone = match[1];
        }
      } else if (!lid.includes('@lid') && !lid.includes('@') && /^\d+$/.test(lid.replace(/^591/, ''))) {
        // Si ctx.from es solo dígitos (posiblemente con prefijo 591), usarlo
        realPhone = lid;
      }
    }
    
    // 6. Intentar desde ctx.phoneNumber o ctx.phone (campos alternativos)
    if (!realPhone && ctx?.phoneNumber) {
      const phone = String(ctx.phoneNumber);
      if (/^\d+$/.test(phone.replace(/^591/, ''))) {
        realPhone = phone;
      }
    }
    
    if (!realPhone && ctx?.phone) {
      const phone = String(ctx.phone);
      if (/^\d+$/.test(phone.replace(/^591/, ''))) {
        realPhone = phone;
      }
    }
    
    // 7. Si no encontramos número real y tenemos un LID, intentar resolverlo con el provider
    if (!realPhone && lid.includes('@lid') && provider) {
      realPhone = await resolveLidToPhone(lid, provider);
    }
    
  } catch (error) {
    // Si hay algún error al extraer, continuar con el LID
    console.debug('Error al extraer número real del contexto:', error);
  }
  
  // Normalizar el número (quitar prefijo 591) para usar en APIs
  const normalizedPhone = realPhone ? normalizePhoneForApi(realPhone) : normalizePhoneForApi(lid);
  
  // Si encontramos un número real, devolverlo
  if (realPhone) {
    return {
      phone: realPhone,
      lid: lid,
      isRealPhone: true,
      normalizedPhone: normalizedPhone
    };
  }
  
  // Si no, devolver el LID con una nota
  return {
    phone: lid,
    lid: lid,
    isRealPhone: false,
    normalizedPhone: normalizedPhone
  };
}

/**
 * Versión síncrona (para compatibilidad con código existente)
 * Nota: No puede resolver LIDs, solo extrae números que ya están en el contexto
 */
export function extractRealPhoneFromContextSync(ctx: any): {
  phone: string;
  lid: string;
  isRealPhone: boolean;
  normalizedPhone?: string;
} {
  const lid = ctx.from || '';
  let realPhone: string | null = null;
  
  try {
    // Misma lógica que la versión async pero sin resolver LIDs
    if (ctx?.key?.remoteJid) {
      const jid = ctx.key.remoteJid;
      if (jid.endsWith('@s.whatsapp.net')) {
        const match = jid.match(/^(\d+)@s\.whatsapp\.net$/);
        if (match && match[1]) {
          realPhone = match[1];
        }
      } else if (jid.endsWith('@c.us')) {
        const match = jid.match(/^(\d+)@c\.us$/);
        if (match && match[1]) {
          realPhone = match[1];
        }
      }
    }
    
    if (!realPhone && lid && lid.endsWith('@s.whatsapp.net')) {
      const match = lid.match(/^(\d+)@s\.whatsapp\.net$/);
      if (match && match[1]) {
        realPhone = match[1];
      }
    }
  } catch (error) {
    console.debug('Error al extraer número real del contexto:', error);
  }
  
  const normalizedPhone = realPhone ? normalizePhoneForApi(realPhone) : normalizePhoneForApi(lid);
  
  if (realPhone) {
    return {
      phone: realPhone,
      lid: lid,
      isRealPhone: true,
      normalizedPhone: normalizedPhone
    };
  }
  
  return {
    phone: lid,
    lid: lid,
    isRealPhone: false,
    normalizedPhone: normalizedPhone
  };
}

/**
 * Normaliza un número de teléfono para usar en las APIs
 * Quita el prefijo 591 y devuelve solo los 8 dígitos
 * 
 * @param phoneNumber - Número de teléfono (puede tener prefijo 591 o ser LID)
 * @returns Número normalizado (8 dígitos) o el número original si no se puede normalizar
 */
export function normalizePhoneForApi(phoneNumber: string): string {
  if (!phoneNumber) {
    return phoneNumber;
  }
  
  // Quitar cualquier sufijo de WhatsApp (@s.whatsapp.net, @c.us, @lid)
  let cleanPhone = phoneNumber.replace(/@.*$/, '');
  
  // Quitar prefijo 591 si existe
  if (cleanPhone.startsWith('591')) {
    cleanPhone = cleanPhone.substring(3);
  }
  
  // Si después de limpiar tiene más de 8 dígitos, tomar los últimos 8
  // (por si hay algún prefijo adicional)
  if (cleanPhone.length > 8 && /^\d+$/.test(cleanPhone)) {
    cleanPhone = cleanPhone.substring(cleanPhone.length - 8);
  }
  
  // Si tiene menos de 8 dígitos pero es solo números, devolverlo tal cual
  // (puede ser un número corto válido)
  if (/^\d+$/.test(cleanPhone)) {
    return cleanPhone;
  }
  
  // Si no es solo números, devolver el original
  return phoneNumber;
}
