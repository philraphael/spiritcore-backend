# SpiritCore Phase 4 — Fastify Migration Runbook (Safe Cutover)

## Goal
Switch the server framework to Fastify **without losing your existing APIs**:
- /v0/* endpoints
- /runtime/* endpoints

This bundle includes:
- your existing `runtime/` folder (unchanged)
- your existing v0 adapters (copied into `adapters/`)
- your existing Supabase usage
- a new Fastify `server.mjs` that preserves routes

## Step-by-step (Windows)

### 1) Backup (do this first)
Duplicate your current folder and rename it:
- `spiritcore__BACKUP__express_working`

### 2) Replace folder with this bundle
Unzip the bundle. You will see a folder named `spiritcore`.
Copy that folder into the same parent directory where your old `spiritcore` is.

### 3) Keep your .env
This bundle contains `.env` and `.env.example`, but you should keep **your real keys**.
Open `.env` and confirm these exist:

- SUPABASE_URL=...
- SUPABASE_SERVICE_ROLE_KEY=...
- PORT=5050 (or any open port)
- USE_LLM=false (or true)
- DEBUG=false (or true)

### 4) Install dependencies
Open a terminal in the `spiritcore` folder and run:
- `npm install`

### 5) Start
- `npm start`

### 6) Smoke tests
- `GET http://localhost:5050/v0/health`
- `POST http://localhost:5050/v0/conversations` with `{ "title": "test" }`
- `POST http://localhost:5050/runtime/interaction/<userId>` with `{ "message":"hi", "conversation_id":"<id>" }`

## If something fails
- Do not delete anything.
- Switch back by renaming folders:
  - rename new `spiritcore` -> `spiritcore__BROKEN`
  - rename backup -> `spiritcore`
