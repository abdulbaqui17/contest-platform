# Migration Guide: Mock → Production Code Execution

## Overview

This guide walks you through upgrading from mock code execution to a production-grade Judge0-powered system.

---

## Phase 1: Infrastructure Setup (30 minutes)

### Step 1.1: Backup Current State

```bash
# Backup database
docker exec contest-postgres pg_dump -U contest contest_db > backup_$(date +%Y%m%d).sql

# Backup current code
cp -r backend backend.backup
cp -r db db.backup
```

### Step 1.2: Apply New Docker Compose

```bash
# Stop current services
docker-compose down

# Rename files
mv docker-compose.yml docker-compose.old.yml
mv docker-compose.production.yml docker-compose.yml

# Start with new config (this will download Judge0 images)
docker-compose up -d

# Verify Judge0 is running
curl http://localhost:2358/about
```

Expected response:
```json
{
  "version": "1.13.1",
  "homepage": "https://judge0.com"
}
```

### Step 1.3: Verify Judge0 Workers

```bash
# Check workers are processing
docker logs contest-judge0-workers -f

# Test submission
curl -X POST http://localhost:2358/submissions \
  -H "Content-Type: application/json" \
  -d '{
    "source_code": "print(\"Hello, World!\")",
    "language_id": 71
  }'
```

---

## Phase 2: Database Migration (15 minutes)

### Step 2.1: Apply Schema Changes

```bash
# Navigate to db folder
cd db

# Apply new schema
mv prisma/schema.prisma prisma/schema.prisma.old
mv prisma/schema.prisma.new prisma/schema.prisma

# Generate Prisma client
npx prisma generate

# Create migration
npx prisma migrate dev --name add_production_execution

# Run migration
npx prisma migrate deploy
```

### Step 2.2: Verify New Tables

```bash
# Connect to database
docker exec -it contest-postgres psql -U contest -d contest_db

# Check tables
\dt

# Verify new columns
\d "PracticeSubmission"
\d "UserStats"
\d "Editorial"
\d "SolvedQuestion"
```

---

## Phase 3: Backend Updates (20 minutes)

### Step 3.1: Replace Services

```bash
# Navigate to backend
cd backend

# Replace code execution service
mv services/code-execution.service.ts services/code-execution.service.old.ts
mv services/judge0.service.ts services/code-execution.service.ts

# Replace submission routes
mv submissions/index.ts submissions/index.old.ts
mv submissions/index.new.ts submissions/index.ts
```

### Step 3.2: Add New Routes to Main App

Edit `backend/index.ts`:

```typescript
// Add these imports
import userStatsRouter from "./users/stats";
import editorialsRouter from "./editorials";

// Add these routes (after existing routes)
app.use("/api/users", userStatsRouter);
app.use("/api/editorials", editorialsRouter);
```

### Step 3.3: Update Middleware

Create `backend/middleware/auth.ts` update for `optionalAuth`:

```typescript
// Add this middleware for optional authentication
export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return next(); // Continue without user
  }

  const token = authHeader.split(" ")[1];
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as {
      userId: string;
      role: string;
    };
    (req as AuthRequest).user = decoded;
  } catch {
    // Invalid token, continue without user
  }
  
  next();
};
```

### Step 3.4: Rebuild Backend

```bash
docker-compose build backend
docker-compose up -d backend
```

---

## Phase 4: Frontend Updates (30 minutes)

### Step 4.1: Update API Service

Add to `frontend/src/services/api.ts`:

```typescript
// Submission API updates
export const submissionsAPI = {
  // Run code (sample tests only)
  runCode: async (code: string, language: string, questionId: string) => {
    const response = await api.post("/submissions/run", {
      code,
      language,
      questionId,
    });
    return response.data;
  },

  // Submit code (practice mode)
  submitPractice: async (code: string, language: string, questionId: string) => {
    const response = await api.post("/submissions/practice", {
      code,
      language,
      questionId,
    });
    return response.data;
  },

  // Submit code (contest mode)
  submitContest: async (code: string, language: string, questionId: string, contestId: string) => {
    const response = await api.post("/submissions/contest", {
      code,
      language,
      questionId,
      contestId,
    });
    return response.data;
  },

  // Get submission history
  getHistory: async (questionId?: string, limit = 20, offset = 0) => {
    const params = new URLSearchParams();
    if (questionId) params.append("questionId", questionId);
    params.append("limit", String(limit));
    params.append("offset", String(offset));
    
    const response = await api.get(`/submissions?${params}`);
    return response.data;
  },

  // Get submission details
  getSubmission: async (id: string) => {
    const response = await api.get(`/submissions/${id}`);
    return response.data;
  },
};

// User stats API
export const userStatsAPI = {
  getMyStats: async () => {
    const response = await api.get("/users/stats");
    return response.data;
  },

  getUserStats: async (userId: string) => {
    const response = await api.get(`/users/stats/${userId}`);
    return response.data;
  },

  getProfile: async () => {
    const response = await api.get("/users/profile");
    return response.data;
  },

  getLeaderboard: async (limit = 50) => {
    const response = await api.get(`/users/leaderboard?limit=${limit}`);
    return response.data;
  },
};

// Editorial API
export const editorialAPI = {
  getEditorial: async (questionId: string) => {
    const response = await api.get(`/editorials/${questionId}`);
    return response.data;
  },

  getHints: async (questionId: string, revealed = 0) => {
    const response = await api.get(`/editorials/${questionId}/hints?revealed=${revealed}`);
    return response.data;
  },
};
```

### Step 4.2: Update Code Editor Component

The code editor should now have separate Run/Submit buttons:

```tsx
// In your coding challenge component
const [isRunning, setIsRunning] = useState(false);
const [isSubmitting, setIsSubmitting] = useState(false);

const handleRun = async () => {
  setIsRunning(true);
  try {
    const result = await submissionsAPI.runCode(code, language, questionId);
    setRunResults(result);
    setActiveTab("results");
  } catch (error) {
    console.error("Run error:", error);
  } finally {
    setIsRunning(false);
  }
};

const handleSubmit = async () => {
  setIsSubmitting(true);
  try {
    const result = contestId 
      ? await submissionsAPI.submitContest(code, language, questionId, contestId)
      : await submissionsAPI.submitPractice(code, language, questionId);
    setSubmissionResult(result);
    setActiveTab("submission");
  } catch (error) {
    console.error("Submit error:", error);
  } finally {
    setIsSubmitting(false);
  }
};

// Buttons
<Button onClick={handleRun} disabled={isRunning}>
  {isRunning ? "Running..." : "Run"}
</Button>
<Button onClick={handleSubmit} disabled={isSubmitting} variant="success">
  {isSubmitting ? "Submitting..." : "Submit"}
</Button>
```

### Step 4.3: Create User Profile Page

Create `frontend/src/pages/Profile.tsx` with stats display.

### Step 4.4: Create Submission History Page

Create `frontend/src/pages/Submissions.tsx` to show submission history.

### Step 4.5: Rebuild Frontend

```bash
docker-compose build frontend
docker-compose up -d frontend
```

---

## Phase 5: Testing (20 minutes)

### Step 5.1: Test Run Endpoint

```bash
# Test Python
curl -X POST http://localhost:3001/api/submissions/run \
  -H "Content-Type: application/json" \
  -d '{
    "code": "def twoSum(nums, target):\n    for i, n in enumerate(nums):\n        for j, m in enumerate(nums[i+1:], i+1):\n            if n + m == target:\n                return [i, j]\n    return []",
    "language": "python",
    "questionId": "YOUR_QUESTION_ID"
  }'
```

### Step 5.2: Test Submit Endpoint

```bash
# Test with auth
curl -X POST http://localhost:3001/api/submissions/practice \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "code": "...",
    "language": "python",
    "questionId": "YOUR_QUESTION_ID"
  }'
```

### Step 5.3: Test All Languages

Test each supported language:
- JavaScript (93)
- Python (71)
- Java (62)
- C++ (54)

### Step 5.4: Test Edge Cases

1. Compilation error (syntax error)
2. Runtime error (division by zero)
3. Time limit exceeded (infinite loop)
4. Memory limit exceeded (large array)
5. Wrong answer

---

## Phase 6: Monitoring & Maintenance

### Step 6.1: Monitor Judge0 Health

```bash
# Add health check endpoint
curl http://localhost:3001/api/submissions/health/check
```

### Step 6.2: Monitor Queue Length

```bash
# Check Judge0 queue
docker exec contest-judge0 curl http://localhost:2358/workers
```

### Step 6.3: Log Monitoring

```bash
# Backend logs
docker logs contest-backend -f

# Judge0 logs
docker logs contest-judge0 -f
docker logs contest-judge0-workers -f
```

---

## Rollback Plan

If something goes wrong:

```bash
# Stop services
docker-compose down

# Restore old compose file
mv docker-compose.yml docker-compose.production.yml
mv docker-compose.old.yml docker-compose.yml

# Restore old code
mv backend.backup/* backend/
mv db.backup/* db/

# Restore database
cat backup_YYYYMMDD.sql | docker exec -i contest-postgres psql -U contest contest_db

# Start services
docker-compose up -d
```

---

## Performance Tuning

### Judge0 Workers

For higher throughput, increase workers:

```yaml
# In docker-compose.yml
environment:
  WORKERS: 8  # Default is 4
```

### Timeout Settings

```yaml
environment:
  CPU_TIME_LIMIT: 5      # seconds
  WALL_TIME_LIMIT: 15    # seconds (wall clock)
  MEMORY_LIMIT: 262144   # KB (256MB)
```

### Scaling

For production with many users:

1. Run multiple Judge0 worker containers
2. Use Redis clustering for queue
3. Add load balancer for backend
4. Consider managed Judge0 (judge0.com)

---

## Security Checklist

- [ ] Judge0 runs in privileged mode (required for cgroups)
- [ ] Network isolation between Judge0 and main app
- [ ] No internet access from executed code (`ENABLE_NETWORK: false`)
- [ ] Resource limits properly configured
- [ ] No auth token exposed to frontend
- [ ] Webhook endpoint validates origin

---

## Done! 🎉

Your platform now has:
- ✅ Real code execution (not mocked)
- ✅ Docker sandboxed security
- ✅ Multiple language support
- ✅ Run vs Submit separation
- ✅ Hidden test cases
- ✅ Proper verdicts (AC, WA, TLE, MLE, RE, CE)
- ✅ User statistics
- ✅ Problem editorials
- ✅ Submission history
