FROM node:20-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/database/package.json ./packages/database/

RUN npm install -g pnpm@10.30.1 && \
    pnpm install --frozen-lockfile

COPY . .

EXPOSE 3001

CMD ["pnpm", "--filter", "@crmed/api", "dev"]
