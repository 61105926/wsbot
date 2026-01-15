# Integración de Gemini AI para Mensajes Naturales

## ✅ Implementación Completada

Se ha integrado Google Gemini AI para que el bot genere mensajes naturales y personalizados, como si fueran escritos por una persona real en lugar de un bot automatizado.

## 📦 Instalación

Ejecuta el siguiente comando para instalar el SDK de Gemini:

```bash
cd wsbot
pnpm add @google/generative-ai
```

## 🔧 Configuración

La API key de Gemini ya está configurada en el código:
- **API Key:** `AIzaSyDx-wU2etgYib2e2QdAUtRk2QRznlHhC6A`
- **Ubicación:** `src/config/config.ts`

Si quieres usar una variable de entorno, agrega a tu `.env`:
```bash
GEMINI_API_KEY=AIzaSyDx-wU2etgYib2e2QdAUtRk2QRznlHhC6A
GEMINI_ENABLED=true  # false para deshabilitar
```

## 🎯 Funcionalidades

### 1. **Mensajes de Boletas de Pago**
- Genera mensajes únicos y naturales para cada usuario
- Personaliza según nombre, cargo, regional
- Varía el estilo (formal/casual) automáticamente
- Evita patrones repetitivos que Meta detecta como spam

### 2. **Mensajes Regionales**
- Reescribe mensajes masivos de forma natural
- Personaliza según el usuario
- Mantiene la información importante pero con estilo humano

### 3. **Fallback Automático**
- Si Gemini falla o está deshabilitado, usa el sistema tradicional
- No interrumpe el funcionamiento del bot

## 📝 Archivos Modificados

1. **`src/services/geminiService.ts`** (NUEVO)
   - Servicio principal para interactuar con Gemini
   - Métodos para generar diferentes tipos de mensajes

2. **`src/services/messageBuilder.service.ts`** (MODIFICADO)
   - Ahora usa Gemini para generar mensajes naturales
   - Mantiene compatibilidad con el sistema anterior

3. **`src/config/config.ts`** (MODIFICADO)
   - Agregada configuración de Gemini

4. **`src/handlers/sendPayslipLinks.ts`** (MODIFICADO)
   - Ahora usa mensajes generados por Gemini

5. **`src/handlers/sendRegionalMessages.ts`** (MODIFICADO)
   - Ahora usa mensajes generados por Gemini

## 🚀 Beneficios

1. **Evita Detección de Spam:**
   - Cada mensaje es único y natural
   - No hay patrones repetitivos
   - Meta no puede detectar mensajes idénticos

2. **Mejor Experiencia de Usuario:**
   - Los mensajes parecen escritos por una persona real
   - Más amigables y profesionales
   - Personalizados según el usuario

3. **Flexibilidad:**
   - Se puede deshabilitar fácilmente con `GEMINI_ENABLED=false`
   - Fallback automático si hay problemas

## ⚙️ Uso

El sistema funciona automáticamente. Cuando se envían mensajes:

1. **Boletas de Pago:**
   ```typescript
   const message = await MessageBuilderService.buildPayslipMessage(user, month);
   // Gemini genera un mensaje único y natural
   ```

2. **Mensajes Regionales:**
   ```typescript
   const message = await MessageBuilderService.replaceVariables(
     baseMessage, 
     { nombre: user.fullName, link: user.linkURL },
     { regional: user.regional, cargo: user.cargo }
   );
   // Gemini reescribe el mensaje de forma natural
   ```

## 🔍 Monitoreo

Los logs incluyen información sobre el uso de Gemini:
- ✅ Mensajes generados exitosamente
- ❌ Errores (con fallback automático)
- ⚠️ Advertencias cuando se usa fallback

## 📊 Ejemplo de Mensajes Generados

**Antes (Bot):**
```
📄 *Boleta de Pago – Enero 2025*

Estimad@ *Juan Pérez*,

Ponemos a tu disposición tu boleta de pago correspondiente al mes de enero 2025.

💼 *MINOIL S.A.*
_Recursos Humanos_

¡Saludos!
```

**Después (Gemini - Natural):**
```
Hola Juan, tu boleta de enero 2025 ya está lista 📄 Te la adjunto aquí. Cualquier consulta, avísame. Saludos, RRHH MINOIL
```

O variaciones como:
```
Juan, buenos días. Tu boleta de pago de enero está disponible. Te la envío adjunta. MINOIL S.A. - Recursos Humanos
```

Cada mensaje es único y natural.
