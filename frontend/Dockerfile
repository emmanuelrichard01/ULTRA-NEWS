# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# deps — install once, cached on the lockfile
# ---------------------------------------------------------------------------
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# `npm ci` installs exactly the lockfile. `npm install` was being used, which can
# silently resolve different versions than were tested.
RUN npm ci

# ---------------------------------------------------------------------------
# dev — what docker-compose runs locally
# ---------------------------------------------------------------------------
FROM node:20-slim AS dev
WORKDIR /app
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ---------------------------------------------------------------------------
# builder — produce the standalone production bundle
# ---------------------------------------------------------------------------
FROM node:20-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
# runner — minimal production image, unprivileged
# ---------------------------------------------------------------------------
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 --ingroup nodejs nextjs

# `output: 'standalone'` emits a self-contained server with only the modules it
# actually needs, so the production image never ships the full node_modules tree.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
