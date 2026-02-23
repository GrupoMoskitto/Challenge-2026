FROM node:24-slim

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/database/package.json ./packages/database/

RUN npm install -g pnpm@10.30.1 && \
    pnpm install

COPY . .

RUN pnpm --filter @crmed/database db:generate

RUN mkdir -p node_modules/@crmed && \
    ln -s ../../packages/database node_modules/@crmed/database

RUN cp -r node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/@prisma node_modules/ && \
    mkdir -p node_modules/.prisma/client && \
    cp -r node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client/* node_modules/.prisma/client/

EXPOSE 3001

CMD ["pnpm", "--filter", "@crmed/api", "dev"]
