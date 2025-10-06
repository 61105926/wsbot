import { addKeyword, EVENTS } from "@builderbot/bot";
import axios from "axios";
import fs from "fs/promises";
import { join } from "path";


function getStringDate(date: Date): string {
  const formattedDate = date.toLocaleDateString("es", { month: "long", year: "numeric" });
  const [month, year] = formattedDate.split("de");
  return `${month.toUpperCase()} ${year}`;
}


function getMonthDictionary() {
  const today = new Date();
  const months = [];
  const currentMonth = today.getMonth() - 1;
  const startMonthIndex = today.getDate() <= 2 ? 1 : 0;

  for (let i = startMonthIndex; i < startMonthIndex + 7; i++) {
    months.push(new Date(today.getFullYear(), currentMonth - i, 1));
  }

  return new Map(months.map((date, index) => [(index + 1).toString(), date]));
}

const monthsAnswer = `
📋 *Meses disponibles* 📋
${Array.from(getMonthDictionary().entries()).map(([key, date]) => `${key}. ${getStringDate(date)}\n`).join('')}
`;

export const getMonthsFlow = addKeyword([EVENTS.ACTION])
  .addAnswer(monthsAnswer)
  .addAction({ capture: true }, async (ctx, { flowDynamic, gotoFlow }) => {
    const input = ctx.body.trim();
    const monthsDicc = getMonthDictionary();
    
    const isValidNumber = /^\d+$/.test(input);
    const isValidMonth = monthsDicc.has(input);

    if (isValidNumber && isValidMonth) {
      const date = monthsDicc.get(input) || new Date();
      const phoneSanitizied = ctx.from.slice(3);

      const selectedMonth = ('0' + (date.getMonth() + 1)).slice(-2);
      const selectedYear = date.getFullYear();
      const dateParsed = `${selectedYear}${selectedMonth}`;

      try {
        await flowDynamic([{ body: "📥 Enviando documento..." }]);
        const { data: doc } = await axios.get(`http://190.171.225.68/api/boleta?numero=${phoneSanitizied}&fecha=${dateParsed}`, {
          responseType: 'arraybuffer',
          headers: { 'Accept': 'application/pdf' }
        });

        const fileName = `${getStringDate(date)}.pdf`;
        await fs.writeFile(fileName, doc);

        await flowDynamic([{ media: join(process.cwd(), fileName).replace(/\\/g, "/") }]);
      } catch (error) {
        console.error('Error:', error);
        await flowDynamic([{ body: "Tu número no se encuentra registrado. Por favor, comunícate con Recursos Humanos (RRHH)." }]);
      }
    } else {
      await flowDynamic([{ body: "Opción inválida. Por favor, selecciona un número de mes válido." }]);
      
      ctx.flowState = { showMonthsList: true }; // Forzar a mostrar la lista en caso de entrada inválida
      return gotoFlow(getMonthsFlow);
    }
  });
