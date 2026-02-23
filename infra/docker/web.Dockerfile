FROM node:24-slim

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/database/package.json ./packages/database/
COPY packages/ui/package.json ./packages/ui/

RUN npm install -g pnpm@10.30.1 && \
    pnpm install

COPY . .

EXPOSE 3000

CMD ["pnpm", "--filter", "@crmed/web", "dev"]
