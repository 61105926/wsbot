import { addKeyword, utils } from "@builderbot/bot";
import { SendWaveProvider as Provider } from "@gamastudio/sendwave-provider";
import { logger } from "../utils/logger";

/**
 * Flow que se activa cuando un usuario ha estado inactivo por mucho tiempo
 * Se integra con el sistema de Queue Flow de SendWave
 * 
 * Este flow se ejecuta automáticamente cuando:
 * - El usuario ha estado inactivo por más de 30 minutos (warningTimeout)
 * - Y luego por 2 minutos más después de la advertencia (endTimeout)
 */
export const flowEnd = addKeyword<Provider>(utils.setEvent("END_FLOW"))
  .addAction(async (ctx, { endFlow, provider }) => {
    const phone = ctx.from;
    
    logger.info('Flow END activado por inactividad', {
      phone,
      userName: ctx.pushName || 'Usuario desconocido'
    });

    try {
      // Limpiar usuario del sistema de Queue Flow
      if (provider && typeof provider.forceClearUser === 'function') {
        provider.forceClearUser(phone);
        logger.info('Usuario limpiado del sistema de Queue Flow', { phone });
      }
    } catch (error: any) {
      logger.warn('Error al limpiar usuario del Queue Flow', {
        error: error.message,
        phone
      });
    }

    // Mensaje de despedida variado
    const farewellMessages = [
      "La sesión se cerró por inactividad. Escríbeme de nuevo cuando necesites ayuda. 👋",
      "No recibí respuesta, así que cerré la sesión. Cuando necesites algo, escríbeme. 👍",
      "Sesión cerrada por inactividad. Estoy aquí cuando me necesites. 👋",
      "Como no hubo actividad, cerré la sesión. Escríbeme cuando quieras continuar. 👋"
    ];
    
    const farewellMessage = farewellMessages[
      Math.floor(Math.random() * farewellMessages.length)
    ];

    return endFlow(farewellMessage);
  });
