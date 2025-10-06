import { AdvancedQueue } from "../classes/AdvancedQueue";
import { getAllUsers } from "../services/getAllUsers";
import { Bot } from "./bot,interface";
import { connectionStatus } from "../services/connectionStatus";
import axios from "axios";
import fs from "fs";
import path from "path";

const queue = AdvancedQueue.instance();

export const sendPayslipLinksHandler = async (
  bot: Bot,
  req: any,
  res: any
) => {
  if (!bot) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "No hay un número conectado al servidor" }));
    return;
  }

  // Verificar si WhatsApp está conectado
  if (!connectionStatus.isConnected()) {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      error: "WhatsApp no está conectado. Por favor espera a que el bot se conecte antes de enviar mensajes.",
      connected: false
    }));
    return;
  }

  try {
    const { month }: { month: string } = req.body;

    // Validar formato del mes (YYYYMM)
    if (!month || !/^\d{6}$/.test(month)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ error: "Formato de mes inválido. Use YYYYMM (ejemplo: 202409)" })
      );
      return;
    }

    console.log("📄 Iniciando envío de boletas masivas");
    console.log("📅 Mes:", month);

    // Verificar si ya hay un proceso activo
    if (queue.isProcessing()) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ error: "Ya hay un proceso de envío en curso" })
      );
      return;
    }

    // Obtener todos los usuarios
    const users = await getAllUsers();
    console.log("👥 Usuarios encontrados:", users.length);

    if (users.length === 0) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ error: "No se encontraron usuarios" })
      );
      return;
    }

    // Iniciar nuevo lote
    queue.startBatch(users.length);

    // Agregar tareas a la cola
    for (const user of users) {
      queue.add(async () => {
        // Delay de 10-13 segundos entre usuarios (RIESGO EXTREMO DE BLOQUEO)
        const randomDelay = Math.floor(Math.random() * 3000) + 10000; // 10-13 segundos
        await new Promise((resolve) => setTimeout(resolve, randomDelay));

        console.log(`📤 Enviando boleta a ${user.fullName} (${user.phone})`);

        try {
          console.log(`🔄 Iniciando envío para ${user.fullName}...`);

          // Obtener el link de la boleta directamente con el formato nuevo
          // Quitar prefijo 591 - la API espera solo 8 dígitos
          const phoneNumber = user.phone.substring(3);
          const payslipLink = `http://190.171.225.68/api/boleta?numero=${phoneNumber}&fecha=${month}`;

          // Convertir mes YYYYMM a nombre del mes
          const year = month.substring(0, 4);
          const monthNum = parseInt(month.substring(4, 6));
          const monthNames = [
            'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
            'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
          ];
          const monthName = monthNames[monthNum - 1];
          const monthNameCapitalized = monthName.charAt(0) + monthName.slice(1).toLowerCase();

          // Nombre del archivo PDF: "Nombre Mes Año.pdf"
          const fileName = `${user.fullName} ${monthNameCapitalized} ${year}.pdf`;

          // Variaciones de saludo (aleatorio)
          const saludos = [
            `Estimad@ *${user.fullName}*,`,
            `Hola *${user.fullName}*,`,
            `Buen día *${user.fullName}*,`,
            `Saludos *${user.fullName}*,`
          ];
          const saludo = saludos[Math.floor(Math.random() * saludos.length)];

          // Variaciones de despedida (aleatorio)
          const despedidas = [
            '¡Saludos!',
            'Gracias.',
            'Que tenga buen día.',
            'Saludos cordiales.'
          ];
          const despedida = despedidas[Math.floor(Math.random() * despedidas.length)];

          // Mensaje con variaciones aleatorias
          const message = `📄 *Boleta de Pago – ${monthNameCapitalized} ${year}*\n\n${saludo}\n\nPonemos a tu disposición tu boleta de pago correspondiente al mes de ${monthNameCapitalized.toLowerCase()} ${year}.\n\n\n💼 *MINOIL S.A.*\n_Recursos Humanos_\n\n${despedida}`;

          console.log(`📥 Descargando PDF desde: ${payslipLink}`);

          // Descargar el PDF de la API
          const pdfResponse = await axios.get(payslipLink, {
            responseType: 'arraybuffer',
            timeout: 30000
          });

          // Guardar el PDF temporalmente con el nombre final
          const tmpDir = path.join(__dirname, '../../tmp');
          if (!fs.existsSync(tmpDir)) {
            fs.mkdirSync(tmpDir, { recursive: true });
          }

          // Usar el fileName como nombre del archivo temporal
          const pdfPath = path.join(tmpDir, fileName);
          fs.writeFileSync(pdfPath, pdfResponse.data);

          console.log(`📁 PDF guardado en: ${pdfPath}`);

          // MENSAJE ÚNICO: Enviar texto + PDF juntos (timeout 40s)
          console.log(`📤 Enviando mensaje + PDF a ${user.fullName}...`);
          await Promise.race([
            bot.sendMessage(user.phone, message, { media: pdfPath }),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Timeout al enviar mensaje')), 40000)
            )
          ]);

          // Eliminar archivo temporal
          try {
            fs.unlinkSync(pdfPath);
          } catch (e) {
            // Ignorar error si no se puede eliminar
          }

          console.log(`✅ Boleta enviada a ${user.fullName} - ${fileName}`);
        } catch (error: any) {
          console.error(`❌ Error enviando a ${user.fullName}:`, error.message || error);
          // No lanzar el error para continuar con los siguientes usuarios
        }

        return;
      });
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "success",
        message: "Envío masivo de boletas iniciado",
        month: month,
        totalUsers: users.length
      })
    );
  } catch (error) {
    console.error("❌ Error en sendPayslipLinks:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Error en el servidor" }));
  }
};
