import http from 'node:http';
import type { Socket } from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import compression from 'compression';
import express from 'express';
import { WebSocketServer, type WebSocket } from 'ws';
import pty from 'node-pty';
import {
  PREFIX,
  createSession,
  exactSession,
  killSession,
  hasSession,
  sendInput,
  sendInputWhenReady,
  captureScrollback,
  tmuxArgs,
} from './tmux.js';
import { sessionStateTracker } from './session-state.js';
import { getMeta, setMeta, deleteMeta } from './store.js';
import { authEnabled, checkPassword, issueToken, verifyToken } from './auth.js';
import { LoginRateLimiter, isLoopbackHost, tokenFromProtocols, upgradeOriginAllowed } from './security.js';
import { CliUnavailableError, ensureCliAvailable, getClis } from './clis.js';
import { addEventClient, buildSessionList, pokeEvents } from './events.js';
import type { ApiErrorBody } from './types.js';

// Keep the server alive even if a PTY/WebSocket edge case throws — the tmux
// sessions live on regardless, and dropping the whole web server is worse.
process.on('uncaughtException', (err) => console.error('uncaughtException:', err));
process.on('unhandledRejection', (err) => console.error('unhandledRejection:', err));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
// Without a password this server is a passwordless remote shell, so it
// defaults to loopback and refuses to bind anything wider unless the operator
// explicitly opts in with AGENT_DECK_INSECURE=1.
const HOST = process.env.HOST || (authEnabled() ? '0.0.0.0' : '127.0.0.1');
if (!authEnabled() && !isLoopbackHost(HOST) && process.env.AGENT_DECK_INSECURE !== '1') {
  console.error(
    `Refusing to listen on ${HOST} without AGENT_DECK_PASSWORD: anyone who can reach this port gets a shell.\n` +
    'Set AGENT_DECK_PASSWORD, or set AGENT_DECK_INSECURE=1 to override.',
  );
  process.exit(1);
}
// Extra origins (hostnames) allowed to open WebSockets, for reverse proxies
// that neither preserve Host nor set X-Forwarded-Host.
const ALLOWED_ORIGINS = (process.env.AGENT_DECK_ALLOWED_ORIGINS || '')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);

const app = express();
app.disable('x-powered-by');
// The main JS bundle is ~1 MB; gzip cuts it to ~275 kB, which matters a lot
// on slow links (mobile networks, throttled VPN paths).
app.use(compression());
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

const loginLimiter = new LoginRateLimiter();

app.post('/api/login', (req, res) => {
  const key = req.ip || 'unknown';
  if (loginLimiter.blocked(key)) {
    res.status(429).json({ error: 'Too many attempts. Try again later.' });
    return;
  }
  if (!checkPassword(req.body?.password)) {
    loginLimiter.recordFailure(key);
    res.status(401).json({ error: 'invalid password' });
    return;
  }
  loginLimiter.reset(key);
  res.json({ token: issueToken() });
});

app.get('/api/clis', requireAuth, (_req, res) => {
  res.json(getClis());
});

// Optional confinement: when set, browsing and session working directories
// may not escape this root.
const ROOT = process.env.AGENT_DECK_ROOT ? path.resolve(process.env.AGENT_DECK_ROOT) : null;

// Expand ~ and resolve a working-directory path supplied by the client.
// Returns null when the path escapes AGENT_DECK_ROOT.
function resolveDir(input: unknown): string | null {
  const home = os.homedir();
  const raw = String(input ?? '').trim();
  let value = raw;
  if (!value || value === '~') value = home;
  else if (value.startsWith('~/')) value = path.join(home, value.slice(2));
  const resolved = path.resolve(value);
  if (!ROOT) return resolved;
  if (resolved === ROOT || resolved.startsWith(ROOT + path.sep)) return resolved;
  // The default landing spot must stay usable when home is outside the root.
  return !raw || raw === '~' ? ROOT : null;
}

app.get('/api/browse', requireAuth, async (req, res) => {
  const dir = resolveDir(req.query.path);
  if (!dir) {
    res.status(403).json({ error: 'Path is outside the allowed root.' });
    return;
  }
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    const dirs = entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));
    const parent = ROOT && dir === ROOT ? dir : path.dirname(dir);
    res.json({ path: dir, parent, home: ROOT ?? os.homedir(), dirs });
  } catch {
    res.status(404).json({ error: `Folder not found: ${dir}` });
  }
});

app.post('/api/mkdir', requireAuth, async (req, res) => {
  const parent = resolveDir(req.body?.path);
  if (!parent) {
    res.status(403).json({ error: 'Path is outside the allowed root.' });
    return;
  }
  const name = String(req.body?.name ?? '').trim();
  if (!name || name.includes('/') || name.includes('\\') || name === '.' || name === '..') {
    res.status(400).json({ error: 'Invalid folder name.' });
    return;
  }
  const target = path.join(parent, name);
  try {
    await fs.promises.mkdir(target);
    res.json({ path: target });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    res.status(400).json({
      error: code === 'EEXIST' ? 'A folder with this name already exists.' : `Could not create folder: ${code || 'unknown error'}`,
    });
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
  const stat = dir ? await fs.promises.stat(dir).catch(() => null) : null;
  if (!dir || !stat?.isDirectory()) {
    res.status(400).json({ code: 'invalid_cwd', error: `Folder not found: ${dir ?? String(cwd)}` } satisfies ApiErrorBody);
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
    if (def.command) {
      // Wait until the CLI actually took over the pane; a fixed delay would
      // let a slow-starting CLI hand the prompt text to the shell instead.
      void sendInputWhenReady(id, String(input)).catch(() => {});
    } else {
      // Plain shell: the input is a shell command, give the shell a beat to boot.
      setTimeout(() => void sendInput(id, String(input)).catch(() => {}), 250);
    }
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

// Unknown API paths must not fall through to the SPA's index.html.
app.all('/api/*', (_req, res) => res.status(404).json({ error: 'not found' }));

const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
// Vite content-hashes everything under /assets, so browsers may cache those
// forever: after the first visit, reloads no longer re-download the bundle.
app.use('/assets', express.static(path.join(clientDist, 'assets'), { maxAge: '1y', immutable: true }));
app.use(express.static(clientDist));
app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));

const server = http.createServer(app);
// The client offers ["agent-deck", "deck.<token>"]; echo the first one back
// (browsers abort the handshake when no offered subprotocol is selected).
const selectProtocol = (protocols: Set<string>) => (protocols.has('agent-deck') ? 'agent-deck' : false);
const termWss = new WebSocketServer({ noServer: true, handleProtocols: selectProtocol });
const eventWss = new WebSocketServer({ noServer: true, handleProtocols: selectProtocol });

server.on('upgrade', (req, socket, head) => {
  // Nagle's algorithm batches small writes together, which is exactly wrong
  // for a terminal: it delays every single keystroke echo. Disabling it lets
  // node-pty's output reach the browser as soon as it's written.
  (socket as Socket).setNoDelay(true);
  const url = new URL(req.url || '', 'http://localhost');
  const originOk = upgradeOriginAllowed({
    origin: req.headers.origin,
    host: req.headers.host,
    forwardedHost: String(req.headers['x-forwarded-host'] ?? '') || undefined,
    authEnabled: authEnabled(),
    allowlist: ALLOWED_ORIGINS,
  });
  if (!originOk) {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    socket.destroy();
    return;
  }
  // Token travels in the subprotocol list to stay out of proxy access logs;
  // the query parameter remains supported for scripts.
  const token = tokenFromProtocols(req.headers['sec-websocket-protocol']) ?? url.searchParams.get('token');
  if (!verifyToken(token)) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }
  if (url.pathname === '/ws/events') {
    eventWss.handleUpgrade(req, socket, head, (ws) => {
      trackLiveness(ws);
      void addEventClient(ws);
    });
    return;
  }
  const match = url.pathname.match(/^\/ws\/(deck_[a-z0-9]+)$/);
  if (match) {
    termWss.handleUpgrade(req, socket, head, (ws) => {
      trackLiveness(ws);
      void attachTerminal(ws, match[1]);
    });
    return;
  }
  socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
  socket.destroy();
});

// Protocol-level pings keep idle sockets alive through reverse proxies
// (tailscale serve, Caddy) and reap connections whose peer silently vanished
// (mobile browsers killed by the OS).
const alive = new WeakSet<WebSocket>();
function trackLiveness(ws: WebSocket): void {
  alive.add(ws);
  ws.on('pong', () => alive.add(ws));
}
setInterval(() => {
  for (const wss of [termWss, eventWss]) {
    for (const ws of wss.clients) {
      if (!alive.has(ws)) {
        ws.terminate();
        continue;
      }
      alive.delete(ws);
      ws.ping();
    }
  }
}, 30_000);

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
    term = pty.spawn('tmux', tmuxArgs('attach-session', '-t', exactSession(sessionId)), {
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
    sessionStateTracker.recordInput(sessionId);
    term.write(str);
  });
  ws.on('close', () => term.kill());
}

// A server that cannot bind (EADDRINUSE…) is useless: exit so the supervisor
// can restart or report it, instead of the uncaughtException guard keeping a
// dead process alive.
server.on('error', (err) => {
  console.error('server error:', err);
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log(`agent-deck listening on http://${HOST}:${PORT}`);
  if (!authEnabled()) {
    console.warn('WARNING: AGENT_DECK_PASSWORD is not set — authentication is DISABLED.');
  }
  if (authEnabled() && !process.env.AGENT_DECK_SECRET) {
    console.warn('NOTE: AGENT_DECK_SECRET not set — you will need to log in again after each restart.');
  }
});
