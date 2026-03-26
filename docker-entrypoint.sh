#!/bin/sh
set -e

echo "Running Prisma migrations..."
node node_modules/prisma/build/index.js db push --skip-generate --accept-data-loss

echo "Seeding database..."
node node_modules/tsx/dist/cli.mjs prisma/seed.ts || echo "Seed already applied or failed (non-critical)"

echo "Starting application..."
node server.js
