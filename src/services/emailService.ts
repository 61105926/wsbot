import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

// Configuración de correo electrónico
// cPanel mail server - El puerto 2080 es para CalDAV/CardDAV, no para SMTP
// Para SMTP en cPanel normalmente se usa:
// - mail.minoil.com.bo o smtp.minoil.com.bo
// - Puerto 587 (STARTTLS) o 465 (SSL) o 25
const EMAIL_CONFIG = {
  host: 'mail.minoil.com.bo', // Servidor SMTP de cPanel
  port: 587, // Puerto estándar para STARTTLS (también puede ser 465 para SSL o 25)
  secure: false, // false para 587 (usa STARTTLS), true para 465 (SSL directo)
  auth: {
    user: 'vacaciones@minoil.com.bo',
    pass: 'Gestion2025*'
  }
};

// Mapeo de regiones a correos
const REGIONAL_EMAILS: Record<string, string> = {
  'Cochabamba': 'rrhhlpz@minoil.com.bo',
  'La Paz': 'rrhhlpz@minoil.com.bo',
  'Santa Cruz': 'rrhhscz@minoil.com.bo'
};

// Crear transporter de nodemailer
let transporter: nodemailer.Transporter | null = null;

// Configuraciones alternativas para probar
const SMTP_CONFIGS = [
  { port: 587, secure: false, requireTLS: true, name: '587 STARTTLS' },
  { port: 465, secure: true, requireTLS: false, name: '465 SSL' },
  { port: 25, secure: false, requireTLS: false, name: '25 Plain' }
];

const createTransporter = (configIndex: number = 0): nodemailer.Transporter => {
  const smtpConfig = SMTP_CONFIGS[configIndex] || SMTP_CONFIGS[0];
  
  logger.info(`🔧 Creando transporter SMTP con configuración: ${smtpConfig.name}`, {
    host: EMAIL_CONFIG.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure
  });
  
  // Siempre crear un nuevo transporter para poder probar diferentes configuraciones
  return nodemailer.createTransport({
    host: EMAIL_CONFIG.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    auth: EMAIL_CONFIG.auth,
    requireTLS: smtpConfig.requireTLS,
    tls: {
      rejectUnauthorized: false, // Permitir certificados autofirmados (común en servidores propios)
      ciphers: 'SSLv3'
    },
    connectionTimeout: 20000, // 20 segundos
    greetingTimeout: 20000,
    socketTimeout: 20000,
    debug: false // Deshabilitado para evitar problemas con el logger
  } as any);
};

export interface Reemplazante {
  emp_id: string;
  nombre: string;
  telefono?: string;
}

export interface VacationEmailData {
  empleadoNombre: string;
  empleadoId: string;
  estado: 'APROBADO' | 'RECHAZADO' | 'SUGERENCIA';
  fechas: Array<{ fecha: string; turno: string }>;
  comentario?: string;
  regional?: string;
  managerNombre?: string;
  reemplazantes?: Reemplazante[];
}

/**
 * Envía un correo electrónico de notificación de vacaciones
 */
export async function sendVacationEmail(data: VacationEmailData): Promise<boolean> {
  try {
    // Determinar destinatario según la regional
    const toEmail = data.regional && REGIONAL_EMAILS[data.regional] 
      ? REGIONAL_EMAILS[data.regional] 
      : REGIONAL_EMAILS['La Paz']; // Default a La Paz
    
    // Determinar asunto según el estado
    let subject = '';
    let estadoTexto = '';
    switch (data.estado) {
      case 'APROBADO':
        subject = `✅ Vacación Aprobada - ${data.empleadoNombre}`;
        estadoTexto = 'APROBADA';
        break;
      case 'RECHAZADO':
        subject = `❌ Vacación Rechazada - ${data.empleadoNombre}`;
        estadoTexto = 'RECHAZADA';
        break;
      case 'SUGERENCIA':
        subject = `💡 Sugerencia de Vacación - ${data.empleadoNombre}`;
        estadoTexto = 'SUGERENCIA';
        break;
    }
    
    // Formatear fechas para texto plano
    const fechasTexto = data.fechas
      .map((f, idx) => `${idx + 1}. ${f.fecha} - ${f.turno}`)
      .join('\n');
    
    // Generar calendario visual HTML
    const generarCalendarioHTML = (fechas: Array<{ fecha: string; turno: string }>) => {
      const nombresMeses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                           'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
      const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      
      return fechas.map((f, idx) => {
        // Parsear fecha (formato: DD-MM-YYYY o YYYY-MM-DD)
        let fechaObj: Date;
        if (f.fecha.includes('-')) {
          const partes = f.fecha.split('-');
          if (partes[0].length === 4) {
            // YYYY-MM-DD
            fechaObj = new Date(parseInt(partes[0]), parseInt(partes[1]) - 1, parseInt(partes[2]));
          } else {
            // DD-MM-YYYY
            fechaObj = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]));
          }
        } else {
          fechaObj = new Date(f.fecha);
        }
        
        const dia = fechaObj.getDate();
        const mes = nombresMeses[fechaObj.getMonth()];
        const año = fechaObj.getFullYear();
        const diaSemana = diasSemana[fechaObj.getDay()];
        
        // Determinar color del badge según el turno
        let turnoClass = 'turno-completo';
        let turnoTexto = f.turno || 'COMPLETO';
        if (f.turno === 'MAÑANA') {
          turnoClass = 'turno-manana';
          turnoTexto = 'MAÑANA';
        } else if (f.turno === 'TARDE') {
          turnoClass = 'turno-tarde';
          turnoTexto = 'TARDE';
        }
        
        return `
          <div class="calendar-card">
            <div class="calendar-header">
              <div class="calendar-day">${dia}</div>
              <div class="calendar-month">${mes}</div>
            </div>
            <div class="calendar-body">
              <div class="calendar-year">${año}</div>
              <div class="calendar-weekday">${diaSemana}</div>
              <div class="calendar-turno ${turnoClass}">${turnoTexto}</div>
            </div>
          </div>
        `;
      }).join('');
    };
    
    const calendarioHTML = generarCalendarioHTML(data.fechas);
    
    // Construir cuerpo del correo con diseño corporativo profesional
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body { 
            font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; 
            line-height: 1.6; 
            color: #2c3e50; 
            margin: 0; 
            padding: 0; 
            background-color: #f5f7fa;
          }
          .email-wrapper {
            background-color: #f5f7fa;
            padding: 40px 20px;
          }
          .container { 
            max-width: 650px; 
            margin: 0 auto; 
            background-color: #ffffff; 
            border-radius: 4px; 
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            border: 1px solid #e1e8ed;
          }
          .header { 
            background: linear-gradient(135deg, #357abd 0%, #2a5f8f 100%);
            padding: 35px 40px; 
            border-bottom: 3px solid #ffc107;
          }
          .header h2 {
            margin: 0;
            font-size: 22px;
            font-weight: 600;
            color: #ffffff;
            letter-spacing: 0.5px;
          }
          .content { 
            padding: 40px; 
            background-color: #ffffff;
          }
          .section-title {
            font-size: 14px;
            font-weight: 600;
            color: #357abd;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 15px;
            padding-bottom: 8px;
            border-bottom: 2px solid #e1e8ed;
          }
          .info-grid {
            display: table;
            width: 100%;
            margin-bottom: 25px;
          }
          .info-item {
            display: table-row;
          }
          .info-label {
            display: table-cell;
            padding: 12px 15px 12px 0;
            font-weight: 600;
            color: #5a6c7d;
            font-size: 13px;
            width: 140px;
            vertical-align: top;
          }
          .info-value {
            display: table-cell;
            padding: 12px 0;
            color: #2c3e50;
            font-size: 14px;
            vertical-align: top;
          }
          .estado-badge {
            display: inline-block;
            padding: 6px 14px;
            border-radius: 3px;
            font-weight: 600;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .aprobado { 
            background-color: #28a745; 
            color: #ffffff;
          }
          .rechazado { 
            background-color: #dc3545; 
            color: #ffffff;
          }
          .sugerencia { 
            background-color: #ffc107; 
            color: #2c3e50;
          }
          .fechas-section {
            background-color: #fffbf0;
            border: 1px solid #ffeaa7;
            border-left: 4px solid #ffc107;
            padding: 20px;
            margin: 25px 0;
            border-radius: 3px;
          }
          .fechas-section h3 {
            margin: 0 0 15px 0;
            color: #2c3e50;
            font-size: 15px;
            font-weight: 600;
          }
          .fechas-list {
            font-family: 'Courier New', 'Consolas', monospace;
            font-size: 13px;
            line-height: 2;
            color: #2c3e50;
            margin: 0;
            background-color: #ffffff;
            padding: 15px;
            border-radius: 3px;
            border: 1px solid #e1e8ed;
          }
          .comentario-section {
            background-color: #f8f9fa;
            border-left: 4px solid #357abd;
            padding: 20px;
            margin: 25px 0;
            border-radius: 3px;
          }
          .comentario-section strong {
            color: #357abd;
            display: block;
            margin-bottom: 10px;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .comentario-section p {
            margin: 0;
            color: #2c3e50;
            font-size: 14px;
            line-height: 1.6;
          }
          .reemplazantes-section {
            background-color: #e8f4f8;
            border-left: 4px solid #357abd;
            padding: 20px;
            margin: 25px 0;
            border-radius: 3px;
          }
          .reemplazantes-section h3 {
            margin: 0 0 15px 0;
            color: #2c3e50;
            font-size: 15px;
            font-weight: 600;
          }
          .reemplazante-item {
            background-color: #ffffff;
            padding: 12px 15px;
            margin: 8px 0;
            border-radius: 4px;
            border: 1px solid #d1ecf1;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .reemplazante-info {
            flex: 1;
          }
          .reemplazante-nombre {
            font-weight: 600;
            color: #2c3e50;
            font-size: 14px;
            margin-bottom: 4px;
          }
          .reemplazante-details {
            font-size: 12px;
            color: #6c757d;
          }
          .reemplazante-badge {
            background-color: #357abd;
            color: #ffffff;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .footer { 
            padding: 25px 40px;
            background-color: #f8f9fa;
            border-top: 1px solid #e1e8ed;
            text-align: center;
            font-size: 11px; 
            color: #6c757d;
            line-height: 1.6;
          }
          .footer p {
            margin: 4px 0;
          }
          .divider {
            height: 1px;
            background-color: #e1e8ed;
            margin: 30px 0;
          }
          .calendar-container {
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            margin: 20px 0;
          }
          .calendar-card {
            flex: 0 0 calc(33.333% - 10px);
            min-width: 140px;
            background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
            border: 2px solid #e1e8ed;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
            transition: transform 0.2s;
          }
          .calendar-header {
            background: linear-gradient(135deg, #357abd 0%, #2a5f8f 100%);
            padding: 12px;
            text-align: center;
            color: #ffffff;
          }
          .calendar-day {
            font-size: 32px;
            font-weight: 700;
            line-height: 1;
            margin-bottom: 4px;
          }
          .calendar-month {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 1px;
            opacity: 0.9;
          }
          .calendar-body {
            padding: 12px;
            text-align: center;
          }
          .calendar-year {
            font-size: 11px;
            color: #6c757d;
            margin-bottom: 6px;
            font-weight: 500;
          }
          .calendar-weekday {
            font-size: 12px;
            color: #5a6c7d;
            margin-bottom: 8px;
            font-weight: 600;
          }
          .calendar-turno {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .turno-completo {
            background-color: #357abd;
            color: #ffffff;
          }
          .turno-manana {
            background-color: #ffc107;
            color: #2c3e50;
          }
          .turno-tarde {
            background-color: #ff9800;
            color: #ffffff;
          }
          @media (max-width: 600px) {
            .calendar-card {
              flex: 0 0 calc(50% - 8px);
            }
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="container">
            <div class="header">
              <h2>Notificación de Vacaciones</h2>
            </div>
            <div class="content">
              <div class="section-title">Información de la Solicitud</div>
              
              <div class="info-grid">
                <div class="info-item">
                  <div class="info-label">Estado:</div>
                  <div class="info-value">
                    <span class="estado-badge ${data.estado.toLowerCase()}">${estadoTexto}</span>
                  </div>
                </div>
                <div class="info-item">
                  <div class="info-label">Empleado:</div>
                  <div class="info-value">${data.empleadoNombre} <span style="color: #6c757d;">(ID: ${data.empleadoId})</span></div>
                </div>
                ${data.managerNombre ? `
                <div class="info-item">
                  <div class="info-label">Gestionado por:</div>
                  <div class="info-value">${data.managerNombre}</div>
                </div>
                ` : ''}
                ${data.regional ? `
              
                ` : ''}
              </div>
              
              <div class="divider"></div>
              
              <div class="fechas-section">
                <h3>Fechas Solicitadas</h3>
                <div class="calendar-container">
                  ${calendarioHTML}
                </div>
              </div>
              
              ${data.reemplazantes && data.reemplazantes.length > 0 ? `
              <div class="reemplazantes-section">
                <h3>Reemplazantes Asignados</h3>
                ${data.reemplazantes.map((rep, idx) => `
                  <div class="reemplazante-item">
                    <div class="reemplazante-info">
                      <div class="reemplazante-nombre">${rep.nombre}</div>
                      <div class="reemplazante-details">
                        Tel: ${rep.telefono ? rep.telefono : 'N/A'}
                      </div>
                    </div>
                    <span class="reemplazante-badge">Reemplazo</span>
                  </div>
                `).join('')}
              </div>
              ` : ''}
              
              ${data.comentario ? `
              <div class="comentario-section">
                <strong>Comentario</strong>
                <p>${data.comentario}</p>
              </div>
              ` : ''}
            </div>
            <div class="footer">
              <p><strong>MINOIL</strong> - Sistema de Gestión de Recursos Humanos</p>
              <p>Este es un correo automático generado por el sistema. Por favor, no responder a este mensaje.</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const textBody = `
Notificación de Vacaciones

Estado: ${estadoTexto}
Empleado: ${data.empleadoNombre} (ID: ${data.empleadoId})
${data.managerNombre ? `Gestionado por: ${data.managerNombre}\n` : ''}
${data.regional ? `Regional: ${data.regional}\n` : ''}

Fechas solicitadas:
${fechasTexto}

${data.reemplazantes && data.reemplazantes.length > 0 ? `
Reemplazantes asignados:
${data.reemplazantes.map((rep, idx) => `${idx + 1}. ${rep.nombre} (ID: ${rep.emp_id}${rep.telefono ? `, Tel: ${rep.telefono}` : ''})`).join('\n')}
` : ''}

${data.comentario ? `Comentario: ${data.comentario}\n` : ''}

---
Este es un correo automático del sistema de gestión de vacaciones.
    `.trim();
    
    // Intentar con diferentes configuraciones SMTP
    let lastError: any = null;
    for (let i = 0; i < SMTP_CONFIGS.length; i++) {
      try {
        const transporter = createTransporter(i);
        const smtpConfig = SMTP_CONFIGS[i];
        
        logger.info(`🔄 Intentando enviar correo con configuración: ${smtpConfig.name}`, {
          from: EMAIL_CONFIG.auth.user,
          to: toEmail,
          host: EMAIL_CONFIG.host,
          port: smtpConfig.port
        });
        
        const info = await transporter.sendMail({
          from: `"Sistema de Vacaciones" <${EMAIL_CONFIG.auth.user}>`,
          to: toEmail,
          subject: subject,
          text: textBody,
          html: htmlBody
        });
        
        logger.info(`✅ Correo de vacación enviado exitosamente con configuración: ${smtpConfig.name}`, {
          messageId: info.messageId,
          to: toEmail,
          estado: data.estado,
          empleado: data.empleadoNombre,
          response: info.response,
          config: smtpConfig.name
        });
        
        return true;
      } catch (error: any) {
        lastError = error;
        // Si no es el último intento, continuar con la siguiente configuración
        if (i < SMTP_CONFIGS.length - 1) {
          logger.warn(`⚠️ Configuración ${SMTP_CONFIGS[i].name} falló, intentando siguiente...`, {
            error: error.message,
            code: error.code
          });
          continue;
        }
      }
    }
    
    // Si llegamos aquí, todos los intentos fallaron
    throw lastError || new Error('Todas las configuraciones SMTP fallaron');
  } catch (error: any) {
    // Log detallado del error
    const errorDetails: any = {
      error: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
      empleado: data.empleadoNombre,
      estado: data.estado,
      host: EMAIL_CONFIG.host
    };
    
    // Agregar stack solo si está disponible
    if (error.stack) {
      errorDetails.stack = error.stack;
    }
    
    // Si hay información de conexión, agregarla
    if (error.connection) {
      errorDetails.connection = error.connection;
    }
    
    logger.error('❌ Error al enviar correo de vacación', errorDetails);
    
    // También loguear el error completo para debugging
    console.error('Error completo del correo:', error);
    
    return false;
  }
}

/**
 * Verifica la conexión con el servidor de correo
 */
export async function verifyEmailConnection(): Promise<boolean> {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    logger.info('✅ Conexión con servidor de correo verificada');
    return true;
  } catch (error: any) {
    logger.error('❌ Error al verificar conexión de correo', {
      error: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
      stack: error.stack
    });
    return false;
  }
}
