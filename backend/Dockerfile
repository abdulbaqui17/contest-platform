# Backend Dockerfile - Bun + TypeScript + Express + WebSocket
FROM oven/bun:1 AS base
WORKDIR /usr/src/app

# Copy workspace structure (monorepo style)
# Copy db package first (dependency)
COPY db/package.json db/
COPY db/prisma db/prisma/
COPY db/prismaClient.ts db/
COPY db/generated db/generated/

# Install db dependencies and generate Prisma client
WORKDIR /usr/src/app/db
RUN bun install --frozen-lockfile

# Copy backend package
WORKDIR /usr/src/app/backend
COPY backend/package.json backend/bun.lockb ./
RUN bun install --frozen-lockfile

# Copy backend source
COPY backend/ ./

# Expose backend port (HTTP + WebSocket on same port)
EXPOSE 3000

# Add health check endpoint
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s \
  CMD curl -f http://localhost:3000/health || exit 1

# Start backend server
CMD ["bun", "run", "index.ts"]
