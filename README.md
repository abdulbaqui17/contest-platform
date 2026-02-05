# Real-Time Contest Platform

A full-stack platform for running live coding contests with real-time updates and isolated code execution.

## At a Glance
- Frontend: React + Vite (served by Nginx in Docker)
- Backend: Bun + Express + WebSocket (ws)
- Data: PostgreSQL + Prisma
- Realtime: Redis-backed leaderboard updates
- Code runner: ephemeral Docker containers per test case

## Repository Structure
- `backend/` Bun/Express API, WebSocket server, service layer, tests
- `frontend/` React/Vite app
- `db/` Prisma schema, migrations, seed scripts
- `runner-tmp/` Host-mounted temp directory for code execution
- `docker-compose.yml` Local Docker stack
- `docker-compose.production.yml` Production-like Docker stack
- `DOCKER_SETUP.md` Docker quick start and credentials
- `PRODUCTION_CODE_EXECUTION.md` Code runner architecture and limits
- `WEBSOCKET_PROTOCOL.md` WebSocket event specification
- `BACKEND_TEST_CHECKLIST.md` Manual API and WS test checklist
- `MIGRATION_GUIDE.md` Notes on the Docker runner migration

## Quick Start (Docker)
1. Copy environment file:
```bash
cp .env.example .env
```

2. Create the runner temp directory (required for code execution):
```bash
mkdir -p runner-tmp
```

3. Build and start all services:
```bash
docker compose up --build
```

4. Open the app and APIs:
- Frontend: http://localhost (port 80)
- Backend API: http://localhost:3001
- WebSocket: ws://localhost:3001/ws/contest
- Public WebSocket: ws://localhost:3001/ws/public

Default test user (seeded in Docker):
- Email: `qa@test.com`
- Password: `test123`

## Local Development (No Docker for App)
You can still run the app locally while using Docker for Postgres and Redis.

1. Start infra services:
```bash
docker compose up -d postgres redis
```

2. Backend:
```bash
cd backend
bun install
bun run start
```

3. Frontend:
```bash
cd frontend
npm install
npm run dev
```

4. Database migrations:
```bash
cd db
bun install
bun prisma migrate dev
```

## Environment
Configuration lives in `.env`. Start from `.env.example` and update:
- `DATABASE_URL`, `JWT_SECRET`, `REDIS_*`
- `BACKEND_PORT`, `FRONTEND_PORT`
- `VITE_API_BASE_URL`, `VITE_WS_URL`

## Tests
- Backend: `cd backend && bun test`
- Frontend: `cd frontend && npm run test`
- Frontend (CI): `cd frontend && npm run test:run`

## Notes and Status
- The WebSocket protocol is fully specified in `WEBSOCKET_PROTOCOL.md`.
- Backend routes and service stubs are in place; some business logic is still placeholder while the database and service layer are filled in.
- Code execution uses Docker per test case; see `PRODUCTION_CODE_EXECUTION.md`.

