import { EventEmitter } from 'events';

export interface WebSocketConfig {
  url: string;
  protocols?: string | string[];
  reconnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  pingInterval?: number;
  pongTimeout?: number;
}

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: number;
}

export class WebSocketHandler extends EventEmitter {
  private config: Required<WebSocketConfig>;
  private ws: WebSocket | null = null;
  private reconnectAttempts: number = 0;
  private pingTimer: NodeJS.Timeout | null = null;
  private pongTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(config: WebSocketConfig) {
    super();
    this.config = {
      url: config.url,
      protocols: config.protocols || [],
      reconnect: config.reconnect ?? true,
      reconnectInterval: config.reconnectInterval ?? 5000,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 5,
      pingInterval: config.pingInterval ?? 30000,
      pongTimeout: config.pongTimeout ?? 5000
    };
  }

  async connect(): Promise<void> {
    if (this.ws) {
      this.close();
    }

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.url, this.config.protocols);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          this.startPing();
          this.emit('open');
          resolve();
        };

        this.ws.onclose = () => {
          this.handleClose();
        };

        this.ws.onerror = (error) => {
          this.emit('error', error);
          reject(error);
        };

        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'pong') {
              this.handlePong();
            } else {
              this.emit('message', {
                ...message,
                timestamp: Date.now()
              });
            }
          } catch (error) {
            this.emit('error', new Error('Invalid message format'));
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  send(message: Omit<WebSocketMessage, 'timestamp'>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected');
    }

    const fullMessage: WebSocketMessage = {
      ...message,
      timestamp: Date.now()
    };

    this.ws.send(JSON.stringify(fullMessage));
  }

  async close(): Promise<void> {
    this.stopPing();
    this.stopReconnect();

    if (this.ws) {
      return new Promise((resolve) => {
        if (this.ws) {
          this.ws.onclose = () => {
            this.ws = null;
            this.emit('close');
            resolve();
          };
          this.ws.close();
        } else {
          resolve();
        }
      });
    }
  }

  private handleClose(): void {
    this.stopPing();
    this.emit('close');

    if (this.config.reconnect && this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.reconnectTimer = setTimeout(() => {
        this.reconnectAttempts++;
        this.connect().catch(() => {
          // Yeniden bağlanma hatası zaten 'error' eventi ile bildirildi
        });
      }, this.config.reconnectInterval);
    }
  }

  private startPing(): void {
    if (this.pingTimer) {
      this.stopPing();
    }

    this.pingTimer = setInterval(() => {
      const pingMessage: WebSocketMessage = {
        type: 'ping',
        data: null,
        timestamp: Date.now()
      };
      this.send(pingMessage);

      this.pongTimer = setTimeout(() => {
        this.emit('pong_timeout');
        this.close();
      }, this.config.pongTimeout);
    }, this.config.pingInterval);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  private handlePong(): void {
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  private stopReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  getState(): {
    connected: boolean;
    reconnectAttempts: number;
    config: Required<WebSocketConfig>;
  } {
    return {
      connected: this.isConnected(),
      reconnectAttempts: this.reconnectAttempts,
      config: { ...this.config }
    };
  }
} 