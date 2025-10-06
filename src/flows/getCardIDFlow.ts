import { addKeyword, EVENTS } from "@builderbot/bot";

import { getUserByPhone } from "../services/getUserByPhone";

export const getCardIDFlow = addKeyword(EVENTS.ACTION)
  .addAnswer(
    "Escribe tu *ID* (solo numeros)",
    { capture: true },
    async (ctx, { flowDynamic, endFlow }) => {
      try {
        const user = await getUserByPhone(ctx.body);
        return await flowDynamic([
          {
            body: `El nombre que corresponde a ese ID es: *${user.data.name}*`,
          },
        ]);
      } catch (error) {
        return endFlow(
          "Lo sentimos la informacion no esta disponible intente mas tarde."
        );
      }
    }
  )
  .addAnswer("Gracias escribe *menu* para volver al menu princial");
