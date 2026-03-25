FROM node:18-slim AS deps
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:18-slim AS builder
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:18-slim AS runner
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone build
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy package.json
COPY --from=builder /app/package.json ./package.json

# Copy Prisma files for migrations and seeding
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Copy tsx and its dependencies for seed script execution
COPY --from=builder /app/node_modules/tsx ./node_modules/tsx
COPY --from=builder /app/node_modules/esbuild ./node_modules/esbuild
COPY --from=builder /app/node_modules/@esbuild ./node_modules/@esbuild
COPY --from=builder /app/node_modules/get-tsconfig ./node_modules/get-tsconfig
COPY --from=builder /app/node_modules/resolve-pkg-maps ./node_modules/resolve-pkg-maps

# Copy BullMQ and Redis dependencies for queue module
COPY --from=builder /app/node_modules/bullmq ./node_modules/bullmq
COPY --from=builder /app/node_modules/ioredis ./node_modules/ioredis
COPY --from=builder /app/node_modules/denque ./node_modules/denque
COPY --from=builder /app/node_modules/cluster-key-slot ./node_modules/cluster-key-slot
COPY --from=builder /app/node_modules/standard-as-callback ./node_modules/standard-as-callback
COPY --from=builder /app/node_modules/msgpackr ./node_modules/msgpackr
COPY --from=builder /app/node_modules/msgpackr-extract ./node_modules/msgpackr-extract
COPY --from=builder /app/node_modules/node-gyp-build-optional-packages ./node_modules/node-gyp-build-optional-packages
COPY --from=builder /app/node_modules/cron-parser ./node_modules/cron-parser
COPY --from=builder /app/node_modules/luxon ./node_modules/luxon
COPY --from=builder /app/node_modules/glob ./node_modules/glob

# Copy AI provider SDKs
COPY --from=builder /app/node_modules/@google ./node_modules/@google
COPY --from=builder /app/node_modules/@anthropic-ai ./node_modules/@anthropic-ai
COPY --from=builder /app/node_modules/openai ./node_modules/openai

# Copy crypto dependencies
COPY --from=builder /app/node_modules/@types ./node_modules/@types

# Copy entrypoint script and fix line endings
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN sed -i 's/\r$//' ./docker-entrypoint.sh && chmod +x ./docker-entrypoint.sh

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "docker-entrypoint.sh"]
