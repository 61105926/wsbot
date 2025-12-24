import { addKeyword, EVENTS } from "@builderbot/bot";
import { invalidFlow } from "./invalidFlow";
import { getMonthsFlow } from "./getMonthsFlow";
import { vacationRequestFlow } from "./vacationRequestFlow";
import { FLOW_MESSAGES } from "../config/flowMessages";
import { extractRealPhoneFromContext } from "../utils/phoneHelper";

const answerActions: Record<string, any> = {
  "1": getMonthsFlow,
  "2": vacationRequestFlow,
};

const logContactInfo = (ctx: any) => {
  try {
    const phoneInfo = extractRealPhoneFromContext(ctx);
    const contactName = ctx.pushName || ctx.name || ctx.key?.remoteJid?.split('@')[0] || 'Sin nombre';
    const remoteJid = ctx.key?.remoteJid || ctx.from || 'N/A';
    
    process.stderr.write([
      '\n📱 ========================================',
      '👤 CONTACTO QUE ESCRIBE:',
      `   📞 Teléfono: ${phoneInfo.phone}`,
      `   📛 Nombre (WhatsApp): ${contactName}`,
      `   🆔 Es número real: ${phoneInfo.isRealPhone ? 'Sí' : 'No (LID)'}`,
      !phoneInfo.isRealPhone ? `   📋 LID: ${phoneInfo.lid}` : '',
      `   🔗 RemoteJID: ${remoteJid}`,
      `   🔢 Opción seleccionada: ${ctx.body || 'Ninguna'}`,
      '========================================\n'
    ].filter(Boolean).join('\n') + '\n');
    
    return phoneInfo;
  } catch (error: any) {
    process.stderr.write(`❌ ERROR: ${error.message}\n`);
    return { phone: 'ERROR', isRealPhone: false };
  }
};

export const menuFlow = addKeyword([EVENTS.WELCOME, "menu"])
  .addAnswer(FLOW_MESSAGES.MENU.WELCOME)
  .addAction({ capture: true }, async (ctx, { gotoFlow }) => {
    const phoneInfo = logContactInfo(ctx);
    
    // Buscar usuario en BD si es número real
    if (phoneInfo.isRealPhone) {
      try {
        const { getAllUsers } = await import("../services/getAllUsers");
        const allUsers = await getAllUsers();
        const user = allUsers.find(u => 
          u.phone === phoneInfo.phone || u.phone.replace('591', '') === phoneInfo.phone.replace('591', '')
        );
        
        if (user) {
          process.stderr.write(`   👨‍💼 Nombre (BD): ${user.fullName}\n`);
          process.stderr.write(`   🆔 ID Empleado: ${user.empID}\n`);
        }
      } catch (error: any) {
        process.stderr.write(`   ⚠️  Error al buscar en BD: ${error.message}\n`);
      }
    }

    gotoFlow(answerActions[ctx.body] || invalidFlow);
  });
