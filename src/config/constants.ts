/**
 * Constantes centralizadas para la aplicación
 */

// Delays y timeouts (en milisegundos)
export const TIMEOUTS = {
  // Delay entre mensajes (10-13 segundos)
  MESSAGE_DELAY_BASE: 10000,  // 10 segundos
  MESSAGE_DELAY_VARIANCE: 3000,  // +0-3 segundos

  // Timeouts para operaciones
  SEND_MESSAGE_TIMEOUT: 30000,  // 30 segundos
  SEND_DOCUMENT_TIMEOUT: 40000,  // 40 segundos
  DOWNLOAD_PDF_TIMEOUT: 30000,  // 30 segundos

  // Timeout para conexión de WhatsApp
  WHATSAPP_CONNECTION_DELAY: 8000,  // 8 segundos
} as const;

// Nombres de meses en español
export const MONTH_NAMES = [
  'ENERO',
  'FEBRERO',
  'MARZO',
  'ABRIL',
  'MAYO',
  'JUNIO',
  'JULIO',
  'AGOSTO',
  'SEPTIEMBRE',
  'OCTUBRE',
  'NOVIEMBRE',
  'DICIEMBRE'
] as const;

// Variaciones de saludos para mensajes
export const GREETINGS = [
  'Estimad@',
  'Hola',
  'Buen día',
  'Saludos'
] as const;

// Variaciones de despedidas
export const FAREWELLS = [
  '¡Saludos!',
  'Gracias.',
  'Que tenga buen día.',
  'Saludos cordiales.'
] as const;

// Prefijo telefónico de Bolivia
export const PHONE_PREFIX = '591';

// Paths
export const PATHS = {
  TMP_DIR: 'tmp',
  LOGS_DIR: 'logs',
  SESSIONS_DIR: 'bot_sessions',
} as const;

// Límites de archivos
export const FILE_LIMITS = {
  MAX_FILE_SIZE: 5 * 1024 * 1024,  // 5MB
  MAX_LOG_FILES: 5,
} as const;

// Regex patterns
export const PATTERNS = {
  MONTH_FORMAT: /^\d{6}$/,  // YYYYMM
  PHONE_NUMBER: /^\d{8}$/,  // 8 dígitos
} as const;

// Mensajes de error comunes
export const ERROR_MESSAGES = {
  BOT_NOT_CONNECTED: 'No hay un número conectado al servidor',
  WHATSAPP_NOT_CONNECTED: 'WhatsApp no está conectado. Por favor espera a que el bot se conecte antes de enviar mensajes.',
  QUEUE_BUSY: 'Ya hay un proceso de envío en curso',
  INVALID_MONTH_FORMAT: 'Formato de mes inválido. Use YYYYMM (ejemplo: 202409)',
  NO_USERS_FOUND: 'No se encontraron usuarios',
  NO_USERS_IN_REGION: 'No se encontraron usuarios en las regionales seleccionadas',
  SERVER_ERROR: 'Error en el servidor',
} as const;

// Mensajes de éxito
export const SUCCESS_MESSAGES = {
  BULK_SEND_STARTED: 'Envío masivo iniciado',
  PAYSLIP_SEND_STARTED: 'Envío masivo de boletas iniciado',
  QUEUE_PAUSED: 'Envío pausado',
  QUEUE_RESUMED: 'Envío reanudado',
  QUEUE_CANCELLED: 'Envío cancelado',
  QUEUE_RESET: 'Estado reseteado',
} as const;
