# ============================================
# Stage 1: Builder — Install deps & build Vite
# ============================================
FROM node:24-slim AS builder

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/database/package.json ./packages/database/
COPY packages/ui/package.json ./packages/ui/
COPY packages/types/package.json ./packages/types/ 2>/dev/null || true
COPY packages/config/package.json ./packages/config/ 2>/dev/null || true

RUN npm install -g pnpm@10.30.1 && \
    pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the web app (Vite produces static assets in dist/)
RUN pnpm --filter @crmed/web build

# ============================================
# Stage 2: Production — Nginx serves static files
# ============================================
FROM nginx:alpine AS production

# Security: Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Custom nginx config with security headers
RUN cat > /etc/nginx/conf.d/crmed.conf << 'EOF'
server {
    listen 3000;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Security headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    # SPA routing — serve index.html for all routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets aggressively
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # Don't expose nginx version
    server_tokens off;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
    gzip_min_length 1024;
}
EOF

# Copy built assets from builder stage
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Security: Run as non-root user
# nginx:alpine supports running as non-root with proper config
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

USER nginx

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
