import { AdvancedQueue } from "../classes/AdvancedQueue";
import { getUsersByRegions } from "../services/getUsersByRegion";
import { Bot } from "./bot,interface";
import { connectionStatus } from "../services/connectionStatus";

const queue = AdvancedQueue.instance();

export const sendRegionalMessagesHandler = async (
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
    const { messages, regions }: { messages: string; regions: string } = req.body;
    const file = req.file;

    // Parsear los datos recibidos
    const parsedMessages = JSON.parse(messages);
    const parsedRegions = JSON.parse(regions);

    console.log("📨 Iniciando envío de mensajes regionales");
    console.log("📍 Regiones:", parsedRegions);
    console.log("📝 Mensajes:", parsedMessages.length);
    console.log("🖼️ Imagen:", file ? file.filename : "Sin imagen");

    // Verificar si ya hay un proceso activo
    if (queue.isProcessing()) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ error: "Ya hay un proceso de envío en curso" })
      );
      return;
    }

    // Obtener usuarios de las regionales seleccionadas
    const users = await getUsersByRegions(parsedRegions);
    console.log("👥 Usuarios encontrados:", users.length);

    if (users.length === 0) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ error: "No se encontraron usuarios en las regionales seleccionadas" })
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

        console.log(`📤 Enviando a ${user.fullName} (${user.regional})`);

        try {
          for (let index = 0; index < parsedMessages.length; index++) {
            const message = parsedMessages[index]
              .replace("{{nombre}}", user.fullName)
              .replace("{{link}}", user.linkURL);

            // Timeout de 30 segundos para enviar el mensaje
            await Promise.race([
              // Si es el primer mensaje y hay imagen, enviarla
              index === 0 && file
                ? bot.sendMessage(user.phone, message, { media: file.path })
                : bot.sendMessage(user.phone, message, {}),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout al enviar mensaje')), 30000)
              )
            ]);
          }

          console.log(`✅ Enviado a ${user.fullName}`);
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
        message: "Envío masivo iniciado",
        totalUsers: users.length,
        regions: parsedRegions
      })
    );
  } catch (error) {
    console.error("❌ Error en sendRegionalMessages:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Error en el servidor" }));
  }
};
