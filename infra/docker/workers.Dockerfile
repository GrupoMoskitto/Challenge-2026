FROM node:20-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY apps/workers/package.json ./apps/workers/
COPY packages/database/package.json ./packages/database/

RUN npm install -g pnpm@10.30.1 && \
    pnpm install --frozen-lockfile

COPY . .

CMD ["pnpm", "--filter", "@crmed/workers", "dev"]
