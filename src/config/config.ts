/**
 * Configuración centralizada de la aplicación
 */

// SERVER PORTS
export const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3005;

// API ENDPOINTS
export const API_CONFIG = {
  // Survey API (usuarios y regionales)
  SURVEY_API: process.env.SURVEY_API_URL || "http://190.171.225.68/api/survey",

  // Payslip API (boletas de pago)
  PAYSLIP_API_BASE: process.env.PAYSLIP_API_URL || "http://190.171.225.68/api/boleta",

  // Employee API (datos de empleado para vacaciones)
  EMPLOYEE_API: process.env.EMPLOYEE_API_URL || "http://190.171.225.68/api/emp",

  // Backend API (Laravel - si se usa en el futuro)
  BACKEND_API: process.env.BACKEND_API || "http://localhost",
} as const;

// FRONTEND URLs
export const FRONTEND_CONFIG = {
  // URL base del frontend
  BASE_URL: process.env.FRONTEND_URL || "http://localhost:3002",

  // Rutas específicas
  VACATION_REQUEST: "/vacaciones",
} as const;

// Environment
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const IS_PRODUCTION = NODE_ENV === 'production';
export const IS_DEVELOPMENT = NODE_ENV === 'development';

// Logging
export const LOG_LEVEL = process.env.LOG_LEVEL || (IS_PRODUCTION ? 'info' : 'debug');
