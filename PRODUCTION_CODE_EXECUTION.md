# Production-Grade Code Execution System

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER FLOW                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   User Writes Code → [RUN] → Execute against SAMPLE test cases only        │
│                        ↓                                                    │
│                  Show immediate results (visible I/O)                       │
│                                                                             │
│   User Writes Code → [SUBMIT] → Execute against ALL test cases             │
│                         ↓                                                   │
│              Queue → Judge0 → Webhook → Store Result → WebSocket           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                         SYSTEM ARCHITECTURE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐      │
│  │  Frontend  │───▶│  Backend   │───▶│   Redis    │───▶│  Judge0    │      │
│  │   React    │    │  Express   │    │   Queue    │    │  Workers   │      │
│  └────────────┘    └────────────┘    └────────────┘    └────────────┘      │
│        ▲                 │                                    │            │
│        │                 ▼                                    │            │
│        │          ┌────────────┐                              │            │
│        │          │ PostgreSQL │◀─────────────────────────────┘            │
│        │          │   Prisma   │      (Webhook callback)                   │
│        │          └────────────┘                                           │
│        │                 │                                                 │
│        └─────────────────┘ (WebSocket real-time updates)                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Verdict Types (LeetCode Standard)

| Verdict | Code | Description |
|---------|------|-------------|
| Accepted | AC | All test cases passed |
| Wrong Answer | WA | Output doesn't match expected |
| Time Limit Exceeded | TLE | Execution took too long |
| Memory Limit Exceeded | MLE | Used too much memory |
| Runtime Error | RE | Segfault, division by zero, etc. |
| Compilation Error | CE | Code failed to compile |
| Pending | PENDING | In queue |
| Running | RUNNING | Currently executing |

## Why Judge0?

1. **Battle-tested**: Used by 2000+ companies including major coding platforms
2. **60+ Languages**: Native support for all major languages
3. **Security**: Sandboxed execution with cgroups + namespaces
4. **Self-hosted**: No rate limits, full control
5. **Webhook Support**: Async execution with callbacks
6. **Resource Limits**: CPU, memory, wall time, file size limits

## Implementation Phases

### Phase 1: Judge0 Infrastructure (Day 1)
- Add Judge0 to docker-compose
- Configure workers and callbacks

### Phase 2: Schema Updates (Day 1)
- Update Submission model for detailed verdicts
- Add Editorial model
- Add UserStats model
- Add SubmissionHistory (non-contest submissions)

### Phase 3: Backend Services (Day 2-3)
- Judge0 client service
- Submission queue processor
- Verdict calculator
- User stats aggregator

### Phase 4: Frontend Updates (Day 3-4)
- Split Run/Submit buttons
- Real-time verdict display
- Submission history page
- User profile with stats

### Phase 5: Testing & Polish (Day 5)
- Load testing
- Edge case handling
- Error recovery

---

## Language Support Matrix

| Language | Judge0 ID | File Extension | Compile Command |
|----------|-----------|----------------|-----------------|
| Python 3.10 | 71 | .py | - |
| JavaScript (Node 18) | 93 | .js | - |
| TypeScript | 94 | .ts | - |
| Java 17 | 62 | .java | javac |
| C++ 17 (GCC) | 54 | .cpp | g++ -std=c++17 |
| C (GCC) | 50 | .c | gcc |

---

## Test Case Design

```
Sample Test Cases (isHidden: false)
├── Visible to users during coding
├── Used for "Run" button
├── Input/Output shown in UI
└── Typically 2-3 simple cases

Hidden Test Cases (isHidden: true)
├── Not visible to users
├── Used only for "Submit"
├── Edge cases, large inputs
└── Typically 10-20 cases including:
    ├── Edge cases (empty, null, boundary)
    ├── Performance cases (large N)
    └── Corner cases (duplicates, negative)
```

---

## API Design

### Run Code (Sample Tests Only)
```
POST /api/submissions/run
{
  "code": "function add(a,b) { return a+b; }",
  "language": "javascript",
  "questionId": "uuid"
}

Response:
{
  "results": [
    {
      "testCase": 1,
      "input": "[1, 2]",
      "expected": "3",
      "actual": "3",
      "passed": true,
      "time": 45,
      "memory": 12.4
    }
  ],
  "allPassed": true,
  "totalTime": 45
}
```

### Submit Code (All Tests)
```
POST /api/submissions/submit
{
  "code": "...",
  "language": "javascript",
  "questionId": "uuid",
  "contestId": "uuid" // optional
}

Response:
{
  "submissionId": "uuid",
  "status": "PENDING"
}

// Then via WebSocket:
{
  "type": "SUBMISSION_UPDATE",
  "submissionId": "uuid",
  "status": "ACCEPTED",
  "testCasesPassed": 15,
  "totalTestCases": 15,
  "runtime": 89,
  "memory": 14.2
}
```

### Get Submission Details
```
GET /api/submissions/:id

{
  "id": "uuid",
  "status": "ACCEPTED",
  "code": "...",
  "language": "javascript",
  "runtime": 89,
  "memory": 14.2,
  "testCasesPassed": 15,
  "totalTestCases": 15,
  "createdAt": "2026-01-22T...",
  "visibleResults": [...] // Only sample cases
}
```

### User Stats
```
GET /api/users/stats

{
  "totalSolved": 42,
  "easySolved": 20,
  "mediumSolved": 15,
  "hardSolved": 7,
  "totalSubmissions": 156,
  "acceptanceRate": 68.5,
  "contestsParticipated": 5,
  "bestRank": 12,
  "streak": 7,
  "recentSubmissions": [...]
}
```

### Problem Editorial
```
GET /api/questions/:id/editorial

{
  "questionId": "uuid",
  "approach": "## Two Pointer Approach\n\n...",
  "timeComplexity": "O(n)",
  "spaceComplexity": "O(1)",
  "solutionCode": {
    "javascript": "function twoSum(nums, target) {...}",
    "python": "def two_sum(nums, target):..."
  },
  "hints": [
    "Think about what happens when you sort the array",
    "Can you use two indices moving towards each other?"
  ]
}
```
