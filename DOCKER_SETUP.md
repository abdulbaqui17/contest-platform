# Real-time Contest Platform - Docker Setup

## Quick Start

1. Copy environment file:
```bash
cp .env.example .env
```

2. Build and start all services:
```bash
docker compose up --build
```

Note: the backend writes code to `./runner-tmp` so it can mount the files into
per-run Docker containers. Create it once if needed:
```bash
mkdir -p runner-tmp
```

3. Access the platform:
- Frontend: http://localhost (or http://localhost:80)
- Backend API: http://localhost:3001
- WebSocket: ws://localhost:3001/ws/contest
- Public WebSocket: ws://localhost:3001/ws/public

## Default Credentials

Test user (created by seed script):
- Email: qa@test.com
- Password: test123

## Services

- **frontend**: React + Vite (Nginx)
- **backend**: Bun + Express + WebSocket
- **postgres**: PostgreSQL 16
- **redis**: Redis 7
- **db-migrate**: Prisma migrations (runs once)

## Code Execution (Docker Runner)

All code runs inside **ephemeral Docker containers** created by the backend.
When running the backend in Docker, we mount the host Docker socket:

```
/var/run/docker.sock:/var/run/docker.sock
```

This allows the backend container to spawn short‑lived runner containers.

## Ports

- Frontend: 80
- Backend: 3001
- PostgreSQL: 5432
- Redis: 6379

## Database Seeding

To seed test data:
```bash
docker compose exec backend bun run ../db/seed-test-data.ts
```

## Logs

View logs:
```bash
docker compose logs -f backend
docker compose logs -f frontend
```

## Cleanup

Stop and remove all containers:
```bash
docker compose down
```

Remove volumes (deletes database data):
```bash
docker compose down -v
```
