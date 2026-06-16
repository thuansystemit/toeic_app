# Backend (NestJS) — built from the monorepo root (npm workspaces).
# Build with: docker compose build backend   (context is the repo root)
FROM node:20-bookworm

WORKDIR /app

# Toolchain for native deps (bcrypt).
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# Install workspace deps using the root lockfile.
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci

# Build the backend (devDeps like the Nest CLI are present).
COPY backend backend
RUN npm run build --workspace backend

WORKDIR /app/backend
EXPOSE 3000
# Apply pending migrations, then start the compiled API.
CMD ["sh", "-c", "npm run migration:run && node dist/main.js"]
