# Migration Guide (Docker Runner)

This project now executes code in **ephemeral Docker containers** instead of Judge0.

## What Changed

- No Judge0 services or callbacks.
- The backend spawns a new container per test case using the Docker CLI.
- Language runtimes are pulled from official images (Bun/Python/GCC/JDK).

## Requirements

- Docker installed and running on the host.
- If the backend runs in Docker, mount the Docker socket:
  - `/var/run/docker.sock:/var/run/docker.sock`

## Quick Verification

1. Start infra:
   ```bash
   docker compose up -d postgres redis
   ```
2. Run backend locally (or in Docker with socket mounted).
3. Use `/submissions/run` with a JS solution to confirm execution.

## Notes

- Time/memory limits are enforced via Docker flags.
- Each test case runs in a fresh container for isolation.
