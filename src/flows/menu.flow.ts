import { addKeyword, EVENTS } from "@builderbot/bot";

import { invalidFlow } from "./invalidFlow";
import { getMonthsFlow } from "./getMonthsFlow";

const menuAnswer = `
😊 *¡Gracias por comunicarte con RRHH!* 😊

📄 *Solicitud de Boletas de Pago* 📄

Para solicitar tu boleta de pago, por favor escribe el *número 1*.

*1. Boleta de Pago 📑*

Luego, selecciona el mes de la boleta de pago que necesites. 🗓️

`;

const answerActions = {
  "1": getMonthsFlow,

};

export const menuFlow = addKeyword([EVENTS.WELCOME, "menu"])
  .addAnswer(menuAnswer)  // Sin imagen para evitar error en producción
  .addAction({ capture: true }, async (ctx, { gotoFlow }) => {

    const flow =
      answerActions[ctx.body as keyof typeof answerActions] || invalidFlow;

    gotoFlow(flow);
  });