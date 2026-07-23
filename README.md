# Agent Deck

A web interface to drive your CLI coding agents (Claude Code, Codex, Gemini CLI, OpenCode…) remotely, from your computer or your phone.

Every session is a **tmux session** on your machine: it keeps running even after you close your browser, your laptop, or your phone. The UI (Devin/ChatGPT style) streams the real CLI in real time through xterm.js + WebSocket.

> ⚠️ **Agent Deck is, by design, a remote shell on your machine.** Anyone who passes authentication gets full shell access as the user running the server. Read the [Security](#security) section before exposing it to anything wider than localhost.

## Features

- **New session**: a central composer with Claude Code, Codex, Gemini CLI, OpenCode, Devin, Grok Code, and Shell — pick the working folder (or create one) before launching.
- **Official brand logos** and a minimal, premium, mobile-friendly interface.
- **Live chat-like history**: sorted by last interaction, with a status dot per session — pulsing amber while the agent works, green when it finished and is waiting for you, gray when paused for a long time.
- **Near-fullscreen terminal**: you interact directly with the real CLI. Sessions start inside a real login shell, so you keep a usable shell when the agent exits.
- **Self-healing connection**: the terminal reconnects automatically after network drops, phone locks, or app switches, and restores the scrollback.
- **Mobile message bar**: on small screens, send whole prompts to the agent through a proper input field instead of typing into the raw terminal.
- **Persistent and isolated sessions**: Agent Deck runs its own tmux server (`-L agent-deck -f /dev/null`) and never loads your personal tmux config or plugins.
- **Password auth** (rate-limited, revocable tokens) and **installable PWA**.

## Stack

- **Server**: Node + TypeScript, Express, `node-pty`, `ws`, tmux.
- **Client**: React 18 + TypeScript + Vite + Tailwind CSS v4 + xterm.js + framer-motion.

## Installation (Ubuntu VM)

```bash
sudo apt-get install -y tmux build-essential python3   # node-pty may compile natively
git clone https://github.com/Symbioose/agent-stack agent-deck
cd agent-deck
npm install          # installs everything + fixes node-pty permissions (postinstall)
npm run build        # builds the client (Vite) and the server (tsc)
```

## Running

```bash
AGENT_DECK_PASSWORD='your-password' \
AGENT_DECK_SECRET="$(openssl rand -hex 32)" \
PORT=3000 npm start
```

### Environment variables

| Variable | Purpose |
|---|---|
| `AGENT_DECK_PASSWORD` | Login password. **Unset = auth disabled**, and the server then only binds `127.0.0.1`. |
| `AGENT_DECK_SECRET` | Token signing key. **When set, you stay logged in across server restarts.** Changing the password also invalidates every issued token. Generate with `openssl rand -hex 32`. |
| `PORT` / `HOST` | Port (default `3000`) and bind address. `HOST` defaults to `0.0.0.0` with a password, `127.0.0.1` without one. |
| `AGENT_DECK_ROOT` | Optional. Confine folder browsing and session working directories under this path. |
| `AGENT_DECK_ALLOWED_ORIGINS` | Optional, comma-separated hostnames allowed to open WebSockets — only needed behind a reverse proxy that neither preserves `Host` nor sets `X-Forwarded-Host` (tailscale serve and Caddy both do). |
| `AGENT_DECK_INSECURE` | Set to `1` to allow binding a non-loopback address **without** a password. You almost never want this. |

## Security

- **Never expose the raw port to the public internet.** Prefer [Tailscale](#access-over-tailscale-recommended) (nothing public at all) or, failing that, a reverse proxy with HTTPS + a strong password. Plain HTTP leaks your password and tokens to the network.
- Login attempts are rate-limited (10 failures per 15 minutes) and tokens expire after 30 days. Changing `AGENT_DECK_PASSWORD` or `AGENT_DECK_SECRET` revokes all existing tokens.
- WebSocket upgrades are origin-checked, which blocks cross-site WebSocket hijacking and DNS rebinding from malicious web pages.
- Without a password the server refuses to listen on anything but loopback, and only loopback origins may connect.

## Access over Tailscale (recommended)

The nicest deployment: nothing exposed publicly, real HTTPS for the PWA, zero reverse-proxy config.

```bash
# On the VM (once): publish port 3000 inside your tailnet with a Let's Encrypt cert
sudo tailscale serve --bg 3000
```

Install Tailscale on your laptop/phone, sign in with the same account, and open
`https://<machine-name>.<tailnet>.ts.net` — the PWA installs cleanly from there.
Requires MagicDNS + HTTPS certificates enabled in the Tailscale admin console.
Keep port 3000 closed in your cloud firewall; `tailscale serve` reaches the app
through localhost.

## As a systemd service (recommended)

Secrets live in a root-only environment file, not in the world-readable unit:

```bash
sudo install -m 600 /dev/null /etc/agent-deck.env
sudo tee /etc/agent-deck.env <<EOF
AGENT_DECK_PASSWORD=CHANGE_ME
AGENT_DECK_SECRET=$(openssl rand -hex 32)
PORT=3000
EOF

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
EnvironmentFile=/etc/agent-deck.env
ExecStart=/usr/bin/node server/dist/index.js
Restart=always

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl enable --now agent-deck
```

## Docker

A ready-to-run image (multi-stage build, runs unprivileged, tmux included):

```bash
docker build -t agent-deck .

docker run -d --name agent-deck \
  -p 3000:3000 \
  -e AGENT_DECK_PASSWORD='your-password' \
  -e AGENT_DECK_SECRET="$(openssl rand -hex 32)" \
  -v agent-deck-data:/home/node/.agent-deck \
  --restart unless-stopped \
  agent-deck
```

The `agent-deck-data` volume keeps session metadata (`~/.agent-deck`) across container restarts.

> ⚠️ tmux sessions live **inside the container**. To use Claude Code / Codex / etc., those CLIs must be installed in the image (add them to the `Dockerfile`) or mounted in. If your CLIs are already installed on the VM, the **systemd** deployment above is usually simpler than Docker.

## HTTPS with a public domain

If you prefer a public domain over Tailscale, put a reverse proxy in front (Caddy is the simplest) — HTTPS is required for the PWA on mobile:

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

The `id` determines the displayed logo (`claude`, `codex`, `gemini`, `opencode`, `devin`, `grok`, `shell`). Missing CLIs stay visible in the picker; launching one shows a clear error without creating an orphan session. Malformed entries are ignored.

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
- Opening the **same session from two devices at once** shares one tmux pane: the terminal is resized to whichever client resized last, so the other device may see wrapped lines. This is inherent to tmux; use one device at a time per session for the best rendering.
- The first prompt of a session is typed into the CLI only once the CLI has actually taken over the pane, so a slow-starting agent can't leak your prompt to the shell.
- On macOS/some platforms, `node-pty` extracts its `spawn-helper` binary without the executable bit (→ `posix_spawnp failed`). The `postinstall` script (`scripts/fix-node-pty.mjs`) fixes this automatically.

## License

[MIT](LICENSE)
