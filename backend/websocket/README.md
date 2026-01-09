# WebSocket Server Implementation

## Overview

Production-ready WebSocket server implementation for the real-time contest platform, following the protocol specification in `WEBSOCKET_PROTOCOL.md`.

## Architecture

```
backend/
├── websocket/
│   ├── server.ts      # Main WebSocket server with JWT auth
│   └── types.ts       # TypeScript types from protocol spec
├── services/
│   ├── interfaces.ts  # Service layer interfaces
│   └── mocks.ts       # Mock implementations (to be replaced)
└── index.ts           # Express + WebSocket integration
```

## Features Implemented

### ✅ Connection Lifecycle
- JWT-based authentication via query parameter
- Connection acceptance/rejection with proper close codes
- Heartbeat mechanism (ping/pong every 30 seconds)
- Graceful shutdown handling

### ✅ Client Event Handlers
- `join_contest` - Validates contest and adds user to room
- `submit_answer` - Processes submissions via service layer
- `resync` - Provides current state snapshot on reconnection
- `ping` - Responds with pong for keep-alive

### ✅ Server Events (Ready to Emit)
- `contest_start` - Contest begins
- `question_broadcast` - New question
- `timer_update` - Real-time countdown
- `question_change` - Question transitions
- `submission_result` - Individual feedback
- `leaderboard_update` - Batched rank updates
- `contest_end` - Final results
- `error` - Error handling
- `pong` - Heartbeat response

### ✅ Room Management
- Contest-based rooms for targeted broadcasting
- Automatic cleanup on disconnect
- Multi-user contest support

### ✅ Error Handling
- Comprehensive error codes (INVALID_EVENT, CONTEST_NOT_FOUND, etc.)
- Proper WebSocket close codes (4001, 4002, 4003)
- Error event emission to clients

## Service Layer Integration

The WebSocket server is decoupled from business logic through service interfaces:

- **ContestService**: Contest data and state management
- **SubmissionService**: Answer validation and scoring
- **LeaderboardService**: Redis-backed real-time rankings
- **TimerService**: Question timer management

Currently using mock implementations in `services/mocks.ts`. These need to be replaced with actual implementations that use:
- Prisma for database operations
- Redis (ioredis) for leaderboard
- Business logic for scoring rules

## Usage

### Starting the Server

```bash
bun run start
```

Server will be available at:
- HTTP API: `http://localhost:3000`
- WebSocket: `ws://localhost:3000/ws/contest?token=<JWT_TOKEN>`

### Connecting from Client

```javascript
const token = "your-jwt-token";
const ws = new WebSocket(`ws://localhost:3000/ws/contest?token=${token}`);

ws.onopen = () => {
  // Join contest
  ws.send(JSON.stringify({
    event: "join_contest",
    data: { contestId: "contest-uuid" }
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log("Received:", message.event, message.data);
};
```

## Broadcasting Server Events

The WebSocket server exposes methods for broadcasting events to contest participants:

```typescript
// Example: Broadcasting contest start
wsServer.broadcastToContest(contestId, {
  event: "contest_start",
  data: {
    contestId,
    title: "Weekly Contest #42",
    startTime: new Date().toISOString(),
    totalQuestions: 10,
    estimatedDuration: 3600
  },
  timestamp: new Date().toISOString()
});
```

## Next Steps

### High Priority
1. **Implement ContestService** with Prisma
   - Fetch contest details
   - Validate user participation
   - Get current question state

2. **Implement SubmissionService** with Prisma
   - Validate submissions against schema
   - Check for duplicates
   - Calculate scores
   - Persist to database

3. **Implement LeaderboardService** with Redis
   - ZADD for score updates
   - ZREVRANGE for top-N
   - ZREVRANK for user rank
   - Persist to PostgreSQL on contest end

4. **Implement TimerService**
   - Start/stop question timers
   - Emit `timer_update` events every second
   - Trigger `question_change` on expiry

### Medium Priority
5. **Contest Orchestration**
   - Contest state machine (UPCOMING → ACTIVE → COMPLETED)
   - Automatic question progression
   - Timer management integration

6. **Leaderboard Batching**
   - Queue leaderboard updates
   - Batch broadcasts every 5-10 seconds
   - Optimize for high submission rates

### Future Enhancements
7. **Monitoring & Logging**
   - Connection metrics
   - Event throughput
   - Error rates

8. **Testing**
   - Unit tests for handlers
   - Integration tests with mocked services
   - Load testing for concurrent users

## Protocol Compliance

✅ All events follow exact payload shapes from `WEBSOCKET_PROTOCOL.md`
✅ No custom events added beyond specification
✅ Handlers remain thin - all logic delegated to services
✅ Ready for production with real service implementations
