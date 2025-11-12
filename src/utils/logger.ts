import winston from 'winston';
import path from 'path';
import { LOG_LEVEL } from '../config/config';

// Definir niveles de log personalizados
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Definir colores para cada nivel
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Aplicar colores a winston
winston.addColors(colors);

// Helper para agregar emojis según nivel
function getEmoji(level: string): string {
  const levelClean = level.replace(/\u001b\[.*?m/g, ''); // Remover códigos ANSI

  const emojiMap: Record<string, string> = {
    error: '❌',
    warn: '⚠️',
    info: 'ℹ️',
    http: '🌐',
    debug: '🔍',
  };

  return emojiMap[levelClean] || 'ℹ️';
}

// Formato para consola (con colores y emojis)
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const emoji = getEmoji(info.level);
    const meta = info.metadata && Object.keys(info.metadata).length
      ? `\n${JSON.stringify(info.metadata, null, 2)}`
      : '';
    return `${emoji} [${info.timestamp}] ${info.level}: ${info.message}${meta}`;
  })
);

// Formato para archivos (JSON estructurado)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.metadata(),
  winston.format.json()
);

// Configurar transports
const transports: winston.transport[] = [
  // Console con colores
  new winston.transports.Console({
    format: consoleFormat,
  }),

  // Archivo para errores
  new winston.transports.File({
    filename: path.join(__dirname, '../../logs/error.log'),
    level: 'error',
    format: fileFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),

  // Archivo combinado (todos los niveles)
  new winston.transports.File({
    filename: path.join(__dirname, '../../logs/combined.log'),
    format: fileFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
];

// Crear logger
export const logger = winston.createLogger({
  level: LOG_LEVEL,
  levels,
  transports,
  // No salir en error
  exitOnError: false,
});

// Helpers específicos para el dominio
export const loggers = {
  // Log para envío de mensajes
  messageSent: (user: { fullName: string; phone: string }, type: string) => {
    logger.info(`Mensaje enviado exitosamente`, {
      user: user.fullName,
      phone: user.phone,
      type,
    });
  },

  // Log para errores de envío
  messageFailed: (user: { fullName: string; phone: string }, error: any) => {
    logger.error(`Error al enviar mensaje`, {
      user: user.fullName,
      phone: user.phone,
      error: error.message || error,
      stack: error.stack,
    });
  },

  // Log para inicio de batch
  batchStarted: (totalUsers: number, type: string) => {
    logger.info(`Iniciando envío masivo`, {
      totalUsers,
      type,
    });
  },

  // Log para progreso de batch
  batchProgress: (completed: number, total: number, percentage: number) => {
    logger.info(`Progreso de envío`, {
      completed,
      total,
      percentage: `${percentage}%`,
    });
  },

  // Log para conexión de WhatsApp
  whatsappConnected: () => {
    logger.info('WhatsApp conectado exitosamente');
  },

  whatsappDisconnected: () => {
    logger.warn('WhatsApp desconectado');
  },

  // Log para API externa
  externalApiCall: (url: string, method: string = 'GET') => {
    logger.http(`Llamada a API externa`, { url, method });
  },

  externalApiError: (url: string, error: any, level: 'error' | 'debug' = 'error') => {
    const logData = {
      url,
      error: error.message || error,
      stack: error.stack,
    };
    
    if (level === 'debug') {
      logger.debug(`Error en API externa (no crítico)`, logData);
    } else {
      logger.error(`Error en API externa`, logData);
    }
  },
};
