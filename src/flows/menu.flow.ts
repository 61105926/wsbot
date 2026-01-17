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
    const phoneInfo = extractRealPhoneFromContext(ctx);
    const contactName = ctx.pushName || ctx.name || ctx.key?.remoteJid?.split('@')[0] || 'Sin nombre';
    const remoteJid = ctx.key?.remoteJid || ctx.from || 'N/A';
    console.log(phoneInfo);
    // Intentar obtener número real desde el provider si es LID
    let realPhoneFromProvider: string | null = null;
    if (!phoneInfo.isRealPhone && bot?.provider) {
      try {
        // Intentar usar métodos del provider para obtener el número real
        const lidJid = phoneInfo.lid.includes('@') ? phoneInfo.lid : `${phoneInfo.lid}@lid`;
        
        // Intentar obtener información del contacto usando el provider
        if (bot.provider.vendor && typeof bot.provider.vendor.onWhatsApp === 'function') {
          try {
            const result = await bot.provider.vendor.onWhatsApp([lidJid]);
            if (result && result.length > 0 && result[0]?.jid) {
              const jid = result[0].jid;
              if (jid.endsWith('@s.whatsapp.net')) {
                const match = jid.match(/^(\d+)@s\.whatsapp\.net$/);
                if (match && match[1]) {
                  realPhoneFromProvider = match[1];
                }
              }
            }
          } catch (e) {
            // Silenciar error, no todos los providers tienen este método
          }
        }
      } catch (error: any) {
        // Silenciar error al intentar obtener número real
      }
    }
    
    // Mostrar información completa del contexto para debugging
    const contextInfo = [
      `   📞 Teléfono: ${phoneInfo.phone}`,
      realPhoneFromProvider ? `   📱 Número real (desde provider): ${realPhoneFromProvider}` : '',
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
      phone: realPhoneFromProvider || phoneInfo.phone,
      isRealPhone: realPhoneFromProvider ? true : phoneInfo.isRealPhone,
      realPhoneFromProvider: realPhoneFromProvider || undefined
    };
  } catch (error: any) {
    process.stderr.write(`❌ ERROR: ${error.message}\n`);
    return { phone: 'ERROR', isRealPhone: false };
  }
};

export const menuFlow = addKeyword([EVENTS.WELCOME, "menu"])
  .addAnswer(FLOW_MESSAGES.MENU.WELCOME)
  .addAction({ capture: true }, async (ctx, { gotoFlow, flowDynamic }) => {
    // Obtener bot del contexto global si está disponible
    const bot = (global as any).bot || ctx.bot;
    const phoneInfo = await logContactInfo(ctx, bot);
    
    // Buscar usuario en BD usando número real (si se encontró) o por nombre
    const phoneInfoWithProvider = phoneInfo as typeof phoneInfo & { realPhoneFromProvider?: string };
    const searchPhone = phoneInfoWithProvider.realPhoneFromProvider || phoneInfo.phone;
    const isReal = phoneInfo.isRealPhone || !!phoneInfoWithProvider.realPhoneFromProvider;
    
    if (isReal || phoneInfoWithProvider.realPhoneFromProvider) {
      try {
        const { getAllUsers } = await import("../services/getAllUsers");
        const allUsers = await getAllUsers();
        
        // Buscar por número
        let user = allUsers.find(u => 
          u.phone === searchPhone || 
          u.phone.replace('591', '') === searchPhone.replace('591', '') ||
          searchPhone.replace('591', '') === u.phone.replace('591', '')
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
