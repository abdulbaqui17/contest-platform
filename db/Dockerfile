# Database Migration Dockerfile - Runs Prisma migrations
FROM oven/bun:1
WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies including Prisma CLI
RUN bun install --frozen-lockfile

# Copy Prisma schema and migrations
COPY prisma ./prisma
COPY prismaClient.ts ./
COPY prisma.config.ts ./

# Set dummy DATABASE_URL for generate step (not used, but required by config)
ARG DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy
ENV DATABASE_URL=$DATABASE_URL

# Generate Prisma client with adapter
RUN bunx prisma generate

# Run migrations and exit (uses real DATABASE_URL from docker-compose)
CMD ["bunx", "prisma", "migrate", "deploy"]
