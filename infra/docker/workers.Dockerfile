# ============================================
# Stage 1: Builder — Install deps & compile TS
# ============================================
FROM node:24-slim AS builder

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/workers/package.json ./apps/workers/
COPY packages/database/package.json ./packages/database/
COPY packages/types/package.json ./packages/types/ 2>/dev/null || true
COPY packages/config/package.json ./packages/config/ 2>/dev/null || true

RUN npm install -g pnpm@10.30.1 && \
    pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Generate Prisma client
RUN pnpm --filter @crmed/database db:generate

# Build workers
RUN pnpm --filter @crmed/workers build

# ============================================
# Stage 2: Production — Minimal runtime image
# ============================================
FROM node:24-slim AS production

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN npm install -g pnpm@10.30.1

# Copy workspace config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/workers/package.json ./apps/workers/
COPY packages/database/package.json ./packages/database/
COPY packages/types/package.json ./packages/types/ 2>/dev/null || true
COPY packages/config/package.json ./packages/config/ 2>/dev/null || true

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy compiled output from builder
COPY --from=builder /app/apps/workers/dist ./apps/workers/dist

# Copy Prisma schema and generated client
COPY --from=builder /app/packages/database/prisma ./packages/database/prisma
COPY --from=builder /app/node_modules/.pnpm/@prisma+client@*/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.pnpm/@prisma+client@*/node_modules/.prisma ./node_modules/.prisma

# Setup workspace symlinks
RUN mkdir -p node_modules/@crmed && \
    ln -s ../../packages/database node_modules/@crmed/database

# Security: Run as non-root user
USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3002/').then(r=>process.exit(0)).catch(()=>process.exit(1))"

CMD ["node", "apps/workers/dist/index.js"]
