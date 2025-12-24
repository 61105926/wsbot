# 🐳 Configuración Docker con pnpm y Aurik3

## ✅ Cambios Realizados

### 1. **Dockerfile Actualizado** ✅

El Dockerfile ahora usa **pnpm** en lugar de npm:

- ✅ Instala pnpm globalmente en ambas etapas (builder y production)
- ✅ Usa `pnpm install --frozen-lockfile` para instalación determinística
- ✅ Usa `pnpm run build` para compilar TypeScript
- ✅ Usa `pnpm install --prod --frozen-lockfile` para dependencias de producción
- ✅ Establece variable de entorno `PNPM_VERSION`

### 2. **docker-compose.yml Actualizado** ✅

- ✅ Agrega variable de entorno `PNPM_VERSION`
- ✅ Agrega volúmenes para persistencia de datos:
  - `bot_sessions/` - Sesiones de WhatsApp
  - `logs/` - Archivos de log
  - `tmp/` - Archivos temporales

### 3. **Logs en app.ts** ✅

Se agregaron logs informativos al inicio de la aplicación:

```typescript
logger.info('🚀 Iniciando aplicación', {
  packageManager: 'pnpm',
  pnpmVersion: process.env.PNPM_VERSION,
  nodeVersion: process.version,
  provider: 'Aurik3 Baileys Custom'
});

console.info("📦 Package Manager: pnpm");
console.info("🔌 Provider: Aurik3 Baileys Custom");
console.info("✅ Usando aurik3-builderbot-baileys-custom como proveedor de WhatsApp");
```

Y al finalizar la inicialización:

```typescript
logger.info('✅ Servidor iniciado correctamente', {
  port: PORT,
  packageManager: 'pnpm',
  provider: 'Aurik3 Baileys Custom',
  environment: process.env.NODE_ENV || 'development'
});
```

---

## 🚀 Cómo Usar

### Construir la Imagen

```bash
docker build -t wsbot .
```

### Ejecutar con Docker Compose

```bash
docker-compose up -d
```

### Ver Logs

```bash
docker-compose logs -f
```

Deberías ver en los logs:

```
📦 Package Manager: pnpm
🔌 Provider: Aurik3 Baileys Custom
✅ Usando aurik3-builderbot-baileys-custom como proveedor de WhatsApp
✅ Server running on port 3005
```

---

## 📋 Requisitos

- ✅ `pnpm-lock.yaml` debe estar presente en el proyecto
- ✅ `package.json` debe tener las dependencias correctas
- ✅ `aurik3-builderbot-baileys-custom` debe estar en las dependencias

---

## 🔍 Verificación

Para verificar que está usando pnpm:

```bash
docker exec wsbot pnpm --version
```

Para verificar el proveedor:

```bash
docker exec wsbot cat package.json | grep aurik3
```

---

## ✅ Estado

- ✅ Dockerfile configurado para pnpm
- ✅ docker-compose.yml actualizado
- ✅ Logs informativos agregados
- ✅ Variables de entorno configuradas
- ✅ Volúmenes para persistencia configurados

**¡Todo listo para usar con pnpm y Aurik3!** 🎉

