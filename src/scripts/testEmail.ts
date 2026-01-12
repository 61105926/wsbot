import { sendVacationEmail, verifyEmailConnection } from '../services/emailService';
import { logger } from '../utils/logger';

async function testEmail() {
  try {
    console.log('🔍 Verificando conexión con el servidor de correo...');
    const connectionOk = await verifyEmailConnection();
    
    if (!connectionOk) {
      console.error('❌ No se pudo verificar la conexión con el servidor de correo');
      process.exit(1);
    }
    
    console.log('✅ Conexión verificada correctamente');
    console.log('📧 Enviando correo de prueba a La Paz...');
    
    // Enviar correo de prueba
    const emailSent = await sendVacationEmail({
      empleadoNombre: 'Empleado de Prueba',
      empleadoId: 'TEST001',
      estado: 'APROBADO',
      fechas: [
        { fecha: '20-01-2024', turno: 'MAÑANA' },
        { fecha: '21-01-2024', turno: 'COMPLETO' },
        { fecha: '22-01-2024', turno: 'COMPLETO' }
      ],
      comentario: 'Este es un correo de prueba del sistema de vacaciones',
      regional: 'La Paz',
      managerNombre: 'Manager de Prueba'
    });
    
    if (emailSent) {
      console.log('✅ Correo de prueba enviado exitosamente a rrhhlpz@minoil.com.bo');
      process.exit(0);
    } else {
      console.error('❌ No se pudo enviar el correo de prueba');
      process.exit(1);
    }
  } catch (error: any) {
    console.error('❌ Error al enviar correo de prueba:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Ejecutar prueba
testEmail();
