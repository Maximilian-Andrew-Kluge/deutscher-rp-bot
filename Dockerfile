# ── Build Stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Build-Tools für native Module (sql.js braucht keine, aber pdfkit schon)
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Production Stage ──────────────────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

# Web-Frontend statische Dateien
COPY --from=builder /app/web ./web

# Datenbank + Logs Verzeichnisse
RUN mkdir -p /app/data /app/logs

ENV NODE_ENV=production

# Non-root User
RUN addgroup -g 1001 -S nodejs && adduser -S botuser -u 1001
RUN chown -R botuser:nodejs /app/data /app/logs
USER botuser

EXPOSE 3000

CMD ["node", "dist/index.js"]
