# Backend Testing Checklist
## Real-Time Contest Platform - Full End-to-End Verification

**Version**: 1.0  
**Last Updated**: January 9, 2026  
**Server**: http://localhost:3000  
**WebSocket**: ws://localhost:3000/ws/contest

---

## Prerequisites

### Required Tools
```bash
# Install wscat for WebSocket testing
npm install -g wscat

# Install redis-cli (macOS)
brew install redis

# PostgreSQL client should be available
psql --version

# curl should be pre-installed on macOS
curl --version
```

### Environment Setup
```bash
# Start backend server
cd /Users/abdul/projects/week3/backend
bun run start

# Verify Redis is running
redis-cli ping
# Expected: PONG

# Verify PostgreSQL is accessible
psql $DATABASE_URL -c "SELECT 1;"
# Expected: 1 row returned
```

---

## 1️⃣ REST API TESTS (curl)

### Test 1.1: Signup
```bash
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "testuser@example.com",
    "password": "password123"
  }'
```
**Expected Status**: `201 Created`  
**Expected Response**:
```json
{
  "message": "User created successfully",
  "user": {
    "id": "uuid",
    "name": "Test User",
    "email": "testuser@example.com",
    "role": "USER",
    "createdAt": "ISO-8601-timestamp"
  },
  "token": "jwt-token-string"
}
```
**Save**: Copy `token` value for subsequent tests → `$TOKEN`

---

### Test 1.2: Signup with Invalid Email
```bash
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "invalid-email",
    "password": "password123"
  }'
```
**Expected Status**: `400 Bad Request`  
**Expected Response**:
```json
{
  "error": "Invalid email format"
}
```

---

### Test 1.3: Signup with Short Password
```bash
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "testuser2@example.com",
    "password": "123"
  }'
```
**Expected Status**: `400 Bad Request`  
**Expected Response**:
```json
{
  "error": "Password must be at least 6 characters"
}
```

---

### Test 1.4: Signin
```bash
curl -X POST http://localhost:3000/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "password123"
  }'
```
**Expected Status**: `200 OK`  
**Expected Response**:
```json
{
  "message": "Signin successful",
  "user": {
    "id": "uuid",
    "name": "Mock User",
    "email": "testuser@example.com",
    "role": "USER"
  },
  "token": "jwt-token-string"
}
```

---

### Test 1.5: Get All Contests
```bash
curl -X GET http://localhost:3000/contests
```
**Expected Status**: `200 OK`  
**Expected Response**:
```json
[]
```
or
```json
[
  {
    "id": "uuid",
    "title": "string",
    "description": "string",
    "startAt": "ISO-8601-timestamp",
    "endAt": "ISO-8601-timestamp",
    "status": "UPCOMING" | "ACTIVE" | "COMPLETED"
  }
]
```

---

### Test 1.6: Get Contest Details
```bash
curl -X GET http://localhost:3000/contest/{contestId}
```
Replace `{contestId}` with actual contest ID from Test 1.5

**Expected Status**: `200 OK`  
**Expected Response**:
```json
{
  "id": "uuid",
  "title": "string",
  "description": "string",
  "startAt": "ISO-8601-timestamp",
  "endAt": "ISO-8601-timestamp",
  "status": "UPCOMING",
  "questions": [
    {
      "id": "uuid",
      "title": "string",
      "orderIndex": 0,
      "points": 100,
      "timeLimit": 300
    }
  ]
}
```

---

### Test 1.7: Join Contest
```bash
curl -X POST http://localhost:3000/contest/{contestId}/join \
  -H "Authorization: Bearer $TOKEN"
```
Replace `{contestId}` with actual contest ID

**Expected Status**: `200 OK`  
**Expected Response**:
```json
{
  "message": "Successfully joined contest"
}
```

---

### Test 1.8: Join Contest Without Token
```bash
curl -X POST http://localhost:3000/contest/{contestId}/join
```
**Expected Status**: `401 Unauthorized`

---

### Test 1.9: Get Leaderboard
```bash
curl -X GET http://localhost:3000/leaderboard/{contestId}
```
Replace `{contestId}` with actual contest ID

**Expected Status**: `200 OK`  
**Expected Response**:
```json
[
  {
    "rank": 1,
    "user": {
      "id": "uuid",
      "name": "string"
    },
    "score": 950
  }
]
```
or empty array if contest not completed

---

## 2️⃣ WEBSOCKET TESTS

### Test 2.1: Connection with Valid JWT
```bash
wscat -c "ws://localhost:3000/ws/contest?token=$TOKEN"
```
**Expected**: Connection established  
**Connection Output**: `Connected`

---

### Test 2.2: Connection without JWT
```bash
wscat -c "ws://localhost:3000/ws/contest"
```
**Expected**: Connection rejected  
**Expected Output**: `HTTP/1.1 401 Unauthorized`  
**Connection**: Closed immediately

---

### Test 2.3: Connection with Invalid JWT
```bash
wscat -c "ws://localhost:3000/ws/contest?token=invalid.jwt.token"
```
**Expected**: Connection rejected  
**Expected Output**: `HTTP/1.1 401 Unauthorized`  
**Connection**: Closed immediately

---

### Test 2.4: Join Contest Event
**After successful connection from Test 2.1, send:**
```json
{
  "event": "join_contest",
  "data": {
    "contestId": "{contestId}"
  }
}
```
Replace `{contestId}` with actual contest ID (must be UPCOMING or ACTIVE)

**Expected Response**: No explicit ACK, but no error event  
**Server Logs**: Should show "User {userId} joined contest {contestId}"

---

### Test 2.5: Join Non-Existent Contest
```json
{
  "event": "join_contest",
  "data": {
    "contestId": "non-existent-uuid"
  }
}
```
**Expected Response**:
```json
{
  "event": "error",
  "data": {
    "code": "CONTEST_NOT_FOUND",
    "message": "Contest not found",
    "details": null
  },
  "timestamp": "ISO-8601-timestamp"
}
```
**Connection**: Closed with code 1000

---

### Test 2.6: Join Contest Without Participation
Join a contest that user hasn't registered for via REST API

```json
{
  "event": "join_contest",
  "data": {
    "contestId": "{contestId}"
  }
}
```
**Expected Response**:
```json
{
  "event": "error",
  "data": {
    "code": "NOT_PARTICIPANT",
    "message": "User not registered for contest",
    "details": null
  },
  "timestamp": "ISO-8601-timestamp"
}
```
**Connection**: Closed with code 1000

---

### Test 2.7: Receive Question Broadcast
**Prerequisite**: Contest must be ACTIVE

**Expected Server Broadcast**:
```json
{
  "event": "question_broadcast",
  "data": {
    "questionId": "uuid",
    "contestQuestionId": "uuid",
    "type": "MCQ",
    "title": "What is the time complexity of binary search?",
    "description": "Select the correct answer.",
    "mcqOptions": [
      {
        "id": "uuid",
        "text": "O(n)"
      },
      {
        "id": "uuid",
        "text": "O(log n)"
      },
      {
        "id": "uuid",
        "text": "O(n log n)"
      },
      {
        "id": "uuid",
        "text": "O(1)"
      }
    ],
    "timeLimit": 300,
    "points": 100,
    "questionNumber": 1,
    "totalQuestions": 10,
    "startedAt": "ISO-8601-timestamp"
  },
  "timestamp": "ISO-8601-timestamp"
}
```

---

### Test 2.8: Receive Timer Updates
**Prerequisite**: Active question

**Expected Server Broadcasts** (every 1 second):
```json
{
  "event": "timer_update",
  "data": {
    "questionId": "uuid",
    "timeRemaining": 299,
    "totalTime": 300
  },
  "timestamp": "ISO-8601-timestamp"
}
```
Then `timeRemaining: 298`, `297`, ... down to `0`

---

### Test 2.9: Submit Correct Answer
**Prerequisite**: Active question with MCQ options

```json
{
  "event": "submit_answer",
  "data": {
    "questionId": "{questionId}",
    "selectedOptionId": "{correctOptionId}",
    "submittedAt": "2026-01-09T10:00:45.000Z"
  }
}
```
Replace `{questionId}` and `{correctOptionId}` with actual values

**Expected Response**:
```json
{
  "event": "submission_result",
  "data": {
    "submissionId": "uuid",
    "questionId": "{questionId}",
    "isCorrect": true,
    "pointsEarned": 100,
    "timeTaken": 45,
    "submittedAt": "2026-01-09T10:00:45.000Z",
    "currentScore": 100,
    "currentRank": 1
  },
  "timestamp": "ISO-8601-timestamp"
}
```

---

### Test 2.10: Submit Incorrect Answer
```json
{
  "event": "submit_answer",
  "data": {
    "questionId": "{questionId}",
    "selectedOptionId": "{wrongOptionId}",
    "submittedAt": "2026-01-09T10:01:30.000Z"
  }
}
```
**Expected Response**:
```json
{
  "event": "submission_result",
  "data": {
    "submissionId": "uuid",
    "questionId": "{questionId}",
    "isCorrect": false,
    "pointsEarned": 0,
    "timeTaken": 90,
    "submittedAt": "2026-01-09T10:01:30.000Z",
    "currentScore": 0,
    "currentRank": 50
  },
  "timestamp": "ISO-8601-timestamp"
}
```

---

### Test 2.11: Receive Leaderboard Update
**Expected Server Broadcast** (after submissions, batched every 5-10 seconds):
```json
{
  "event": "leaderboard_update",
  "data": {
    "contestId": "uuid",
    "topN": [
      {
        "rank": 1,
        "userId": "uuid",
        "userName": "Alice",
        "score": 950,
        "questionsAnswered": 10
      },
      {
        "rank": 2,
        "userId": "uuid",
        "userName": "Bob",
        "score": 920,
        "questionsAnswered": 9
      }
    ],
    "userEntry": {
      "rank": 15,
      "userId": "uuid",
      "userName": "Test User",
      "score": 650,
      "questionsAnswered": 7
    },
    "totalParticipants": 142
  },
  "timestamp": "ISO-8601-timestamp"
}
```

---

### Test 2.12: Receive Contest End
**Expected Server Broadcast** (when contest completes):
```json
{
  "event": "contest_end",
  "data": {
    "contestId": "uuid",
    "title": "Weekly Contest #42",
    "endTime": "ISO-8601-timestamp",
    "finalLeaderboard": [
      {
        "rank": 1,
        "userId": "uuid",
        "userName": "Alice",
        "score": 1200,
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
  "timestamp": "ISO-8601-timestamp"
}
```
**Connection**: Server closes with code 1000 after this event

---

### Test 2.13: Ping/Pong Heartbeat
```json
{
  "event": "ping",
  "data": {}
}
```
**Expected Response**:
```json
{
  "event": "pong",
  "data": {},
  "timestamp": "ISO-8601-timestamp"
}
```

---

### Test 2.14: Resync After Reconnect
**Scenario**: Disconnect and reconnect during active contest

```bash
# Disconnect (Ctrl+C in wscat)
# Reconnect
wscat -c "ws://localhost:3000/ws/contest?token=$TOKEN"

# Send resync
{
  "event": "resync",
  "data": {
    "contestId": "{contestId}",
    "lastEventTimestamp": "2026-01-09T10:15:23.456Z"
  }
}
```
**Expected Responses** (state snapshot):
1. Current `question_broadcast` (if contest ACTIVE)
2. Current `timer_update`
3. Latest `leaderboard_update`

---

## 3️⃣ SUBMISSION VALIDATION TESTS

### Test 3.1: Correct Submission
**Input**:
```json
{
  "event": "submit_answer",
  "data": {
    "questionId": "q1-uuid",
    "selectedOptionId": "correct-option-uuid",
    "submittedAt": "2026-01-09T10:00:45.000Z"
  }
}
```
**Expected WebSocket Response**:
```json
{
  "event": "submission_result",
  "data": {
    "submissionId": "uuid",
    "questionId": "q1-uuid",
    "isCorrect": true,
    "pointsEarned": 100,
    "timeTaken": 45,
    "submittedAt": "2026-01-09T10:00:45.000Z",
    "currentScore": 100,
    "currentRank": 1
  },
  "timestamp": "ISO-8601-timestamp"
}
```
**Expected Redis Change**:
```bash
redis-cli ZSCORE "leaderboard:{contestId}" "{userId}"
# Expected: 100 (or updated total score)
```
**Expected DB Write**:
```sql
SELECT * FROM "Submission" 
WHERE "userId" = '{userId}' 
  AND "contestId" = '{contestId}' 
  AND "questionId" = 'q1-uuid';
```
Expected: 1 row with `isCorrect = true`

---

### Test 3.2: Incorrect Submission
**Input**:
```json
{
  "event": "submit_answer",
  "data": {
    "questionId": "q1-uuid",
    "selectedOptionId": "wrong-option-uuid",
    "submittedAt": "2026-01-09T10:01:20.000Z"
  }
}
```
**Expected WebSocket Response**:
```json
{
  "event": "submission_result",
  "data": {
    "submissionId": "uuid",
    "questionId": "q1-uuid",
    "isCorrect": false,
    "pointsEarned": 0,
    "timeTaken": 80,
    "submittedAt": "2026-01-09T10:01:20.000Z",
    "currentScore": 0,
    "currentRank": 50
  },
  "timestamp": "ISO-8601-timestamp"
}
```
**Expected Redis Change**:
```bash
redis-cli ZSCORE "leaderboard:{contestId}" "{userId}"
# Expected: 0 (no score change)
```
**Expected DB Write**:
```sql
SELECT * FROM "Submission" 
WHERE "userId" = '{userId}' 
  AND "contestId" = '{contestId}' 
  AND "questionId" = 'q1-uuid';
```
Expected: 1 row with `isCorrect = false`

---

### Test 3.3: Duplicate Submission
**First Submission**:
```json
{
  "event": "submit_answer",
  "data": {
    "questionId": "q1-uuid",
    "selectedOptionId": "option-uuid",
    "submittedAt": "2026-01-09T10:00:45.000Z"
  }
}
```
**Second Submission** (same question):
```json
{
  "event": "submit_answer",
  "data": {
    "questionId": "q1-uuid",
    "selectedOptionId": "option-uuid",
    "submittedAt": "2026-01-09T10:01:00.000Z"
  }
}
```
**Expected WebSocket Response**:
```json
{
  "event": "error",
  "data": {
    "code": "ALREADY_SUBMITTED",
    "message": "Already submitted for this question",
    "details": {
      "questionId": "q1-uuid"
    }
  },
  "timestamp": "ISO-8601-timestamp"
}
```
**Expected Redis Change**: No change  
**Expected DB Write**: No new submission (only 1 row exists)

---

### Test 3.4: Late Submission (After Timer Expired)
**Scenario**: Submit after `timer_update` shows `timeRemaining: 0`

**Input**:
```json
{
  "event": "submit_answer",
  "data": {
    "questionId": "q1-uuid",
    "selectedOptionId": "option-uuid",
    "submittedAt": "2026-01-09T10:05:01.000Z"
  }
}
```
**Expected WebSocket Response**:
```json
{
  "event": "error",
  "data": {
    "code": "TIME_EXPIRED",
    "message": "Time limit exceeded",
    "details": null
  },
  "timestamp": "ISO-8601-timestamp"
}
```
**Expected Redis Change**: No change  
**Expected DB Write**: No submission created (rejected)

---

### Test 3.5: Submission After Contest End
**Scenario**: Contest status is COMPLETED

**Input**:
```json
{
  "event": "submit_answer",
  "data": {
    "questionId": "q1-uuid",
    "selectedOptionId": "option-uuid",
    "submittedAt": "2026-01-09T11:30:00.000Z"
  }
}
```
**Expected WebSocket Response**:
```json
{
  "event": "error",
  "data": {
    "code": "CONTEST_NOT_ACTIVE",
    "message": "Contest is not active",
    "details": null
  },
  "timestamp": "ISO-8601-timestamp"
}
```
**Expected Redis Change**: No change  
**Expected DB Write**: No submission created (rejected)

---

### Test 3.6: Submit with Invalid Question ID
**Input**:
```json
{
  "event": "submit_answer",
  "data": {
    "questionId": "non-existent-uuid",
    "selectedOptionId": "option-uuid",
    "submittedAt": "2026-01-09T10:00:45.000Z"
  }
}
```
**Expected WebSocket Response**:
```json
{
  "event": "error",
  "data": {
    "code": "INVALID_QUESTION",
    "message": "Invalid question",
    "details": null
  },
  "timestamp": "ISO-8601-timestamp"
}
```
**Expected Redis Change**: No change  
**Expected DB Write**: No submission created

---

### Test 3.7: Submit with Invalid Option ID
**Input**:
```json
{
  "event": "submit_answer",
  "data": {
    "questionId": "q1-uuid",
    "selectedOptionId": "non-existent-option-uuid",
    "submittedAt": "2026-01-09T10:00:45.000Z"
  }
}
```
**Expected WebSocket Response**:
```json
{
  "event": "error",
  "data": {
    "code": "INVALID_OPTION",
    "message": "Invalid option",
    "details": null
  },
  "timestamp": "ISO-8601-timestamp"
}
```
**Expected Redis Change**: No change  
**Expected DB Write**: No submission created

---

## 4️⃣ REDIS STATE VERIFICATION

### Test 4.1: Inspect Leaderboard Sorted Set
```bash
redis-cli ZREVRANGE "leaderboard:{contestId}" 0 -1 WITHSCORES
```
**Expected Output**:
```
1) "userId1"
2) "950"
3) "userId2"
4) "920"
5) "userId3"
6) "900"
```
Users ordered by score (descending)

---

### Test 4.2: Get User Rank
```bash
redis-cli ZREVRANK "leaderboard:{contestId}" "{userId}"
```
**Expected Output**: Rank number (0-indexed, 0 = 1st place)

---

### Test 4.3: Get User Score
```bash
redis-cli ZSCORE "leaderboard:{contestId}" "{userId}"
```
**Expected Output**: Score value as string (e.g., `"850"`)

---

### Test 4.4: Get Total Participants
```bash
redis-cli ZCARD "leaderboard:{contestId}"
```
**Expected Output**: Number of participants (e.g., `142`)

---

### Test 4.5: Get Top N Entries
```bash
redis-cli ZREVRANGE "leaderboard:{contestId}" 0 19 WITHSCORES
```
**Expected Output**: Top 20 users with scores

---

### Test 4.6: Verify Leaderboard Exists
```bash
redis-cli EXISTS "leaderboard:{contestId}"
```
**Expected Output**: `1` (exists) or `0` (doesn't exist)

---

### Test 4.7: List All Leaderboard Keys
```bash
redis-cli KEYS "leaderboard:*"
```
**Expected Output**: List of all contest leaderboard keys

---

### Test 4.8: Check Score After Correct Answer
**Steps**:
1. Note initial score: `redis-cli ZSCORE "leaderboard:{contestId}" "{userId}"`
2. Submit correct answer (100 points)
3. Check updated score: `redis-cli ZSCORE "leaderboard:{contestId}" "{userId}"`

**Expected**: Score increased by 100

---

### Test 4.9: Check Score After Wrong Answer
**Steps**:
1. Note initial score: `redis-cli ZSCORE "leaderboard:{contestId}" "{userId}"`
2. Submit wrong answer (0 points)
3. Check updated score: `redis-cli ZSCORE "leaderboard:{contestId}" "{userId}"`

**Expected**: Score unchanged

---

### Test 4.10: Verify Rank Changes
**Steps**:
1. Note initial rank: `redis-cli ZREVRANK "leaderboard:{contestId}" "{userId}"`
2. Submit correct answer
3. Check updated rank: `redis-cli ZREVRANK "leaderboard:{contestId}" "{userId}"`

**Expected**: Rank improved (lower number) if score increased enough

---

## 5️⃣ DATABASE VERIFICATION (PostgreSQL)

Replace `$DATABASE_URL` with your actual PostgreSQL connection string.

### Test 5.1: Verify Submission Created
```bash
psql $DATABASE_URL -c "
SELECT id, \"userId\", \"contestId\", \"questionId\", \"isCorrect\", \"submittedAt\"
FROM \"Submission\"
WHERE \"userId\" = '{userId}'
  AND \"contestId\" = '{contestId}'
  AND \"questionId\" = '{questionId}'
ORDER BY \"submittedAt\" DESC
LIMIT 1;
"
```
**Expected**: 1 row with matching data

---

### Test 5.2: Verify No Duplicate Submissions
```bash
psql $DATABASE_URL -c "
SELECT COUNT(*) as count
FROM \"Submission\"
WHERE \"userId\" = '{userId}'
  AND \"contestId\" = '{contestId}'
  AND \"questionId\" = '{questionId}';
"
```
**Expected**: `count = 1` (unique constraint enforced)

---

### Test 5.3: Verify Contest Participant Record
```bash
psql $DATABASE_URL -c "
SELECT id, \"contestId\", \"userId\", \"joinedAt\"
FROM \"ContestParticipant\"
WHERE \"userId\" = '{userId}'
  AND \"contestId\" = '{contestId}';
"
```
**Expected**: 1 row created when user joined contest

---

### Test 5.4: Count User Submissions in Contest
```bash
psql $DATABASE_URL -c "
SELECT COUNT(*) as total_submissions
FROM \"Submission\"
WHERE \"userId\" = '{userId}'
  AND \"contestId\" = '{contestId}';
"
```
**Expected**: Number matches questions answered

---

### Test 5.5: Count Correct Submissions
```bash
psql $DATABASE_URL -c "
SELECT COUNT(*) as correct_count
FROM \"Submission\"
WHERE \"userId\" = '{userId}'
  AND \"contestId\" = '{contestId}'
  AND \"isCorrect\" = true;
"
```
**Expected**: Number of correct answers

---

### Test 5.6: Verify LeaderboardSnapshot Created
```bash
psql $DATABASE_URL -c "
SELECT id, \"contestId\", \"userId\", score, rank
FROM \"LeaderboardSnapshot\"
WHERE \"userId\" = '{userId}'
  AND \"contestId\" = '{contestId}';
"
```
**Expected**: 1 row with final score and rank (persisted after contest ends)

---

### Test 5.7: Verify All Participants Have Snapshots
```bash
psql $DATABASE_URL -c "
SELECT 
  (SELECT COUNT(*) FROM \"ContestParticipant\" WHERE \"contestId\" = '{contestId}') as participants,
  (SELECT COUNT(*) FROM \"LeaderboardSnapshot\" WHERE \"contestId\" = '{contestId}') as snapshots;
"
```
**Expected**: `participants = snapshots` (after contest ends)

---

### Test 5.8: Get Full Contest Leaderboard from DB
```bash
psql $DATABASE_URL -c "
SELECT ls.rank, u.name as user_name, ls.score
FROM \"LeaderboardSnapshot\" ls
JOIN \"User\" u ON ls.\"userId\" = u.id
WHERE ls.\"contestId\" = '{contestId}'
ORDER BY ls.rank ASC
LIMIT 20;
"
```
**Expected**: Top 20 users with rank, name, score

---

### Test 5.9: Verify Submission Timestamps
```bash
psql $DATABASE_URL -c "
SELECT \"questionId\", \"submittedAt\"
FROM \"Submission\"
WHERE \"userId\" = '{userId}'
  AND \"contestId\" = '{contestId}'
ORDER BY \"submittedAt\" ASC;
"
```
**Expected**: Timestamps in ascending order (chronological)

---

### Test 5.10: Check Question Correct Option
```bash
psql $DATABASE_URL -c "
SELECT mo.id, mo.text, mo.\"isCorrect\"
FROM \"McqOption\" mo
JOIN \"Question\" q ON mo.\"questionId\" = q.id
WHERE q.id = '{questionId}';
"
```
**Expected**: 1 option with `isCorrect = true`

---

## 6️⃣ FAILURE & EDGE CASE TESTS

### Test 6.1: Invalid JWT Token
```bash
wscat -c "ws://localhost:3000/ws/contest?token=eyInvalid.Token.Here"
```
**Expected**: Connection rejected  
**Expected Output**: `HTTP/1.1 401 Unauthorized`  
**Connection**: Never established

---

### Test 6.2: Expired JWT Token
**Prerequisite**: Create token with short expiration (modify JWT_SECRET test)

```bash
wscat -c "ws://localhost:3000/ws/contest?token=$EXPIRED_TOKEN"
```
**Expected**: Connection rejected  
**Expected Output**: `HTTP/1.1 401 Unauthorized`

---

### Test 6.3: Join Contest Twice (Same User)
**First Connection**:
```bash
wscat -c "ws://localhost:3000/ws/contest?token=$TOKEN"
```
Send:
```json
{"event": "join_contest", "data": {"contestId": "{contestId}"}}
```
**Expected**: Success

**Second Connection** (same token):
```bash
wscat -c "ws://localhost:3000/ws/contest?token=$TOKEN"
```
Send:
```json
{"event": "join_contest", "data": {"contestId": "{contestId}"}}
```
**Expected**: Both connections allowed (last connection becomes active)

---

### Test 6.4: Submit Answer Without Joining Contest
**Connection**:
```bash
wscat -c "ws://localhost:3000/ws/contest?token=$TOKEN"
```
**Without sending `join_contest`, send**:
```json
{
  "event": "submit_answer",
  "data": {
    "questionId": "q1-uuid",
    "selectedOptionId": "option-uuid",
    "submittedAt": "2026-01-09T10:00:45.000Z"
  }
}
```
**Expected Response**:
```json
{
  "event": "error",
  "data": {
    "code": "NOT_PARTICIPANT",
    "message": "Not in a contest",
    "details": null
  },
  "timestamp": "ISO-8601-timestamp"
}
```

---

### Test 6.5: Invalid Event Type
```json
{
  "event": "unknown_event",
  "data": {}
}
```
**Expected Response**:
```json
{
  "event": "error",
  "data": {
    "code": "INVALID_EVENT",
    "message": "Unknown event type",
    "details": null
  },
  "timestamp": "ISO-8601-timestamp"
}
```

---

### Test 6.6: Malformed JSON
```
{invalid json
```
**Expected Response**:
```json
{
  "event": "error",
  "data": {
    "code": "SERVER_ERROR",
    "message": "Invalid message format",
    "details": null
  },
  "timestamp": "ISO-8601-timestamp"
}
```

---

### Test 6.7: Server Restart During Contest
**Steps**:
1. Connect and join contest
2. Receive question broadcast
3. Restart backend server:
```bash
cd /Users/abdul/projects/week3/backend
kill $(lsof -t -i:3000)
bun run start
```
4. Client connection closes
5. Reconnect with same token
6. Send `resync` event

**Expected**: State restored, contest continues

---

### Test 6.8: Redis Failure Recovery
**Steps**:
1. Stop Redis: `brew services stop redis`
2. Try to submit answer
3. **Expected**: Error logged server-side
4. Start Redis: `brew services start redis`
5. Try again

**Expected**: Recovery after Redis restart

---

### Test 6.9: Database Connection Failure
**Steps**:
1. Disconnect database (temporarily change DATABASE_URL)
2. Try operations
3. **Expected**: Server errors, operations fail gracefully
4. Restore database connection
5. Operations resume

---

### Test 6.10: WebSocket Disconnect + Reconnect
**Steps**:
1. Connect and join contest: `wscat -c "ws://localhost:3000/ws/contest?token=$TOKEN"`
2. Send `join_contest`
3. Receive question broadcast
4. Disconnect (Ctrl+C)
5. Reconnect: `wscat -c "ws://localhost:3000/ws/contest?token=$TOKEN"`
6. Send `resync`:
```json
{
  "event": "resync",
  "data": {
    "contestId": "{contestId}",
    "lastEventTimestamp": null
  }
}
```
**Expected**: Receive current state snapshot

---

### Test 6.11: Multiple Simultaneous Connections
**Terminal 1**:
```bash
wscat -c "ws://localhost:3000/ws/contest?token=$TOKEN1"
```
**Terminal 2**:
```bash
wscat -c "ws://localhost:3000/ws/contest?token=$TOKEN2"
```
**Terminal 3**:
```bash
wscat -c "ws://localhost:3000/ws/contest?token=$TOKEN3"
```

All join same contest, submit answers

**Expected**: All receive broadcasts, leaderboard updates correctly

---

### Test 6.12: Heartbeat Timeout
**Steps**:
1. Connect to WebSocket
2. Don't send any messages for 60+ seconds
3. **Expected**: Server closes connection (heartbeat timeout)

---

### Test 6.13: Rate Limiting (If Implemented)
**Steps**:
1. Connect to WebSocket
2. Rapidly send 100+ events per second
3. **Expected**: Server rate limits or drops connection

---

### Test 6.14: Submit Without selectedOptionId (MCQ)
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
**Expected**: Error (MCQ requires option selection)

---

### Test 6.15: Join COMPLETED Contest
**Steps**:
1. Find contest with status = COMPLETED
2. Connect and send:
```json
{"event": "join_contest", "data": {"contestId": "{completedContestId}"}}
```
**Expected Response**:
```json
{
  "event": "error",
  "data": {
    "code": "CONTEST_NOT_ACTIVE",
    "message": "Contest is not active",
    "details": null
  },
  "timestamp": "ISO-8601-timestamp"
}
```

---

## 7️⃣ PERFORMANCE & LOAD TESTS (Optional)

### Test 7.1: 100 Concurrent WebSocket Connections
```bash
# Use a load testing tool like `artillery` or custom script
# Create 100 simultaneous connections
# Verify server handles load without crashes
```

---

### Test 7.2: Leaderboard Update Performance
**Steps**:
1. Have 1000+ participants submit answers rapidly
2. Monitor leaderboard update latency
3. Verify batching works (not 1000 updates/sec)

---

### Test 7.3: Redis Memory Usage
```bash
redis-cli INFO memory
```
**Check**: `used_memory_human` stays reasonable during contest

---

### Test 7.4: Database Query Performance
```bash
psql $DATABASE_URL -c "EXPLAIN ANALYZE 
SELECT * FROM \"Submission\" 
WHERE \"contestId\" = '{contestId}' 
ORDER BY \"submittedAt\" DESC 
LIMIT 100;
"
```
**Expected**: Query completes in <50ms

---

## 8️⃣ END-TO-END INTEGRATION TEST

### Complete Contest Flow
**Prerequisites**: 
- Backend running
- Database and Redis accessible
- Contest created with status UPCOMING

**Steps**:

1. **User Registration**
```bash
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name": "Test User", "email": "test@example.com", "password": "password123"}'
```
Save token as `$TOKEN`

2. **Join Contest via REST**
```bash
curl -X POST http://localhost:3000/contest/{contestId}/join \
  -H "Authorization: Bearer $TOKEN"
```

3. **Connect WebSocket**
```bash
wscat -c "ws://localhost:3000/ws/contest?token=$TOKEN"
```

4. **Join Contest via WebSocket**
```json
{"event": "join_contest", "data": {"contestId": "{contestId}"}}
```

5. **Wait for Contest Start**
Receive `contest_start` event

6. **Receive Question**
Receive `question_broadcast` event

7. **Receive Timer Updates**
Observe `timer_update` events every second

8. **Submit Answer**
```json
{
  "event": "submit_answer",
  "data": {
    "questionId": "{questionId}",
    "selectedOptionId": "{optionId}",
    "submittedAt": "{timestamp}"
  }
}
```

9. **Receive Submission Result**
Receive `submission_result` event

10. **Receive Leaderboard Update**
Receive `leaderboard_update` event

11. **Repeat for All Questions**
Steps 6-10 for each question

12. **Receive Contest End**
Receive `contest_end` event

13. **Verify Database**
```bash
psql $DATABASE_URL -c "
SELECT COUNT(*) FROM \"Submission\" 
WHERE \"userId\" = '{userId}' 
  AND \"contestId\" = '{contestId}';"
```

14. **Verify Redis Leaderboard**
```bash
redis-cli ZSCORE "leaderboard:{contestId}" "{userId}"
```

15. **Verify LeaderboardSnapshot**
```bash
psql $DATABASE_URL -c "
SELECT * FROM \"LeaderboardSnapshot\" 
WHERE \"userId\" = '{userId}' 
  AND \"contestId\" = '{contestId}';"
```

**Expected**: All steps complete successfully, data consistent across WebSocket, Redis, and Database.

---

## ✅ SUCCESS CRITERIA

### Backend is considered VERIFIED when:
- ✅ All REST endpoints return correct status codes and response shapes
- ✅ WebSocket connection lifecycle works correctly
- ✅ All WebSocket events are sent/received as specified
- ✅ Submissions are validated correctly (correct/incorrect/duplicate/late)
- ✅ Redis leaderboard updates in real-time
- ✅ Database persists all submissions and snapshots
- ✅ No duplicate submissions allowed
- ✅ Reconnection and resync work correctly
- ✅ Error handling returns appropriate error codes
- ✅ Server handles edge cases gracefully (invalid JWT, malformed JSON, etc.)
- ✅ End-to-end flow completes without errors

---

## 📝 TEST RESULT TEMPLATE

Use this template to record test results:

```markdown
### Test: [Test Name]
**Date**: YYYY-MM-DD  
**Tester**: [Name]  
**Status**: ✅ PASS / ❌ FAIL  
**Notes**: [Observations]  
**Issues**: [Any bugs found]
```

---

**END OF CHECKLIST**
