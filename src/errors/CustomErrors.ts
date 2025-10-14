/**
 * Base class for all custom errors
 */
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public originalError?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error when external API calls fail
 */
export class ExternalAPIError extends AppError {
  constructor(message: string, originalError?: any) {
    super(message, 502, originalError);
  }
}

/**
 * Error when validation fails
 */
export class ValidationError extends AppError {
  constructor(message: string, public details?: any) {
    super(message, 400);
  }
}

/**
 * Error when WhatsApp is not connected
 */
export class WhatsAppNotConnectedError extends AppError {
  constructor(message: string = "WhatsApp no está conectado") {
    super(message, 503);
  }
}

/**
 * Error when bot instance is not available
 */
export class BotNotAvailableError extends AppError {
  constructor(message: string = "No hay un número conectado al servidor") {
    super(message, 500);
  }
}

/**
 * Error when queue is already processing
 */
export class QueueBusyError extends AppError {
  constructor(message: string = "Ya hay un proceso de envío en curso") {
    super(message, 400);
  }
}

/**
 * Error when no data is found
 */
export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404);
  }
}

/**
 * Error when operation times out
 */
export class TimeoutError extends AppError {
  constructor(message: string) {
    super(message, 408);
  }
}
