/**
 * Mensajes centralizados para flows conversacionales
 */

export const FLOW_MESSAGES = {
  // Menu principal
  MENU: {
    WELCOME: `😊 *¡Gracias por comunicarte con RRHH!* 😊

Por favor, selecciona una opción:

*1.* Boleta de Pago 📑
*2.* Solicitud de Vacaciones 🏖️

Escribe el número de la opción que desees.
`,
    RETURN_TO_MENU: "Gracias, escribe *menu* para volver al menú principal"
  },

  // Errores
  ERRORS: {
    INVALID_OPTION: "❌ Opción inválida",
    USER_NOT_FOUND: "Tu número no se encuentra registrado. Por favor, comunícate con Recursos Humanos (RRHH).",
    SERVICE_UNAVAILABLE: "Lo sentimos, la información no está disponible. Intente más tarde.",
    INVALID_MONTH: "Opción inválida. Por favor, selecciona un número de mes válido.",
    INVALID_ID: "Por favor ingresa solo números para tu ID.",
  },

  // Solicitudes de datos
  PROMPTS: {
    ENTER_ID: "Escribe tu *ID* (solo números)",
    SENDING_DOCUMENT: "📥 Enviando documento...",
    SENDING_IMAGE: "⏰ Enviando documento, espere....",
  },

  // Confirmaciones
  SUCCESS: {
    DOCUMENT_SENT: "✅ Documento enviado correctamente.",
    IMAGE_SENT: "✅ Imagen enviada.",
  },

  // Meses disponibles
  MONTHS: {
    TITLE: "📋 *Meses disponibles* 📋",
  },

  // Solicitud de vacaciones
  VACATION: {
    PROCESSING: "⏳ Procesando tu solicitud de vacaciones...",
    SUCCESS: `✅ *Solicitud de Vacaciones*

Por favor, completa tu solicitud en el siguiente enlace:

{{url}}

Este enlace contiene tu información personal precargada. 🏖️`,
    ERROR: "❌ No pudimos procesar tu solicitud de vacaciones. Por favor, comunícate con Recursos Humanos (RRHH)."
  }
} as const;
