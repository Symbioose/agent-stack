# Agent Deck

Interface web pour piloter tes agents CLI (Claude Code, Codex, Gemini CLI, OpenCode…) à distance, depuis ton PC ou ton téléphone.

Chaque « session » est une **session tmux** sur ta machine : elle continue de tourner même quand tu fermes ton navigateur, ton PC ou ton téléphone. L'UI (façon Devin/ChatGPT) affiche la vraie CLI en temps réel via xterm.js + WebSocket.

## Fonctionnalités

- **Home façon Devin** : composer en bulle au centre, tu décris ta tâche et choisis la CLI (vrais logos Claude / Codex / Gemini / OpenCode / Shell).
- **Sidebar temps réel** : liste des sessions avec logo, titre, et point de statut **vert pulsant** (en cours) ou gris (en attente). Les statuts sont **poussés par le serveur** (WebSocket) — pas de polling, c'est instantané.
- **Terminal plein écran** = la vraie CLI de la machine, en direct. Le **scrollback est restauré** à la reconnexion (tu retrouves l'historique).
- **Sessions persistantes (tmux)** : ferme ton PC, reprends depuis ton téléphone.
- **Renommage inline** (double-clic sur un titre) et suppression.
- **Auth par mot de passe**, responsive mobile, **installable en PWA**.

## Stack

- **Serveur** : Node + TypeScript, Express, `node-pty`, `ws`, tmux.
- **Client** : React 18 + TypeScript + Vite + Tailwind CSS v4 + xterm.js.

## Installation (VM Ubuntu)

```bash
sudo apt-get install -y tmux build-essential python3   # node-pty compile en natif si besoin
git clone <ton-repo> agent-deck
cd agent-deck
npm install          # installe tout + fixe les permissions node-pty (postinstall)
npm run build        # build client (Vite) + serveur (tsc)
```

## Lancement

```bash
AGENT_DECK_PASSWORD='ton-mot-de-passe' \
AGENT_DECK_SECRET='une-longue-chaine-aleatoire' \
PORT=3000 npm start
```

Puis ouvre `http://IP_DE_TA_VM:3000` (pense à ouvrir le port dans le firewall Oracle + `ufw`).

### Variables d'environnement

| Variable | Rôle |
|---|---|
| `AGENT_DECK_PASSWORD` | Mot de passe de connexion. **Non défini = auth désactivée** (local uniquement). |
| `AGENT_DECK_SECRET` | Clé de signature des tokens. **Si définie, tu restes connecté après un redémarrage** du serveur. Sinon une clé aléatoire est générée à chaque boot (il faut se reconnecter). Génère-la avec `openssl rand -hex 32`. |
| `PORT` / `HOST` | Port (défaut `3000`) et interface d'écoute (défaut `0.0.0.0`). |

### En service systemd (recommandé)

```bash
sudo tee /etc/systemd/system/agent-deck.service <<'EOF'
[Unit]
Description=Agent Deck
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/agent-deck
Environment=AGENT_DECK_PASSWORD=CHANGE_ME
Environment=AGENT_DECK_SECRET=CHANGE_ME_TOO
Environment=PORT=3000
ExecStart=/usr/bin/npm start
Restart=always

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl enable --now agent-deck
```

## Docker

Une image toute prête (build + tmux inclus) :

```bash
docker build -t agent-deck .

docker run -d --name agent-deck \
  -p 3000:3000 \
  -e AGENT_DECK_PASSWORD='ton-mot-de-passe' \
  -e AGENT_DECK_SECRET="$(openssl rand -hex 32)" \
  -v agent-deck-data:/root/.agent-deck \
  --restart unless-stopped \
  agent-deck
```

Le volume `agent-deck-data` conserve les métadonnées des sessions (`~/.agent-deck`) entre les redémarrages du conteneur.

> ⚠️ Les sessions tmux vivent **dans le conteneur**. Pour utiliser Claude Code / Codex / etc., ces CLIs doivent être installées dans l'image (ajoute-les au `Dockerfile`) ou tu montes leur binaire. Si tes CLIs sont déjà installées sur la VM, le déploiement **systemd** ci-dessus est souvent plus simple que Docker.

## HTTPS (fortement recommandé)

Mets un reverse proxy (Caddy est le plus simple) devant — indispensable pour la PWA sur mobile :

```
# /etc/caddy/Caddyfile
ton-domaine.com {
    reverse_proxy localhost:3000
}
```

Caddy gère le certificat Let's Encrypt automatiquement, et les WebSockets passent sans config.

## Personnaliser les CLIs

Crée `~/.agent-deck/clis.json` :

```json
[
  { "id": "claude", "label": "Claude Code", "command": "claude" },
  { "id": "codex", "label": "Codex", "command": "codex" },
  { "id": "shell", "label": "Shell", "command": "" }
]
```

L'`id` détermine le logo affiché (`claude`, `codex`, `gemini`, `opencode`, `shell`).

## Développement

```bash
npm run dev         # serveur :3000 (tsx watch) + Vite HMR :5173 (proxy /api et /ws)
npm run typecheck   # vérifie les types côté serveur et client
```

## Notes

- Les tokens de connexion sont invalidés au redémarrage du serveur (il suffit de se reconnecter).
- Supprimer une session **tue** le processus tmux qui tourne dedans.
- Les métadonnées des sessions sont dans `~/.agent-deck/sessions.json`.
- Sur macOS/certaines plateformes, `node-pty` extrait son binaire `spawn-helper` sans le bit exécutable (→ `posix_spawnp failed`). Le `postinstall` (`scripts/fix-node-pty.mjs`) corrige ça automatiquement.
