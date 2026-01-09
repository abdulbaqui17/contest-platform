# Contest Platform Backend

A clean backend skeleton for a real-time contest platform built with Bun, Express, Prisma, and Zod.

## Structure

```
backend/
├── auth/          # Authentication endpoints (signup, signin)
├── contests/      # Contest and leaderboard endpoints
├── schemas.ts     # Zod validation schemas for all API contracts
└── index.ts       # Express app entry point

db/
├── prismaClient.ts    # Single source of truth for Prisma client
└── prisma/
    └── schema.prisma  # Database schema
```

## Setup

1. Install dependencies:
```bash
bun install
```

2. Set up environment variables:
```bash
DATABASE_URL="postgresql://..."
JWT_SECRET="your-secret-key"
```

3. Run Prisma migrations:
```bash
cd ../db
bun prisma migrate dev
```

4. Start the server:
```bash
bun run start
```

## API Endpoints

### Authentication
- `POST /auth/signup` - User registration
- `POST /auth/signin` - User login

### Contests
- `GET /contests` - List all contests
- `GET /contest/:contestId` - Get contest details
- `POST /contest/:contestId/join` - Join a contest

### Contest Runtime
- `GET /contest/:contestId/current-question` - Get current question
- `POST /contest/:contestId/submit` - Submit answer

### Leaderboard
- `GET /leaderboard/:contestId` - Get full leaderboard
- `GET /leaderboard/:contestId/me` - Get user's rank

## Important Notes

⚠️ **Current State**: Routes return mock/placeholder responses. Business logic is NOT implemented yet.

✅ **What's Ready**:
- API contract definitions
- Zod validation schemas
- Route structure
- Prisma client setup (single source in `../db/prismaClient.ts`)

❌ **NOT Implemented**:
- Database queries
- JWT authentication middleware
- Business logic
- WebSocket support
- Leaderboard calculation

## Architecture Decisions

### Prisma Client
- **Single source**: `../db/prismaClient.ts`
- **Export style**: Named export only (`export const prisma`)
- **No multiple instances**: Global singleton pattern for dev environment
- **Import pattern**: `import { prisma } from "../../db/prismaClient"`

### Route Structure
- Routes are thin shells - no business logic
- All request validation via Zod schemas
- Placeholder/mock responses only
- Ready for service layer injection

### WebSocket Server
- **Endpoint**: `ws://localhost:3000/ws/contest`
- **Authentication**: JWT token via query parameter
- **Protocol**: Follows `WEBSOCKET_PROTOCOL.md` exactly
- **Room-based**: Contest participants in isolated rooms
- **Service layer**: Decoupled business logic via interfaces
- **Status**: ✅ Fully implemented with mock services

## Next Steps

1. **Replace Mock Services** with real implementations:
   - ContestService → Prisma queries
   - SubmissionService → Validation + Prisma
   - LeaderboardService → Redis (ioredis)
   - TimerService → Event-driven timers
2. Implement JWT authentication middleware for REST APIs
3. Implement contest orchestration (state machine)
4. Design and implement WebSocket protocol
5. Implement leaderboard system
