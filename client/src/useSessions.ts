import { useEffect, useRef, useState } from 'react';
import { wsProtocols } from './api';
import type { Session } from './types';

// Subscribes to the server's real-time events WebSocket. The server pushes the
// full session list whenever anything changes (status, create, delete, rename),
// so the sidebar stays in sync instantly without polling.
export function useSessions(enabled: boolean, onUnauthorized: () => void) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const onUnauthRef = useRef(onUnauthorized);
  onUnauthRef.current = onUnauthorized;

  useEffect(() => {
    if (!enabled) return;
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const connect = () => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${proto}://${location.host}/ws/events`, wsProtocols());
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data as string);
          if (msg.type === 'sessions') setSessions(msg.sessions as Session[]);
        } catch {
          /* ignore */
        }
      };
      ws.onclose = (e) => {
        if (closed) return;
        if (e.code === 1008 || e.code === 4001) {
          onUnauthRef.current();
          return;
        }
        retry = setTimeout(connect, 1500);
      };
    };
    connect();

    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      ws?.close();
    };
  }, [enabled]);

  return sessions;
}
