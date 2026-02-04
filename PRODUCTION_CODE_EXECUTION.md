# Production-Grade Code Execution (Docker Runner)

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
│                Backend spawns Docker containers per test case               │
│                         ↓                                                   │
│              Store Result → WebSocket → Leaderboard updates                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SYSTEM ARCHITECTURE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐                         │
│  │  Frontend  │───▶│  Backend   │───▶│   Redis    │                         │
│  │   React    │    │  Express   │    │ Leaderboard│                         │
│  └────────────┘    └────────────┘    └────────────┘                         │
│        ▲                 │                                                 │
│        │                 ▼                                                 │
│        │          ┌────────────┐                                           │
│        │          │ PostgreSQL │                                           │
│        │          │   Prisma   │                                           │
│        │          └────────────┘                                           │
│        │                 │                                                 │
│        └─────────────────┘ (WebSocket real-time updates)                   │
│                                                                             │
│  Backend → Docker socket → ephemeral runner containers (per test case)      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Why Docker per Run?

1. **Strong isolation**: Each test case runs in a fresh container
2. **Language flexibility**: Use official language images (Bun, Python, GCC, JDK)
3. **Security**: `--network none`, CPU/memory limits, pid limits
4. **Simplicity**: No external judge service to maintain

## Runner Behavior

- **Run** → sample (visible) test cases only
- **Submit** → all test cases (includes hidden)
- Each test case spawns **one container**
- For compiled languages, compilation happens once per submission

## Supported Languages

| Language | Docker Image | Execution Command |
|----------|--------------|-------------------|
| JavaScript | `oven/bun:1.1.10` | `bun /work/main.ts` |
| TypeScript | `oven/bun:1.1.10` | `bun /work/main.ts` |
| Python | `python:3.11-slim` | `python /work/main.py` |
| Java | `eclipse-temurin:17-jdk` | `javac` → `java` |
| C++ | `gcc:12` | `g++` → `/work/a.out` |
| C | `gcc:12` | `gcc` → `/work/a.out` |

Override images via env:
- `CODE_RUNNER_IMAGE_JS`
- `CODE_RUNNER_IMAGE_TS`
- `CODE_RUNNER_IMAGE_PY`
- `CODE_RUNNER_IMAGE_JAVA`
- `CODE_RUNNER_IMAGE_CPP`
- `CODE_RUNNER_IMAGE_C`

## Security Configuration

Each container runs with:
- `--network none`
- `--cpus 1`
- `--memory <limit>`
- `--pids-limit 64`
- `--security-opt no-new-privileges`

## Local / Docker Deployment Notes

- If backend runs on host: Docker CLI must be installed.
- If backend runs in Docker: mount host socket:
  - `/var/run/docker.sock:/var/run/docker.sock`

## Verdict Types

| Verdict | Code | Description |
|---------|------|-------------|
| Accepted | AC | All test cases passed |
| Wrong Answer | WA | Output doesn't match expected |
| Time Limit Exceeded | TLE | Execution took too long |
| Runtime Error | RE | Crash, non‑zero exit |
| Compilation Error | CE | Compile failed |

## Test Case Design

```
Sample Test Cases (isHidden: false)
├── Visible to users during coding
├── Used for "Run" button
└── Typically 2-3 simple cases

Hidden Test Cases (isHidden: true)
├── Not visible to users
├── Used only for "Submit"
└── Edge cases, large inputs
```
