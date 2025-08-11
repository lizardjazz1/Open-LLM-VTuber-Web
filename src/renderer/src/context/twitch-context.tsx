import { createContext, useContext, useMemo, useState, useCallback } from 'react';

export interface TwitchStatus {
  enabled?: boolean;
  connected?: boolean;
  channel?: string;
}

export interface TwitchMessageItem {
  user: string;
  text: string;
  timestamp?: string;
}

interface TwitchState {
  status: TwitchStatus;
  messages: TwitchMessageItem[];
  setStatus: (s: TwitchStatus) => void;
  pushMessage: (m: TwitchMessageItem) => void;
  clear: () => void;
}

const TwitchContext = createContext<TwitchState | null>(null);

export function TwitchProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatusState] = useState<TwitchStatus>({});
  const [messages, setMessages] = useState<TwitchMessageItem[]>([]);

  const setStatus = useCallback((s: TwitchStatus) => setStatusState(s), []);
  const pushMessage = useCallback((m: TwitchMessageItem) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.user === m.user && last.text === m.text && (last.timestamp || '') === (m.timestamp || '')) {
        return prev; // dedupe identical consecutive message
      }
      const next = [...prev, m];
      return next.slice(-100);
    });
  }, []);
  const clear = useCallback(() => setMessages([]), []);

  const value = useMemo(() => ({ status, messages, setStatus, pushMessage, clear }), [status, messages, setStatus, pushMessage, clear]);

  return <TwitchContext.Provider value={value}>{children}</TwitchContext.Provider>;
}

export function useTwitch() {
  const ctx = useContext(TwitchContext);
  if (!ctx) throw new Error('useTwitch must be used within TwitchProvider');
  return ctx;
} 