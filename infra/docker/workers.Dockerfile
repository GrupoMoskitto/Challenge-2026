FROM node:24-slim

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY apps/workers/package.json ./apps/workers/
COPY packages/database/package.json ./packages/database/

RUN npm install -g pnpm@10.30.1 && \
    pnpm install

COPY . .

CMD ["pnpm", "--filter", "@crmed/workers", "dev"]
