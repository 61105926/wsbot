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

const logContactInfo = async (ctx: any, bot?: any) => {
  try {
    // Usar la versión async que resuelve LIDs automáticamente
    const phoneInfo = await extractRealPhoneFromContext(ctx, bot?.provider);
    const normalizedPhone = phoneInfo.normalizedPhone || phoneInfo.phone.replace(/^591/, '');
    const contactName = ctx.pushName || ctx.name || ctx.key?.remoteJid?.split('@')[0] || 'Sin nombre';
    const remoteJid = ctx.key?.remoteJid || ctx.from || 'N/A';
    
    // Mostrar información completa del contexto para debugging
    const contextInfo = [
      `   📞 Teléfono: ${phoneInfo.phone}`,
      `   📱 Teléfono normalizado (para APIs): ${normalizedPhone}`,
      `   📛 Nombre (WhatsApp): ${contactName}`,
      `   🆔 Es número real: ${phoneInfo.isRealPhone ? 'Sí' : 'No (LID)'}`,
      !phoneInfo.isRealPhone ? `   📋 LID: ${phoneInfo.lid}` : '',
      `   🔗 RemoteJID: ${remoteJid}`,
      `   🔢 Opción seleccionada: ${ctx.body || 'Ninguna'}`,
      // Información adicional del contexto para debugging
      ctx.key?.participant ? `   👥 Participant: ${ctx.key.participant}` : '',
      ctx.key?.id ? `   🆔 Message ID: ${ctx.key.id}` : '',
      ctx.key?.fromMe !== undefined ? `   📤 From Me: ${ctx.key.fromMe}` : '',
    ];
    
    process.stderr.write([
      '\n📱 ========================================',
      '👤 CONTACTO QUE ESCRIBE:',
      ...contextInfo.filter(Boolean),
      '========================================\n'
    ].join('\n') + '\n');
    
    // Retornar número real si se encontró, sino el original
    return {
      ...phoneInfo,
      normalizedPhone: normalizedPhone
    };
  } catch (error: any) {
    process.stderr.write(`❌ ERROR: ${error.message}\n`);
    return { phone: 'ERROR', isRealPhone: false, normalizedPhone: 'ERROR' };
  }
};

export const menuFlow = addKeyword([EVENTS.WELCOME, "menu"])
  .addAnswer(FLOW_MESSAGES.MENU.WELCOME)
  .addAction({ capture: true }, async (ctx, { gotoFlow, flowDynamic }) => {
    // Obtener bot del contexto global si está disponible
    const bot = (global as any).bot || ctx.bot;
    const phoneInfo = await logContactInfo(ctx, bot);
    
    // Buscar usuario en BD usando número normalizado (sin 591)
    const normalizedPhone = phoneInfo.normalizedPhone || phoneInfo.phone.replace(/^591/, '');
    
    if (phoneInfo.isRealPhone || normalizedPhone) {
      try {
        const { getAllUsers } = await import("../services/getAllUsers");
        const allUsers = await getAllUsers();
        
        // Buscar por número normalizado (sin 591)
        let user = allUsers.find(u => 
          u.phone.replace('591', '') === normalizedPhone ||
          u.phone === phoneInfo.phone ||
          u.phone.replace('591', '') === phoneInfo.phone.replace(/^591/, '')
        );
        
        // Si no se encontró y tenemos nombre, intentar buscar por nombre
        if (!user && ctx.pushName) {
          user = allUsers.find(u => 
            u.fullName?.toLowerCase().includes(ctx.pushName?.toLowerCase() || '') ||
            ctx.pushName?.toLowerCase().includes(u.fullName?.toLowerCase() || '')
          );
        }
        
        if (user) {
          process.stderr.write(`   👨‍💼 Nombre (BD): ${user.fullName}\n`);
          process.stderr.write(`   🆔 ID Empleado: ${user.empID}\n`);
          process.stderr.write(`   📞 Teléfono (BD): ${user.phone}\n`);
        } else {
          process.stderr.write(`   ⚠️  No encontrado en base de datos\n`);
        }
      } catch (error: any) {
        process.stderr.write(`   ⚠️  Error al buscar en BD: ${error.message}\n`);
      }
    }

    gotoFlow(answerActions[ctx.body] || invalidFlow);
  });
