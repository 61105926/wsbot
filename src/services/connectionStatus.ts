// Service para trackear el estado de conexión del bot
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

    // Dar tiempo para que WhatsApp se conecte
    setTimeout(() => {
      this.connected = true;
      console.log('✅ WhatsApp Connection Status - READY to send messages');
    }, 8000); // 8 segundos para asegurar que WhatsApp esté conectado
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
