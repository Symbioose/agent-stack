# Agent Deck — build + run in one image.
FROM node:22-bookworm-slim

# tmux is required at runtime (sessions live in tmux); build tools let node-pty
# compile from source if a prebuilt binary isn't available for the platform.
RUN apt-get update \
  && apt-get install -y --no-install-recommends tmux python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first (better layer caching). Workspace package files only.
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/
COPY scripts ./scripts
RUN npm install

# Build the app.
COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
EXPOSE 3000

# AGENT_DECK_PASSWORD and AGENT_DECK_SECRET are passed at runtime (see README).
CMD ["node", "server/dist/index.js"]
