import { EventEmitter } from 'events';

export interface SSEConfig {
  url: string;
  withCredentials?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  lastEventId?: string;
  headers?: Record<string, string>;
}

export interface SSEMessage {
  id?: string;
  type: string;
  data: any;
  retry?: number;
  timestamp: number;
}

type ConnectionState = 'CONNECTING' | 'OPEN' | 'CLOSED';

export class SSEHandler extends EventEmitter {
  private eventSource: EventSource | null = null;
  private config: Required<SSEConfig>;
  private reconnectAttempts: number = 0;
  private messageHistory: SSEMessage[] = [];
  private historySize: number = 100;

  constructor(config: SSEConfig) {
    super();
    this.config = {
      url: config.url,
      withCredentials: config.withCredentials ?? false,
      reconnectInterval: config.reconnectInterval ?? 5000,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 5,
      lastEventId: config.lastEventId ?? '',
      headers: config.headers ?? {}
    };
  }

  async connect(): Promise<void> {
    if (this.eventSource?.readyState === EventSource.OPEN) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const url = new URL(this.config.url);
        // URL'e last-event-id ekle
        if (this.config.lastEventId) {
          url.searchParams.set('lastEventId', this.config.lastEventId);
        }

        this.eventSource = new EventSource(url.toString(), {
          withCredentials: this.config.withCredentials
        });

        this.setupEventListeners(resolve, reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  private setupEventListeners(resolve: () => void, reject: (error: any) => void): void {
    if (!this.eventSource) return;

    this.eventSource.onopen = () => {
      this.reconnectAttempts = 0;
      this.emit('connected');
      resolve();
    };

    this.eventSource.onerror = (error) => {
      if (this.eventSource?.readyState === EventSource.CLOSED) {
        this.handleDisconnect(error);
        reject(error);
      } else {
        this.emit('error', error);
      }
    };

    // Varsayılan mesaj dinleyicisi
    this.eventSource.onmessage = (event) => {
      const message = this.parseMessage('message', event);
      this.handleMessage(message);
    };

    // Özel event dinleyicileri
    ['error', 'retry', 'update', 'delete'].forEach(eventType => {
      this.eventSource?.addEventListener(eventType, (event: MessageEvent) => {
        const message = this.parseMessage(eventType, event);
        this.handleMessage(message);
      });
    });
  }

  private parseMessage(type: string, event: MessageEvent): SSEMessage {
    let data = event.data;
    try {
      data = JSON.parse(event.data);
    } catch {
      // Veri JSON değilse string olarak bırak
    }

    const message: SSEMessage = {
      type,
      data,
      timestamp: Date.now()
    };

    if (event.lastEventId) {
      message.id = event.lastEventId;
      this.config.lastEventId = event.lastEventId;
    }

    if (event.type === 'retry') {
      message.retry = parseInt(data, 10);
    }

    return message;
  }

  private handleMessage(message: SSEMessage): void {
    this.addToHistory(message);
    this.emit('message', message);
    this.emit(message.type, message);
  }

  private handleDisconnect(error: any): void {
    this.emit('disconnected', error);

    if (this.shouldReconnect()) {
      this.reconnectAttempts++;
      this.emit('reconnecting', this.reconnectAttempts);

      setTimeout(() => {
        this.connect().catch(error => {
          this.emit('error', error);
        });
      }, this.config.reconnectInterval);
    } else {
      this.emit('reconnect_failed');
    }
  }

  private shouldReconnect(): boolean {
    return this.reconnectAttempts < this.config.maxReconnectAttempts;
  }

  private addToHistory(message: SSEMessage): void {
    this.messageHistory.push(message);
    if (this.messageHistory.length > this.historySize) {
      this.messageHistory.shift();
    }
  }

  close(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
      this.emit('closed');
    }
  }

  isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }

  getState(): ConnectionState {
    if (!this.eventSource) return 'CLOSED';

    switch (this.eventSource.readyState) {
      case EventSource.CONNECTING:
        return 'CONNECTING';
      case EventSource.OPEN:
        return 'OPEN';
      default:
        return 'CLOSED';
    }
  }

  getStats(): {
    state: ConnectionState;
    reconnectAttempts: number;
    messageCount: number;
    lastEventId: string;
    isConnected: boolean;
  } {
    return {
      state: this.getState(),
      reconnectAttempts: this.reconnectAttempts,
      messageCount: this.messageHistory.length,
      lastEventId: this.config.lastEventId,
      isConnected: this.isConnected()
    };
  }

  getMessageHistory(): SSEMessage[] {
    return [...this.messageHistory];
  }
} 