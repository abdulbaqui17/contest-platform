# WebSocket Protocol Specification
## Real-Time Contest Platform

**Version**: 1.0  
**Last Updated**: January 9, 2026  
**Status**: Design Complete - Ready for Implementation

---

## 1. Connection Lifecycle

### 1.1 Connection Establishment

**Endpoint**: `wss://<host>/ws/contest`

**Authentication**: JWT token passed as query parameter
```
wss://api.example.com/ws/contest?token=<JWT_TOKEN>
```

**Connection Flow**:
1. Client initiates WebSocket connection with JWT in query string
2. Server validates JWT token immediately upon connection
3. Server responds with connection acceptance or rejection

**Connection Acceptance** (HTTP 101 Switching Protocols):
- Valid JWT token
- User exists in database
- Connection upgraded to WebSocket

**Connection Rejection** (WebSocket Close):
```json
{
  "code": 4001,
  "reason": "Authentication failed: Invalid or expired token"
}
```

Close codes:
- `4001` - Invalid or expired JWT token
- `4002` - User not found
- `4003` - Server error during authentication

### 1.2 Post-Connection Flow

After successful connection:
1. Client MUST send `join_contest` event within 5 seconds
2. Server validates contest participation eligibility
3. Server adds client to contest room
4. Connection remains open for entire contest duration

### 1.3 Reconnection Handling

On disconnect/reconnect:
1. Client reconnects with same JWT token
2. Client sends `resync` event with contestId
3. Server validates current contest state
4. Server sends current state snapshot
5. Normal event stream resumes

### 1.4 Connection Termination

**Graceful Close**:
- Contest ends → Server sends `contest_end` → Server closes with code 1000
- Client leaves → Client closes connection → Server cleanup

**Error Close**:
- Invalid operations → Server closes with code 4xxx
- Inactivity timeout (30 min) → Server closes with code 1001

---

## 2. Server → Client Events

### 2.1 contest_start

**Trigger**: Contest transitions from UPCOMING to ACTIVE  
**Audience**: All participants in contest room  
**Frequency**: Once per contest

**Payload**:
```json
{
  "event": "contest_start",
  "data": {
    "contestId": "uuid",
    "title": "string",
    "startTime": "ISO 8601 timestamp",
    "totalQuestions": "number",
    "estimatedDuration": "number (seconds)"
  },
  "timestamp": "ISO 8601 timestamp"
}
```

**Required Fields**: All fields are required

**Example**:
```json
{
  "event": "contest_start",
  "data": {
    "contestId": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
    "title": "Weekly Contest #42",
    "startTime": "2026-01-09T10:00:00.000Z",
    "totalQuestions": 10,
    "estimatedDuration": 3600
  },
  "timestamp": "2026-01-09T10:00:00.000Z"
}
```

---

### 2.2 question_broadcast

**Trigger**: New question becomes active for user  
**Audience**: Individual user or all users (depending on contest mode)  
**Frequency**: Multiple times per contest (once per question)

**Payload**:
```json
{
  "event": "question_broadcast",
  "data": {
    "questionId": "uuid",
    "contestQuestionId": "uuid",
    "type": "MCQ | DSA | SANDBOX",
    "title": "string",
    "description": "string (markdown supported)",
    "mcqOptions": [
      {
        "id": "uuid",
        "text": "string"
      }
    ],
    "timeLimit": "number (seconds)",
    "points": "number",
    "questionNumber": "number",
    "totalQuestions": "number",
    "startedAt": "ISO 8601 timestamp"
  },
  "timestamp": "ISO 8601 timestamp"
}
```

**Required Fields**: `questionId`, `contestQuestionId`, `type`, `title`, `description`, `timeLimit`, `points`, `questionNumber`, `totalQuestions`, `startedAt`

**Optional Fields**: `mcqOptions` (only present for type === "MCQ")

**Example (MCQ)**:
```json
{
  "event": "question_broadcast",
  "data": {
    "questionId": "q1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
    "contestQuestionId": "cq1b2c3d-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
    "type": "MCQ",
    "title": "What is the time complexity of binary search?",
    "description": "Select the correct time complexity for binary search algorithm on a sorted array of size n.",
    "mcqOptions": [
      {
        "id": "opt1-uuid",
        "text": "O(n)"
      },
      {
        "id": "opt2-uuid",
        "text": "O(log n)"
      },
      {
        "id": "opt3-uuid",
        "text": "O(n log n)"
      },
      {
        "id": "opt4-uuid",
        "text": "O(1)"
      }
    ],
    "timeLimit": 300,
    "points": 100,
    "questionNumber": 1,
    "totalQuestions": 10,
    "startedAt": "2026-01-09T10:00:05.000Z"
  },
  "timestamp": "2026-01-09T10:00:05.000Z"
}
```

---

### 2.3 timer_update

**Trigger**: Every second during active question  
**Audience**: All users with active question  
**Frequency**: High (1 Hz)

**Payload**:
```json
{
  "event": "timer_update",
  "data": {
    "questionId": "uuid",
    "timeRemaining": "number (seconds)",
    "totalTime": "number (seconds)"
  },
  "timestamp": "ISO 8601 timestamp"
}
```

**Required Fields**: All fields are required

**Example**:
```json
{
  "event": "timer_update",
  "data": {
    "questionId": "q1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
    "timeRemaining": 245,
    "totalTime": 300
  },
  "timestamp": "2026-01-09T10:00:55.000Z"
}
```

**Notes**: 
- Final `timer_update` will have `timeRemaining: 0`
- After timer expires, no more timer updates for that question

---

### 2.4 question_change

**Trigger**: Transition between questions  
**Audience**: All contest participants  
**Frequency**: Multiple times per contest (between questions)

**Payload**:
```json
{
  "event": "question_change",
  "data": {
    "previousQuestionId": "uuid",
    "nextQuestionId": "uuid | null",
    "timeUntilNext": "number (seconds)",
    "message": "string"
  },
  "timestamp": "ISO 8601 timestamp"
}
```

**Required Fields**: `previousQuestionId`, `nextQuestionId`, `timeUntilNext`

**Optional Fields**: `message`

**Example (Moving to next question)**:
```json
{
  "event": "question_change",
  "data": {
    "previousQuestionId": "q1-uuid",
    "nextQuestionId": "q2-uuid",
    "timeUntilNext": 5,
    "message": "Next question in 5 seconds..."
  },
  "timestamp": "2026-01-09T10:05:00.000Z"
}
```

**Example (No more questions)**:
```json
{
  "event": "question_change",
  "data": {
    "previousQuestionId": "q10-uuid",
    "nextQuestionId": null,
    "timeUntilNext": 0,
    "message": "Contest ending..."
  },
  "timestamp": "2026-01-09T11:00:00.000Z"
}
```

---

### 2.5 submission_result

**Trigger**: User submits answer, server validates  
**Audience**: Individual user (unicast)  
**Frequency**: Once per user per question

**Payload**:
```json
{
  "event": "submission_result",
  "data": {
    "submissionId": "uuid",
    "questionId": "uuid",
    "isCorrect": "boolean",
    "pointsEarned": "number",
    "timeTaken": "number (seconds)",
    "submittedAt": "ISO 8601 timestamp",
    "currentScore": "number",
    "currentRank": "number"
  },
  "timestamp": "ISO 8601 timestamp"
}
```

**Required Fields**: All fields are required

**Example (Correct Answer)**:
```json
{
  "event": "submission_result",
  "data": {
    "submissionId": "sub1-uuid",
    "questionId": "q1-uuid",
    "isCorrect": true,
    "pointsEarned": 100,
    "timeTaken": 45,
    "submittedAt": "2026-01-09T10:00:45.000Z",
    "currentScore": 100,
    "currentRank": 12
  },
  "timestamp": "2026-01-09T10:00:45.123Z"
}
```

**Example (Wrong Answer)**:
```json
{
  "event": "submission_result",
  "data": {
    "submissionId": "sub2-uuid",
    "questionId": "q2-uuid",
    "isCorrect": false,
    "pointsEarned": 0,
    "timeTaken": 120,
    "submittedAt": "2026-01-09T10:07:00.000Z",
    "currentScore": 100,
    "currentRank": 15
  },
  "timestamp": "2026-01-09T10:07:00.234Z"
}
```

---

### 2.6 leaderboard_update

**Trigger**: Leaderboard recalculation (batched updates)  
**Audience**: All contest participants (broadcast)  
**Frequency**: Medium (every 5-10 seconds or after significant changes)

**Payload**:
```json
{
  "event": "leaderboard_update",
  "data": {
    "contestId": "uuid",
    "topN": [
      {
        "rank": "number",
        "userId": "uuid",
        "userName": "string",
        "score": "number",
        "questionsAnswered": "number"
      }
    ],
    "userEntry": {
      "rank": "number",
      "userId": "uuid",
      "userName": "string",
      "score": "number",
      "questionsAnswered": "number"
    },
    "totalParticipants": "number"
  },
  "timestamp": "ISO 8601 timestamp"
}
```

**Required Fields**: `contestId`, `topN`, `totalParticipants`

**Optional Fields**: `userEntry` (null if user not in contest)

**Example**:
```json
{
  "event": "leaderboard_update",
  "data": {
    "contestId": "contest-uuid",
    "topN": [
      {
        "rank": 1,
        "userId": "user1-uuid",
        "userName": "Alice",
        "score": 950,
        "questionsAnswered": 10
      },
      {
        "rank": 2,
        "userId": "user2-uuid",
        "userName": "Bob",
        "score": 920,
        "questionsAnswered": 9
      },
      {
        "rank": 3,
        "userId": "user3-uuid",
        "userName": "Charlie",
        "score": 900,
        "questionsAnswered": 9
      }
    ],
    "userEntry": {
      "rank": 15,
      "userId": "current-user-uuid",
      "userName": "CurrentUser",
      "score": 650,
      "questionsAnswered": 7
    },
    "totalParticipants": 142
  },
  "timestamp": "2026-01-09T10:15:30.000Z"
}
```

**Notes**:
- `topN` typically contains top 10-20 users
- Updates are batched to avoid overwhelming clients
- `userEntry` always included so user knows their position

---

### 2.7 contest_end

**Trigger**: Contest transitions to COMPLETED  
**Audience**: All contest participants (broadcast)  
**Frequency**: Once per contest

**Payload**:
```json
{
  "event": "contest_end",
  "data": {
    "contestId": "uuid",
    "title": "string",
    "endTime": "ISO 8601 timestamp",
    "finalLeaderboard": [
      {
        "rank": "number",
        "userId": "uuid",
        "userName": "string",
        "score": "number",
        "questionsAnswered": "number"
      }
    ],
    "userFinalRank": {
      "rank": "number",
      "score": "number",
      "questionsAnswered": "number"
    },
    "totalParticipants": "number"
  },
  "timestamp": "ISO 8601 timestamp"
}
```

**Required Fields**: All fields are required

**Example**:
```json
{
  "event": "contest_end",
  "data": {
    "contestId": "contest-uuid",
    "title": "Weekly Contest #42",
    "endTime": "2026-01-09T11:00:00.000Z",
    "finalLeaderboard": [
      {
        "rank": 1,
        "userId": "user1-uuid",
        "userName": "Alice",
        "score": 1200,
        "questionsAnswered": 10
      },
      {
        "rank": 2,
        "userId": "user2-uuid",
        "userName": "Bob",
        "score": 1150,
        "questionsAnswered": 10
      }
    ],
    "userFinalRank": {
      "rank": 15,
      "score": 850,
      "questionsAnswered": 8
    },
    "totalParticipants": 142
  },
  "timestamp": "2026-01-09T11:00:00.000Z"
}
```

**Post-Event**: Server closes WebSocket connection gracefully (code 1000)

---

### 2.8 error

**Trigger**: Invalid client action or server error  
**Audience**: Individual user (unicast)  
**Frequency**: As needed

**Payload**:
```json
{
  "event": "error",
  "data": {
    "code": "string",
    "message": "string",
    "details": "object | null"
  },
  "timestamp": "ISO 8601 timestamp"
}
```

**Error Codes**:
- `INVALID_EVENT` - Unrecognized event type
- `CONTEST_NOT_FOUND` - Contest ID doesn't exist
- `CONTEST_NOT_ACTIVE` - Contest not in ACTIVE state
- `NOT_PARTICIPANT` - User not registered for contest
- `ALREADY_SUBMITTED` - Answer already submitted for question
- `INVALID_QUESTION` - Question not part of contest
- `INVALID_OPTION` - MCQ option ID invalid
- `TIME_EXPIRED` - Submission after timer expired
- `SERVER_ERROR` - Internal server error

**Example**:
```json
{
  "event": "error",
  "data": {
    "code": "ALREADY_SUBMITTED",
    "message": "You have already submitted an answer for this question",
    "details": {
      "questionId": "q1-uuid",
      "previousSubmissionId": "sub1-uuid"
    }
  },
  "timestamp": "2026-01-09T10:05:30.000Z"
}
```

---

## 3. Client → Server Events

### 3.1 join_contest

**Purpose**: Register client for contest events  
**Timing**: Must be sent within 5 seconds of connection  
**Frequency**: Once per connection

**Payload**:
```json
{
  "event": "join_contest",
  "data": {
    "contestId": "uuid"
  }
}
```

**Required Fields**: `contestId`

**Server Validation**:
- Contest exists
- Contest is UPCOMING or ACTIVE
- User is registered participant (via REST API)
- User not already connected from another client

**Server Response**:
- Success: No explicit ACK, events start flowing
- Failure: `error` event with appropriate code, connection may close

**Example**:
```json
{
  "event": "join_contest",
  "data": {
    "contestId": "contest-uuid"
  }
}
```

---

### 3.2 submit_answer

**Purpose**: Submit answer for current active question  
**Timing**: During active question timer  
**Frequency**: Once per question

**Payload**:
```json
{
  "event": "submit_answer",
  "data": {
    "questionId": "uuid",
    "selectedOptionId": "uuid | null",
    "submittedAt": "ISO 8601 timestamp"
  }
}
```

**Required Fields**: `questionId`, `submittedAt`

**Optional Fields**: `selectedOptionId` (required for MCQ, null for DSA/SANDBOX)

**Server Validation**:
- Question belongs to current contest
- Question is currently active for user
- Timer not expired
- User hasn't already submitted for this question
- For MCQ: selectedOptionId is valid option for question

**Server Response**: `submission_result` event

**Example (MCQ)**:
```json
{
  "event": "submit_answer",
  "data": {
    "questionId": "q1-uuid",
    "selectedOptionId": "opt2-uuid",
    "submittedAt": "2026-01-09T10:00:45.000Z"
  }
}
```

**Example (DSA/SANDBOX - future)**:
```json
{
  "event": "submit_answer",
  "data": {
    "questionId": "q1-uuid",
    "selectedOptionId": null,
    "submittedAt": "2026-01-09T10:00:45.000Z"
  }
}
```

---

### 3.3 resync

**Purpose**: Request current contest state (on reconnection)  
**Timing**: Immediately after reconnection  
**Frequency**: Once per reconnection

**Payload**:
```json
{
  "event": "resync",
  "data": {
    "contestId": "uuid",
    "lastEventTimestamp": "ISO 8601 timestamp | null"
  }
}
```

**Required Fields**: `contestId`

**Optional Fields**: `lastEventTimestamp` (last event client received before disconnect)

**Server Response** (state snapshot):
1. Current contest status
2. If contest ACTIVE:
   - Current `question_broadcast`
   - Current `timer_update`
   - Latest `leaderboard_update`
3. If contest COMPLETED:
   - `contest_end` event

**Example**:
```json
{
  "event": "resync",
  "data": {
    "contestId": "contest-uuid",
    "lastEventTimestamp": "2026-01-09T10:15:23.456Z"
  }
}
```

---

### 3.4 heartbeat (ping)

**Purpose**: Keep connection alive, detect disconnections  
**Timing**: Every 30 seconds when idle  
**Frequency**: Low (0.033 Hz)

**Payload**:
```json
{
  "event": "ping",
  "data": {}
}
```

**Server Response**:
```json
{
  "event": "pong",
  "data": {},
  "timestamp": "ISO 8601 timestamp"
}
```

**Notes**:
- Optional, can use WebSocket native ping/pong frames instead
- If no ping received for 60 seconds, server may close connection

---

## 4. Event Flow Timeline

### 4.1 Contest Lifecycle

```
PRE-CONTEST
│
├─ Client connects with JWT
├─ Client: join_contest
├─ Server validates & adds to room
│
CONTEST START (T=0)
│
├─ Server: contest_start (broadcast)
├─ Server: question_broadcast #1 (broadcast)
├─ Server: timer_update (every 1s)
│
QUESTION ACTIVE (T=0 to T+300)
│
├─ Client: submit_answer
├─ Server: submission_result (unicast)
├─ Server: leaderboard_update (broadcast, batched)
├─ Timer continues...
│
QUESTION TRANSITION (T+300)
│
├─ Server: question_change (broadcast)
├─ Wait 5 seconds...
├─ Server: question_broadcast #2 (broadcast)
├─ Repeat for all questions...
│
LAST QUESTION COMPLETE
│
├─ Server: question_change (nextQuestionId: null)
├─ Server: contest_end (broadcast)
├─ Server closes WebSocket (code 1000)
```

### 4.2 Detailed Question Flow

```
QUESTION START
│
├─ Server → All: question_broadcast
│   ├─ Question details
│   ├─ Options (if MCQ)
│   ├─ Timer starts
│
├─ Server → All: timer_update (t=299)
├─ Server → All: timer_update (t=298)
│   ... every second ...
│
USER A SUBMITS (t=45)
│
├─ Client A → Server: submit_answer
├─ Server validates answer
├─ Server → Client A: submission_result
│   ├─ isCorrect: true
│   ├─ pointsEarned: 100
│   ├─ currentRank: 12
│
LEADERBOARD UPDATE (batched, t=50)
│
├─ Server → All: leaderboard_update
│   ├─ Top 20 users
│   ├─ Each user's rank
│
USER B SUBMITS (t=120)
│
├─ Client B → Server: submit_answer
├─ Server validates answer
├─ Server → Client B: submission_result
│   ├─ isCorrect: false
│   ├─ pointsEarned: 0
│
TIMER EXPIRES (t=0)
│
├─ Server → All: timer_update (timeRemaining: 0)
├─ Server → All: question_change
│   ├─ previousQuestionId: q1
│   ├─ nextQuestionId: q2
│   ├─ timeUntilNext: 5
│
NEXT QUESTION
```

### 4.3 Reconnection Flow

```
CLIENT DISCONNECTS
│
├─ Network issue / browser close
├─ Server detects disconnect
├─ Server keeps user state for 5 minutes
│
CLIENT RECONNECTS
│
├─ Client connects with JWT
├─ Connection accepted
│
├─ Client → Server: resync
│   ├─ contestId
│   ├─ lastEventTimestamp
│
├─ Server determines current state
│
├─ Server → Client: Current snapshot
│   ├─ question_broadcast (current Q)
│   ├─ timer_update (current time)
│   ├─ leaderboard_update (latest)
│
NORMAL FLOW RESUMES
```

### 4.4 Error Scenarios

```
INVALID SUBMISSION
│
├─ Client → Server: submit_answer
│   ├─ questionId: q5 (not current)
│
├─ Server validates
├─ Server → Client: error
│   ├─ code: INVALID_QUESTION
│   ├─ message: "Question not active"
│
DOUBLE SUBMISSION
│
├─ Client → Server: submit_answer (q1)
├─ Server → Client: submission_result
│
├─ Client → Server: submit_answer (q1 again)
├─ Server → Client: error
│   ├─ code: ALREADY_SUBMITTED
│   ├─ message: "Already submitted"
│
EXPIRED TIMER
│
├─ Timer expires (timeRemaining: 0)
├─ Client → Server: submit_answer (late)
├─ Server → Client: error
│   ├─ code: TIME_EXPIRED
│   ├─ message: "Time limit exceeded"
```

---

## 5. Protocol Design Principles

### 5.1 Message Format Standard

All messages follow this structure:
```json
{
  "event": "string",
  "data": {},
  "timestamp": "ISO 8601 timestamp"
}
```

- `event`: Event type identifier (required)
- `data`: Event-specific payload (required, can be empty object)
- `timestamp`: Server-side timestamp for event ordering (required for server→client)

### 5.2 Reliability & Ordering

- **Ordering**: Events are delivered in order per connection
- **Idempotency**: Clients should handle duplicate events gracefully
- **State Recovery**: `resync` event provides full state snapshot
- **Buffering**: Server buffers events for 5 minutes during disconnect

### 5.3 Performance Considerations

- **Timer Updates**: High frequency (1 Hz), clients should throttle UI updates
- **Leaderboard Updates**: Batched every 5-10 seconds, not per submission
- **Reconnection**: State snapshot sent immediately, minimal catchup needed
- **Broadcast Optimization**: Use room-based broadcasting for efficiency

### 5.4 Security Considerations

- **Authentication**: JWT validated on connection, carried through session
- **Authorization**: Every event validates user permissions
- **Rate Limiting**: Clients limited to reasonable event rates (e.g., 10/sec)
- **Validation**: All client inputs validated server-side
- **Isolation**: Users only receive their own submission results

### 5.5 Error Handling

- **Graceful Degradation**: Errors don't terminate connection (except auth)
- **Clear Messages**: Error codes and messages help debugging
- **Client Recovery**: Clients can resync on confusion
- **Logging**: All errors logged server-side for monitoring

---

## 6. Implementation Checklist

### Frontend Team
- [ ] Implement WebSocket client with JWT authentication
- [ ] Handle all Server→Client events
- [ ] Implement all Client→Server events
- [ ] Handle reconnection logic with resync
- [ ] Implement timer UI with local countdown + server sync
- [ ] Implement real-time leaderboard updates
- [ ] Handle error events gracefully
- [ ] Test connection lifecycle edge cases

### Backend Team
- [ ] Implement WebSocket server (ws/socket.io)
- [ ] Implement JWT authentication on connection
- [ ] Implement room-based broadcasting per contest
- [ ] Implement all event handlers
- [ ] Integrate with Prisma for contest/question data
- [ ] Integrate with Redis for leaderboard
- [ ] Implement timer management system
- [ ] Implement state management for reconnections
- [ ] Add comprehensive error handling
- [ ] Add rate limiting and security measures

---

## 7. Future Extensions

**Not in v1.0, but protocol-compatible**:

- **Code Execution**: For DSA/SANDBOX questions
  - Add `code` field to `submit_answer`
  - Add execution result fields to `submission_result`

- **Partial Leaderboard**: Clients request specific rank ranges

- **Question Hints**: Real-time hint unlocks during questions

- **Team Contests**: Multi-user collaboration events

- **Spectator Mode**: Read-only connections for non-participants

---

**End of Protocol Specification**
