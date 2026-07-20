import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer, type WebSocket } from 'ws';
import pty from 'node-pty';
import {
  PREFIX,
  createSession,
  killSession,
  hasSession,
  sendInput,
  captureScrollback,
  tmuxArgs,
} from './tmux.js';
import { getMeta, setMeta, deleteMeta } from './store.js';
import { authEnabled, checkPassword, issueToken, verifyToken } from './auth.js';
import { CliUnavailableError, ensureCliAvailable, getClis } from './clis.js';
import { addEventClient, buildSessionList, pokeEvents } from './events.js';
import type { ApiErrorBody } from './types.js';

// Keep the server alive even if a PTY/WebSocket edge case throws — the tmux
// sessions live on regardless, and dropping the whole web server is worse.
process.on('uncaughtException', (err) => console.error('uncaughtException:', err));
process.on('unhandledRejection', (err) => console.error('unhandledRejection:', err));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

const app = express();
app.use(express.json());

const requireAuth: express.RequestHandler = (req, res, next) => {
  const token = req.headers.authorization?.replace(/^Bearer /, '');
  if (!verifyToken(token)) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  next();
};

app.get('/api/config', (_req, res) => {
  res.json({ authRequired: authEnabled() });
});

app.post('/api/login', (req, res) => {
  if (!checkPassword(req.body?.password)) {
    res.status(401).json({ error: 'invalid password' });
    return;
  }
  res.json({ token: issueToken() });
});

app.get('/api/clis', requireAuth, (_req, res) => {
  res.json(getClis());
});

// Expand ~ and resolve a working-directory path supplied by the client.
function resolveDir(input: unknown): string {
  const home = os.homedir();
  let value = String(input ?? '').trim();
  if (!value || value === '~') return home;
  if (value.startsWith('~/')) value = path.join(home, value.slice(2));
  return path.resolve(value);
}

app.get('/api/browse', requireAuth, async (req, res) => {
  const dir = resolveDir(req.query.path);
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    const dirs = entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));
    res.json({ path: dir, parent: path.dirname(dir), home: os.homedir(), dirs });
  } catch {
    res.status(404).json({ error: `Folder not found: ${dir}` });
  }
});

app.get('/api/sessions', requireAuth, async (_req, res) => {
  res.json(await buildSessionList());
});

app.post('/api/sessions', requireAuth, async (req, res) => {
  const { cli, title, cwd, input } = req.body || {};
  const def = getClis().find((candidate) => candidate.id === cli);
  if (!def) {
    res.status(400).json({ code: 'unknown_cli', error: 'Unknown CLI.' } satisfies ApiErrorBody);
    return;
  }
  const dir = resolveDir(cwd);
  const stat = await fs.promises.stat(dir).catch(() => null);
  if (!stat?.isDirectory()) {
    res.status(400).json({ code: 'invalid_cwd', error: `Folder not found: ${dir}` } satisfies ApiErrorBody);
    return;
  }
  const id = `${PREFIX}${crypto.randomBytes(4).toString('hex')}`;
  try {
    await ensureCliAvailable(def);
    await createSession(id, def.command, dir);
  } catch (err) {
    if (err instanceof CliUnavailableError) {
      res.status(422).json({
        code: err.code,
        error: err.message,
        command: err.command,
      } satisfies ApiErrorBody);
      return;
    }
    res.status(500).json({
      code: 'session_create_failed',
      error: String((err as Error).message || err),
    } satisfies ApiErrorBody);
    return;
  }
  setMeta(id, {
    title: (title || def.label).slice(0, 100),
    cli: def.id,
    cliLabel: def.label,
    created: Date.now(),
  });
  if (input) {
    // Give the shell + agent CLI a moment to boot before sending the first prompt.
    const delay = def.command ? 2000 : 250;
    setTimeout(() => void sendInput(id, String(input)).catch(() => {}), delay);
  }
  void pokeEvents();
  res.json({ id });
});

app.post('/api/sessions/:id/input', requireAuth, async (req, res) => {
  const id = req.params.id;
  if (!id.startsWith(PREFIX) || !(await hasSession(id))) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  try {
    await sendInput(id, String(req.body?.text ?? ''));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String((err as Error).message || err) });
  }
});

app.patch('/api/sessions/:id', requireAuth, async (req, res) => {
  const meta = getMeta(req.params.id);
  if (!meta) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  if (req.body?.title) meta.title = String(req.body.title).slice(0, 100);
  setMeta(req.params.id, meta);
  void pokeEvents();
  res.json({ ok: true });
});

app.delete('/api/sessions/:id', requireAuth, async (req, res) => {
  const id = req.params.id;
  if (!id.startsWith(PREFIX)) {
    res.status(400).json({ error: 'bad id' });
    return;
  }
  try {
    if (await hasSession(id)) await killSession(id);
    deleteMeta(id);
    void pokeEvents();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String((err as Error).message || err) });
  }
});

const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));

const server = http.createServer(app);
const termWss = new WebSocketServer({ noServer: true });
const eventWss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url || '', 'http://localhost');
  const token = url.searchParams.get('token');
  if (!verifyToken(token)) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }
  if (url.pathname === '/ws/events') {
    eventWss.handleUpgrade(req, socket, head, (ws) => void addEventClient(ws));
    return;
  }
  const match = url.pathname.match(/^\/ws\/(deck_[a-z0-9]+)$/);
  if (match) {
    termWss.handleUpgrade(req, socket, head, (ws) => void attachTerminal(ws, match[1]));
    return;
  }
  socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
  socket.destroy();
});

async function attachTerminal(ws: WebSocket, sessionId: string): Promise<void> {
  if (!(await hasSession(sessionId))) {
    ws.close(4004, 'session not found');
    return;
  }

  // Restore scrollback history first so the user sees context immediately.
  const history = await captureScrollback(sessionId);
  if (history && ws.readyState === ws.OPEN) {
    ws.send(history);
    ws.send('\r\n\x1b[90m──────── live ────────\x1b[0m\r\n');
  }

  let term: pty.IPty;
  try {
    term = pty.spawn('tmux', tmuxArgs('attach-session', '-t', sessionId), {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      env: { ...process.env, TERM: 'xterm-256color' },
    });
  } catch (err) {
    console.error('pty spawn failed:', err);
    if (ws.readyState === ws.OPEN) {
      ws.send('\r\n\x1b[31m[failed to attach the terminal]\x1b[0m\r\n');
      ws.close(1011, 'pty spawn failed');
    }
    return;
  }

  term.onData((data) => {
    if (ws.readyState === ws.OPEN) ws.send(data);
  });
  term.onExit(() => {
    if (ws.readyState === ws.OPEN) ws.close(1000);
  });

  ws.on('message', (msg) => {
    const str = msg.toString();
    if (str.startsWith('\x00resize:')) {
      const [cols, rows] = str.slice(8).split('x').map(Number);
      if (cols > 0 && rows > 0) term.resize(cols, rows);
      return;
    }
    term.write(str);
  });
  ws.on('close', () => term.kill());
}

server.listen(PORT, HOST, () => {
  console.log(`agent-deck listening on http://${HOST}:${PORT}`);
  if (!authEnabled()) {
    console.warn('WARNING: AGENT_DECK_PASSWORD is not set — authentication is DISABLED.');
  }
  if (authEnabled() && !process.env.AGENT_DECK_SECRET) {
    console.warn('NOTE: AGENT_DECK_SECRET not set — you will need to log in again after each restart.');
  }
});
