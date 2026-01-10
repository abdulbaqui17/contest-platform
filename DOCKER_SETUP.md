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

3. Access the platform:
- Frontend: http://localhost (or http://localhost:80)
- Backend API: http://localhost:3000
- WebSocket: ws://localhost:3000/ws/contest

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

## Ports

- Frontend: 80
- Backend: 3000
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
