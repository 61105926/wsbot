// Wrapper para cargar el provider de Sherpa
// Importación directa - TypeScript con esModuleInterop debería manejarlo
import type { BaileysProvider as BaileysProviderType } from 'builderbot-provider-sherpa';
import { BaileysProvider as BaileysProviderValue } from 'builderbot-provider-sherpa';

export const BaileysProvider: typeof BaileysProviderType = BaileysProviderValue;

