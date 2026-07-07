# -------------------------
# Dependencies
# -------------------------
FROM node:22-alpine AS deps

WORKDIR /app

COPY package*.json ./

RUN npm ci

# -------------------------
# Builder
# -------------------------
FROM node:22-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# Remove development dependencies
RUN npm prune --omit=dev

# -------------------------
# Runner
# -------------------------
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Create non-root user
RUN addgroup -S nodejs && \
    adduser -S express -G nodejs

# Production dependencies
COPY --from=builder /app/node_modules ./node_modules

# Compiled application
COPY --from=builder /app/dist ./dist

# Runtime assets
COPY --from=builder /app/public ./public
COPY --from=builder /app/src/config ./dist/config

# Optional (only if used at runtime)
COPY --from=builder /app/sql ./sql
COPY --from=builder /app/seeds ./seeds

COPY --from=builder /app/package*.json ./

USER express

EXPOSE 3000

CMD ["npm", "start"]