/**
 * Configuración centralizada de la aplicación
 */

// SERVER PORTS
export const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3005;

// API ENDPOINTS
export const API_CONFIG = {
  // Survey API (usuarios y regionales)
  SURVEY_API: process.env.SURVEY_API_URL || "http://190.171.225.68:8006/api/survey",

  // Payslip API (boletas de pago)
  PAYSLIP_API_BASE: process.env.PAYSLIP_API_URL || "http://190.171.225.68:8006/api/boleta",

  // Employee API (datos de empleado para vacaciones)
  EMPLOYEE_API: process.env.EMPLOYEE_API_URL || "http://190.171.225.68:8006/api/emp",

  // Backend API (Laravel - si se usa en el futuro)
  BACKEND_API: process.env.BACKEND_API || "http://localhost",
  
  // Gemini AI API Key
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "AIzaSyAH2doRRVBHE80dVE4qgUkeylffPMT0bAI",
} as const;

// Gemini AI Configuration
export const GEMINI_CONFIG = {
  API_KEY: API_CONFIG.GEMINI_API_KEY,
  ENABLED: process.env.GEMINI_ENABLED !== 'false', // Habilitado por defecto
} as const;

// FRONTEND URLs
export const FRONTEND_CONFIG = {
  // URL base del frontend
  BASE_URL: process.env.FRONTEND_URL || "https://hrx.minoil.com.bo",

  // Rutas específicas
  VACATION_REQUEST: "/vacaciones",
} as const;

// Environment
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const IS_PRODUCTION = NODE_ENV === 'production';
export const IS_DEVELOPMENT = NODE_ENV === 'development';

// Logging
export const LOG_LEVEL = process.env.LOG_LEVEL || (IS_PRODUCTION ? 'info' : 'debug');
