# Agent Deck

A web interface to drive your CLI coding agents (Claude Code, Codex, Gemini CLI, OpenCode…) remotely, from your computer or your phone.

Every session is a **tmux session** on your machine: it keeps running even after you close your browser, your laptop, or your phone. The UI (Devin/ChatGPT style) streams the real CLI in real time through xterm.js + WebSocket.

## Features

- **New session**: a central composer with Claude Code, Codex, Gemini CLI, OpenCode, Devin, Grok Code, and Shell — pick the working folder (or create one) before launching.
- **Official brand logos** and a minimal, premium, mobile-friendly interface.
- **Live chat-like history**: sorted by last interaction, with a status dot per session — pulsing amber while the agent works, green when it finished and is waiting for you, gray when paused for a long time.
- **Near-fullscreen terminal**: you interact directly with the real CLI. Sessions start inside a real login shell, so you keep a usable shell when the agent exits.
- **Persistent and isolated sessions**: Agent Deck runs its own tmux server (`-L agent-deck -f /dev/null`) and never loads your personal tmux config or plugins.
- **Scrollback restored** on reconnect; rename/delete from the session actions or the sidebar.
- **Password auth** and **installable PWA**.

## Stack

- **Server**: Node + TypeScript, Express, `node-pty`, `ws`, tmux.
- **Client**: React 18 + TypeScript + Vite + Tailwind CSS v4 + xterm.js + framer-motion.

## Installation (Ubuntu VM)

```bash
sudo apt-get install -y tmux build-essential python3   # node-pty may compile natively
git clone <your-repo> agent-deck
cd agent-deck
npm install          # installs everything + fixes node-pty permissions (postinstall)
npm run build        # builds the client (Vite) and the server (tsc)
```

## Running

```bash
AGENT_DECK_PASSWORD='your-password' \
AGENT_DECK_SECRET='a-long-random-string' \
PORT=3000 npm start
```

Then open `http://YOUR_VM_IP:3000` (remember to open the port in your cloud firewall + `ufw`).

### Environment variables

| Variable | Purpose |
|---|---|
| `AGENT_DECK_PASSWORD` | Login password. **Unset = auth disabled** (local use only). |
| `AGENT_DECK_SECRET` | Token signing key. **When set, you stay logged in across server restarts.** Otherwise a random key is generated at each boot (you must log in again). Generate one with `openssl rand -hex 32`. |
| `PORT` / `HOST` | Port (default `3000`) and bind address (default `0.0.0.0`). |

### As a systemd service (recommended)

```bash
sudo tee /etc/systemd/system/agent-deck.service <<'EOF'
[Unit]
Description=Agent Deck
After=network.target

[Service]
# Only signal the tracked process on stop/restart. The default control-group
# kill mode would also kill the detached tmux server (and every session
# running inside it) whenever the service restarts or is updated.
#
# ExecStart must invoke node directly rather than `npm start`: npm exits
# separately from the node process it spawns, so with KillMode=process
# systemd would only track the short-lived npm wrapper and could leave the
# real server running as an orphan on restart, causing a port conflict.
KillMode=process
User=ubuntu
WorkingDirectory=/home/ubuntu/agent-deck
Environment=AGENT_DECK_PASSWORD=CHANGE_ME
Environment=AGENT_DECK_SECRET=CHANGE_ME_TOO
Environment=PORT=3000
ExecStart=/usr/bin/node server/dist/index.js
Restart=always

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl enable --now agent-deck
```

## Docker

A ready-to-run image (build + tmux included):

```bash
docker build -t agent-deck .

docker run -d --name agent-deck \
  -p 3000:3000 \
  -e AGENT_DECK_PASSWORD='your-password' \
  -e AGENT_DECK_SECRET="$(openssl rand -hex 32)" \
  -v agent-deck-data:/root/.agent-deck \
  --restart unless-stopped \
  agent-deck
```

The `agent-deck-data` volume keeps session metadata (`~/.agent-deck`) across container restarts.

> ⚠️ tmux sessions live **inside the container**. To use Claude Code / Codex / etc., those CLIs must be installed in the image (add them to the `Dockerfile`) or mounted in. If your CLIs are already installed on the VM, the **systemd** deployment above is usually simpler than Docker.

## HTTPS (strongly recommended)

Put a reverse proxy in front (Caddy is the simplest) — required for the PWA on mobile:

```
# /etc/caddy/Caddyfile
your-domain.com {
    reverse_proxy localhost:3000
}
```

Caddy handles the Let's Encrypt certificate automatically, and WebSockets pass through with no extra config.

## Customizing the CLIs

Create `~/.agent-deck/clis.json`:

```json
[
  { "id": "claude", "label": "Claude Code", "command": "claude" },
  { "id": "codex", "label": "Codex", "command": "codex" },
  { "id": "shell", "label": "Shell", "command": "" }
]
```

The `id` determines the displayed logo (`claude`, `codex`, `gemini`, `opencode`, `devin`, `grok`, `shell`). Missing CLIs stay visible in the picker; launching one shows a clear error without creating an orphan session.

## Development

```bash
npm run dev         # server :3000 (tsx watch) + Vite HMR :5173 (proxies /api and /ws)
npm test            # server tests + React component tests
npm run typecheck   # type-checks server and client
npm run verify      # tests + types + production build
AGENT_DECK_PASSWORD=your-password npm run smoke
```

`AGENT_DECK_TMUX_SOCKET` overrides the isolated tmux socket name, mainly for tests.

## Notes

- With `AGENT_DECK_SECRET`, tokens stay valid across restarts; without it, you must log in again.
- Deleting a session **kills** the tmux process running inside it.
- Session metadata lives in `~/.agent-deck/sessions.json`.
- On macOS/some platforms, `node-pty` extracts its `spawn-helper` binary without the executable bit (→ `posix_spawnp failed`). The `postinstall` script (`scripts/fix-node-pty.mjs`) fixes this automatically.
