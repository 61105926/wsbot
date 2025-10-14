import { AppError } from "../errors/CustomErrors";
import { logger } from "./logger";

/**
 * Send JSON response
 */
export const sendJSON = (res: any, statusCode: number, data: any): void => {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
};

/**
 * Send success response
 */
export const sendSuccess = (
  res: any,
  data: any,
  message?: string,
  statusCode: number = 200
): void => {
  sendJSON(res, statusCode, {
    status: "success",
    message,
    ...data,
  });
};

/**
 * Send error response
 */
export const sendError = (
  res: any,
  error: any,
  statusCode?: number
): void => {
  // Si es un error personalizado, usar su statusCode
  if (error instanceof AppError) {
    logger.error(error.message, {
      statusCode: error.statusCode,
      stack: error.stack,
      originalError: error.originalError,
    });

    sendJSON(res, error.statusCode, {
      status: "error",
      error: error.message,
    });
    return;
  }

  // Error genérico
  const code = statusCode || 500;
  const message = error.message || "Error en el servidor";

  logger.error(message, {
    statusCode: code,
    stack: error.stack,
  });

  sendJSON(res, code, {
    status: "error",
    error: message,
  });
};

/**
 * Send not found response
 */
export const sendNotFound = (res: any, message: string): void => {
  sendJSON(res, 404, {
    status: "error",
    error: message,
  });
};

/**
 * Send validation error response
 */
export const sendValidationError = (res: any, errors: any): void => {
  logger.warn("Validation error", { errors });

  sendJSON(res, 400, {
    status: "error",
    error: "Validation failed",
    details: errors,
  });
};

/**
 * Wrapper para handlers con manejo automático de errores
 */
export const asyncHandler = (
  handler: (bot: any, req: any, res: any) => Promise<void>
) => {
  return async (bot: any, req: any, res: any) => {
    try {
      await handler(bot, req, res);
    } catch (error) {
      sendError(res, error);
    }
  };
};
