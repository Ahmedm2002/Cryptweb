# AGENTS.md

## Quick Commands

```bash
# Dev server (tsx + nodemon, loads .env automatically)
npm run dev

# Type-check and compile to dist/
npm run build

# Production start (builds first, then runs compiled JS)
npm run start

# Tests (Jest with ESM + ts-jest) — NO TESTS EXIST YET
npm test
```

There is no separate lint or typecheck command. `npm run build` runs `tsc` and is the only type verification.

## Architecture

Single-package Node.js/Express backend. No monorepo, no workspaces.

- **Runtime**: Node 22, Express 5, ESM (`"type": "module"`)
- **Database**: PostgreSQL via raw `pg` Pool (no ORM). Schema in `database/001_init.sql`
- **Realtime**: Socket.IO for WebRTC signaling + LAN peer discovery
- **Validation**: Zod v4 schemas in `src/dtos/`
- **Auth**: JWT access/refresh tokens, httpOnly cookies, multi-device sessions
- **Email**: Nodemailer via Google App Passwords

### Entry flow

`src/index.ts` → connects to DB → starts `httpServer` (from `src/components/signalling.ts`, wraps the Express app from `src/app.ts`)

### Directory structure

| Path | Purpose |
|------|---------|
| `src/controllers/` | Route handlers |
| `src/services/` | Business logic |
| `src/repositories/` | Raw SQL queries |
| `src/dtos/` | Zod validation schemas |
| `src/router/v1/` | Express route definitions |
| `src/components/signalling.ts` | Socket.IO server + WebRTC signaling |
| `src/utils/networkStore.ts` | In-memory peer/IP maps shared by REST + Socket |
| `src/utils/responses/` | `ApiResponse` / `ApiError` classes |
| `src/configs/` | DB pool, Nodemailer transport |
| `database/` | SQL schema files (manual, not migrations) |

## Critical Quirks

**ESM with `.js` extensions required**: All `.ts` imports must use `.js` extensions (`./foo.js`, not `./foo`). This is enforced by `verbatimModuleSyntax` + `nodenext` module resolution. Omitting `.js` will compile but fail at runtime.

**Strict TypeScript**: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and `verbatimModuleSyntax` are all `true`. Index accesses return `T | undefined`. Optional properties cannot be assigned `undefined` unless explicitly typed with `| undefined`.

**Dev loads `.env` via tsx flag**: The dev command is `nodemon --exec tsx --env-file=.env src/index.ts`. The `.env` file is loaded by the runtime, not by dotenv. `.env` is gitignored.

**Jest needs special invocation**: The test command uses `node --experimental-vm-modules` because Jest's ESM support is experimental. Config in `jest.config.ts` uses `ts-jest/presets/default-esm` with a `.js` extension mapper.

**Database is schema-based, no migrations**: Tables are created from `database/001_init.sql`. There is no migration tool. Schema changes must be applied manually or by re-running the SQL.

**Docker compose only runs PostgreSQL**: The backend service in `compose.yaml` is commented out. Run the app locally with `npm run dev`.

**Response convention**: All endpoints return `ApiResponse` (success) or `ApiError` (error). Error responses always include `success: false` and `errors` array when applicable.

**File naming**: One controller is spelled `verfiyUser.controller.ts` (typo). Reference it by its actual filename when importing or navigating.
