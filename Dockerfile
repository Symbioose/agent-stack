# Agent Deck — multi-stage build: compilers stay out of the runtime image.
FROM node:22-bookworm-slim AS build

# Build tools let node-pty compile from source if no prebuilt binary matches.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first (better layer caching). Workspace package files only.
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/
COPY scripts ./scripts
RUN npm ci

# Build the app, then drop dev dependencies from node_modules.
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim

# tmux is required at runtime: sessions live in tmux.
RUN apt-get update \
  && apt-get install -y --no-install-recommends tmux ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server ./server
COPY --from=build /app/client/dist ./client/dist
COPY --from=build /app/package.json ./package.json

# Run unprivileged; pre-create the metadata dir so the named volume mounted
# there belongs to the runtime user, not root.
RUN mkdir -p /home/node/.agent-deck && chown -R node:node /home/node/.agent-deck /app
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/config').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# AGENT_DECK_PASSWORD and AGENT_DECK_SECRET are passed at runtime (see README).
CMD ["node", "server/dist/index.js"]
