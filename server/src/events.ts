import type { WebSocket } from 'ws';
import { listSessions, PREFIX } from './tmux.js';
import { getMeta } from './store.js';
import type { SessionDTO } from './types.js';

const clients = new Set<WebSocket>();
let timer: NodeJS.Timeout | null = null;
let lastPayload = '';

export async function buildSessionList(): Promise<SessionDTO[]> {
  const sessions = await listSessions();
  return sessions
    .map((s): SessionDTO => {
      const meta = getMeta(s.name);
      return {
        id: s.name,
        title: meta?.title || s.name.slice(PREFIX.length),
        cli: meta?.cli || 'shell',
        cliLabel: meta?.cliLabel || 'Shell',
        created: meta?.created || s.created,
        lastActivity: Math.max(s.lastActivity, meta?.created || s.created),
        attached: s.attached,
        state: s.state,
      };
    })
    // Most recently touched conversation first, like a chat history.
    .sort((a, b) => b.lastActivity - a.lastActivity || b.created - a.created);
}

async function tick(): Promise<void> {
  if (clients.size === 0) return;
  const list = await buildSessionList();
  const payload = JSON.stringify({ type: 'sessions', sessions: list });
  if (payload === lastPayload) return; // nothing changed, stay quiet
  lastPayload = payload;
  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) ws.send(payload);
  }
}

function ensureTimer(): void {
  if (timer) return;
  timer = setInterval(() => void tick(), 1500);
}

export async function addEventClient(ws: WebSocket): Promise<void> {
  clients.add(ws);
  ensureTimer();
  // Send an immediate snapshot so the UI paints instantly.
  const list = await buildSessionList();
  ws.send(JSON.stringify({ type: 'sessions', sessions: list }));
  ws.on('close', () => clients.delete(ws));
  ws.on('error', () => clients.delete(ws));
}

// Force an immediate broadcast (e.g. right after create/delete) for snappy UX.
export async function pokeEvents(): Promise<void> {
  lastPayload = ''; // invalidate cache so the change is guaranteed to go out
  await tick();
}
