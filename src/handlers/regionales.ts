import { getRegionales } from "../services/getRegionales";
import { Bot } from "./bot,interface";

export const regionalesHandler = async (bot: Bot, req: any, res: any) => {
  try {
    const regionales = await getRegionales();

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        regionales: regionales
      })
    );
  } catch (error) {
    console.error("❌ Error en regionales:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Error en el servidor" }));
  }
};
