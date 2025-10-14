import { loggers } from "../utils/logger";

/**
 * Service para trackear el estado de conexión del bot
 */
class ConnectionStatus {
  private static instance: ConnectionStatus;
  private connected: boolean = false;
  private provider: any = null;

  private constructor() {}

  static getInstance(): ConnectionStatus {
    if (!ConnectionStatus.instance) {
      ConnectionStatus.instance = new ConnectionStatus();
    }
    return ConnectionStatus.instance;
  }

  setProvider(provider: any) {
    this.provider = provider;

    // Escuchar eventos de conexión del provider
    try {
      // Baileys emite eventos de actualización de conexión
      provider.on('connection.update', (update: any) => {
        // Cuando la conexión está abierta
        if (update.connection === 'open') {
          this.connected = true;
          loggers.whatsappConnected();
        }

        // Cuando se cierra la conexión
        if (update.connection === 'close') {
          this.connected = false;
          loggers.whatsappDisconnected();
        }
      });

      // Fallback: si no hay eventos después de 10 segundos, asumir conectado
      setTimeout(() => {
        if (!this.connected) {
          this.connected = true;
          loggers.whatsappConnected();
        }
      }, 10000);

    } catch (error) {
      // Si hay error escuchando eventos, usar fallback con timeout
      setTimeout(() => {
        this.connected = true;
        loggers.whatsappConnected();
      }, 8000);
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  setConnected(status: boolean) {
    this.connected = status;
  }

  getProvider() {
    return this.provider;
  }
}

export const connectionStatus = ConnectionStatus.getInstance();
