/* eslint-disable global-require */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-use-before-define */
import { Subject } from 'rxjs';
import { ModelInfo } from '@/context/live2d-config-context';
import { HistoryInfo } from '@/context/websocket-context';
import { ConfigFile } from '@/context/character-config-context';
import { toaster } from '@/components/ui/toaster';
import { logAction, setClientUid } from '@/services/clientLogger';

export interface DisplayText {
  text: string;
  name: string;
  avatar: string;
}

interface BackgroundFile {
  name: string;
  url: string;
}

export interface Message {
  id: string;
  content: string;
  role: "ai" | "human";
  timestamp: string;
  name?: string;
  avatar?: string;
  source?: 'local' | 'twitch';

  // Fields for different message types (make optional)
  type?: 'text' | 'tool_call_status'; // Add possible types, default to 'text' if omitted
  tool_id?: string; // Specific to tool calls
  tool_name?: string; // Specific to tool calls
  status?: 'running' | 'completed' | 'error'; // Specific to tool calls
}

export interface Actions {
  expressions?: string[] | number [];
  pictures?: string[];
  sounds?: string[];
}

export interface MessageEvent {
  tool_id: any;
  tool_name: any;
  name: any;
  status: any;
  content: string;
  timestamp: string;
  type: string;
  audio?: string;
  volumes?: number[];
  slice_length?: number;
  files?: BackgroundFile[];
  actions?: Actions;
  text?: string;
  model_info?: ModelInfo;
  conf_name?: string;
  conf_uid?: string;
  uids?: string[];
  messages?: Message[];
  history_uid?: string;
  success?: boolean;
  histories?: HistoryInfo[];
  configs?: ConfigFile[];
  message?: string;
  members?: string[];
  is_owner?: boolean;
  client_uid?: string;
  forwarded?: boolean;
  display_text?: DisplayText;
  live2d_model?: string;
  browser_view?: {
    debuggerFullscreenUrl: string;
    debuggerUrl: string;
    pages: {
      id: string;
      url: string;
      faviconUrl: string;
      title: string;
      debuggerUrl: string;
      debuggerFullscreenUrl: string;
    }[];
    wsUrl: string;
    sessionId?: string;
  };
  // Twitch-specific event fields
  user?: string;
  enabled?: boolean;
  connected?: boolean;
  channel?: string;
}

// Get translation function for error messages
const getTranslation = () => {
  try {
    const i18next = require('i18next').default;
    return i18next.t.bind(i18next);
  } catch (e) {
    // Fallback if i18next is not available
    return (key: string) => key;
  }
};

class WebSocketService {
  private static instance: WebSocketService;

  private ws: WebSocket | null = null;

  private messageSubject = new Subject<MessageEvent>();

  private stateSubject = new Subject<'CONNECTING' | 'OPEN' | 'CLOSING' | 'CLOSED'>();

  private currentState: 'CONNECTING' | 'OPEN' | 'CLOSING' | 'CLOSED' = 'CLOSED';

  // Queue for messages sent before socket becomes OPEN
  private outbox: object[] = [];

  // Throttle user notification when buffering messages
  private lastBufferNoticeAt = 0;

  static getInstance() {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  private initializeConnection() {
    this.sendMessage({
      type: 'fetch-backgrounds',
    });
    this.sendMessage({
      type: 'fetch-configs',
    });
    this.sendMessage({
      type: 'fetch-history-list',
    });
    this.sendMessage({
      type: 'create-new-history',
    });
  }

  private async readFrontendSettings(): Promise<{ wsLog: boolean; errorLogging: boolean }> {
    try {
      const res = await fetch('/app-settings.json', { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      const wsLog = Boolean(data?.frontend?.wsLog);
      const errorLogging = Boolean(data?.frontend?.errorLogging);
      return { wsLog, errorLogging };
    } catch (_) {
      return { wsLog: false, errorLogging: false };
    }
  }

  connect(url: string) {
    if (this.ws?.readyState === WebSocket.CONNECTING ||
        this.ws?.readyState === WebSocket.OPEN) {
      this.disconnect();
    }

    try {
      this.ws = new WebSocket(url);
      this.currentState = 'CONNECTING';
      this.stateSubject.next('CONNECTING');
      logAction('ws.status', 'connecting');

      this.ws.onopen = () => {
        this.currentState = 'OPEN';
        this.stateSubject.next('OPEN');
        logAction('ws.status', 'connected');
        this.initializeConnection();
        // apply frontend logging settings
        this.readFrontendSettings().then(({ wsLog, errorLogging }) => {
          try {
            if (localStorage.getItem('appLogWs') === null) {
              localStorage.setItem('appLogWs', wsLog ? 'true' : 'false');
            }
            if (localStorage.getItem('appEnableFrontendErrorLogging') === null) {
              localStorage.setItem('appEnableFrontendErrorLogging', errorLogging ? 'true' : 'false');
            }
          } catch (_) {}
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message && typeof message === 'object' && 'client_uid' in message && message.client_uid) {
            try { setClientUid(String(message.client_uid)); } catch (_) {}
          }
          try {
            if (localStorage.getItem('appLogWs') === 'true') {
              console.log('WS IN:', message);
              this.logClient('info', { type: 'ws-in', payload: message });
            }
          } catch (_) {}
          this.messageSubject.next(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
          toaster.create({
            title: `${getTranslation()('error.failedParseWebSocket')}: ${error}`,
            type: "error",
            duration: 2000,
          });
        }
      };

      this.ws.onclose = () => {
        this.currentState = 'CLOSED';
        this.stateSubject.next('CLOSED');
        logAction('ws.status', 'disconnected');
      };

      this.ws.onerror = () => {
        this.currentState = 'CLOSED';
        this.stateSubject.next('CLOSED');
        logAction('ws.status', 'error');
      };

      // Install global error listeners (gated by localStorage flag)
      this.installGlobalErrorLogging();
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      this.currentState = 'CLOSED';
      this.stateSubject.next('CLOSED');
    }
  }

  sendMessage(message: object) {
    try {
      if (localStorage.getItem('appLogWs') === 'true') {
        console.log('WS OUT:', message);
        this.logClient('info', { type: 'ws-out', payload: message });
      }
    } catch (_) {}

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return;
    }

    // Match original: if socket not open — notify, do not auto-connect here
    console.warn('WebSocket is not open. Unable to send message:', message);
    try {
      toaster.create({
        title: getTranslation()('wsStatus.connecting'),
        type: 'info',
        duration: 1500,
      });
    } catch (_) {}
  }

  // Frontend log sender
  logClient(kind: 'error' | 'warn' | 'info', payload: any) {
    try {
      this.sendMessage({ type: 'frontend-log', level: kind, ...payload });
    } catch (_) {
      // ignore
    }
  }

  private installGlobalErrorLogging() {
    const enabled = localStorage.getItem('appEnableFrontendErrorLogging') === 'true';
    if (!enabled) return;

    if ((window as any).__frontendErrorLoggingInstalled) return;
    (window as any).__frontendErrorLoggingInstalled = true;

    window.addEventListener('error', (event) => {
      try {
        this.logClient('error', {
          type: 'window-error',
          message: event.message || '',
          filename: (event as any).filename || '',
          lineno: (event as any).lineno || 0,
          colno: (event as any).colno || 0,
          stack: event.error?.stack || '',
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        });
      } catch (_) {}
    });

    window.addEventListener('unhandledrejection', (event) => {
      try {
        const reason: any = (event as any).reason;
        this.logClient('error', {
          type: 'unhandled-rejection',
          message: reason?.message || String(reason),
          stack: reason?.stack || '',
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
        });
      } catch (_) {}
    });
  }

  onMessage(callback: (message: MessageEvent) => void) {
    return this.messageSubject.subscribe(callback);
  }

  onStateChange(callback: (state: 'CONNECTING' | 'OPEN' | 'CLOSING' | 'CLOSED') => void) {
    return this.stateSubject.subscribe(callback);
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }

  getCurrentState() {
    return this.currentState;
  }
}

export const wsService = WebSocketService.getInstance();
