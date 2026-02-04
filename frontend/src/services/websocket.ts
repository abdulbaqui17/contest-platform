import { ContestSummary, WebSocketEvent } from '../types';

export class ContestWebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(
    private contestId: string,
    private onMessage: (event: WebSocketEvent) => void,
    private onError: (error: Event) => void,
    private onClose: (event: CloseEvent) => void
  ) {}

  connect(): void {
    const token = localStorage.getItem('admin_token');
    if (!token) {
      console.error('No admin token found');
      return;
    }

    // Use environment variable for WebSocket URL (configured at build time)
    const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';
    const wsUrl = `${WS_BASE_URL}/ws/contest?token=${token}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
      
      // Send join_contest event
      this.send({
        event: 'join_contest',
        data: {
          contestId: this.contestId
        }
      });
    };

    this.ws.onmessage = (event) => {
      try {
        const data: WebSocketEvent = JSON.parse(event.data);
        this.onMessage(data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.onError(error);
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      this.onClose(event);
      this.attemptReconnect();
    };
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'Admin disconnecting');
      this.ws = null;
    }
  }

  send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      setTimeout(() => {
        this.connect();
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('Max reconnect attempts reached');
    }
  }
}

export type PublicWebSocketEvent =
  | {
      event: 'contests_update';
      data: { contests: ContestSummary[] };
      timestamp: string;
    }
  | {
      event: 'leaderboard_update';
      data: { contestId: string; topN: any[]; totalParticipants: number };
      timestamp: string;
    };

export class PublicWebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(
    private onMessage: (event: PublicWebSocketEvent) => void,
    private onError: (error: Event) => void,
    private onClose: (event: CloseEvent) => void
  ) {}

  connect(autoSubscribeContests: boolean = true): void {
    const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';
    const wsUrl = `${WS_BASE_URL}/ws/public`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      if (autoSubscribeContests) {
        this.subscribeContests();
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const data: PublicWebSocketEvent = JSON.parse(event.data);
        this.onMessage(data);
      } catch (error) {
        console.error('Failed to parse public WebSocket message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('Public WebSocket error:', error);
      this.onError(error);
    };

    this.ws.onclose = (event) => {
      this.onClose(event);
      this.attemptReconnect(autoSubscribeContests);
    };
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'Disconnect');
      this.ws = null;
    }
  }

  subscribeContests(): void {
    this.send({ event: 'subscribe_contests' });
  }

  subscribeLeaderboard(contestId: string): void {
    this.send({ event: 'subscribe_leaderboard', data: { contestId } });
  }

  unsubscribeLeaderboard(contestId: string): void {
    this.send({ event: 'unsubscribe_leaderboard', data: { contestId } });
  }

  private send(message: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  private attemptReconnect(autoSubscribeContests: boolean) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        this.connect(autoSubscribeContests);
      }, this.reconnectDelay * this.reconnectAttempts);
    }
  }
}
