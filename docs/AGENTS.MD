# FairShare Backend — Agent Guide

> This document is the source of truth for any AI agent or developer working on this codebase.
> Read it fully before making any changes.

---

## 1. Project Overview

**FairShare** is an expense-splitting platform between friends. Users can create groups, log shared expenses, and track who owes whom.

This repository contains the **REST API backend** only. It is responsible for:
- Authenticating users via Google OAuth (verifying Google ID Tokens using `google-auth-library`)
- Issuing and verifying its own JWTs stored in HTTP-only cookies
- Enforcing business logic
- Reading from and writing to the Postgres database (hosted on Supabase)

---

## 2. Architecture Flow

```
Frontend (Google OAuth)
        │
        │  POST /api/auth/google  { credential: <google_id_token> }
        ▼
Express Backend (this repo)
        │
        │  1. Validate request body with Zod (validateMiddleware)
        │  2. Verify Google ID Token using google-auth-library OAuth2Client
        │  3. Upsert user into Postgres via drizzle-orm
        │  4. Sign a JWT (jsonwebtoken) with { id: user.id }
        │  5. Set JWT as HTTP-only cookie on the response
        ▼
Postgres Database (Supabase-hosted)
```

### JWT Strategy
- The backend issues its **own JWTs** (not Supabase JWTs) after verifying a Google ID Token.
- The JWT payload contains `{ id: string }` — the user's UUID from the `users` table.
- JWTs are stored in an HTTP-only cookie named `token` (expires in 7 days).
- All protected routes sit behind the `/api/app/*` prefix and are guarded by the `verifyToken` middleware.
- After `verifyToken` runs, `req.user.id` (the user's UUID) is available in the handler.

---

## 3. Tech Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js (ESM, `"type": "module"`) |
| Language | TypeScript (strict mode) |
| Framework | Express 4 |
| DB Client | `postgres` (postgres.js) |
| ORM / Query Builder | `drizzle-orm` |
| Schema Validation | `zod` v4 |
| JWT | `jsonwebtoken` |
| Google Auth | `google-auth-library` |
| Cookies | `cookie-parser` |
| CORS | `cors` |
| Environment Variables | `dotenv` |
| Dev Runner | `tsx` (watch mode) |

---

## 4. Folder Structure

```
src/
├── app.ts                          # Express app setup (middleware, CORS, route registration)
├── server.ts                       # HTTP server entry point (startup checks, listens on PORT)
├── controllers/
│   └── auth.controller.ts          # Handles auth requests, sets cookie, returns response
├── database/
│   ├── client.ts                   # postgres.js + drizzle-orm singleton client
│   └── schemas/
│       └── users.ts                # Drizzle table definition for `users`
├── errors/
│   └── api.error.ts                # APIError class (operational errors)
├── lib/
│   ├── constants.ts                # All env variable exports + STATUS_CODES
│   └── utils/
│       └── logger.ts               # Singleton Logger class (INFO/WARN/ERROR/DEBUG)
├── middlewares/
│   ├── errorHandler.middleware.ts  # Global 4-arg error handler
│   ├── jwt.middleware.ts           # verifyToken — reads cookie, verifies JWT, sets req.user
│   ├── logger.middleware.ts        # logRequest — logs every /api/* request at DEBUG level
│   └── validate.middleware.ts      # validateMiddleware factory — Zod schema validation
├── routes/
│   └── auth.route.ts               # POST /google route
├── services/
│   └── auth.service.ts             # Google token verification, DB upsert, JWT signing
└── validators/
    └── auth.validator.ts           # Zod schema for Google auth request body
```

- **Never** put business logic in route or controller files — routes are thin, controllers only handle HTTP concerns (cookie, response), services contain all logic.
- Schema files in `src/database/schemas/` define Drizzle table definitions. Each domain gets its own file.
- All env variables are imported from `src/lib/constants.ts` — never read `process.env` directly elsewhere.

---

## 5. Environment Variables

Create a `.env` file at the root of the project. **Never commit it.**

| Variable | Description |
|---|---|
| `PORT` | Port the Express server listens on (default: `3000`) |
| `DATABASE_URL` | Postgres connection string from Supabase |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID from Google Cloud Console |
| `JWT_SECRET` | Secret used to sign and verify the backend's own JWTs |
| `FRONTEND_URL` | Frontend origin allowed by CORS (e.g. `http://localhost:5173`) |
| `MODE` | Set to `"DEV"` to enable DEBUG logs and non-secure cookies |

The server **will not start** if `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `JWT_SECRET`, or `FRONTEND_URL` are missing.

---

## 6. Key Implementation Details

### Database Client (`src/database/client.ts`)
- A single `postgres.js` client + drizzle-orm interface is created once at module load (singleton via module cache).
- If `DATABASE_URL` is not set, the client returns `null` and the server exits before starting.
- The startup check in `server.ts` runs `SELECT 1` to confirm the database is reachable before accepting requests.

### Logger (`src/lib/utils/logger.ts`)
- Implemented as a **Singleton class** — `private constructor`, `static getInstance()`.
- Exported as `Logger.getInstance()` so consumers just `import logger` and call `logger.info(...)`.
- `debug()` only logs when `DEP_MODE === "DEV"`.
- Automatically extracts the calling file and function name from the stack trace.

### Error Handling
- `APIError` extends `Error` with `statusCode` and `isOperational: true`.
- Throw `new APIError(STATUS_CODES.X, "message")` anywhere; it propagates to the global handler.
- The global `errorHandler` middleware (4 args) in `app.ts` is registered last.
- Operational errors send the actual message; non-operational errors send `"Something went very wrong!"`.

### Zod Validation (`validateMiddleware`)
- `validateMiddleware(schema)` returns a middleware function — it is a **middleware factory**.
- Schemas must wrap fields under `body`, `query`, and/or `params` keys to match `{ body: req.body, query: req.query, params: req.params }`.
- On failure, returns `400` with an array of Zod error messages.
- Use `ZodType` (not the deprecated `ZodTypeAny`) for the schema parameter type.

### CORS
- Configured in `app.ts` to allow only `FRONTEND_URL` origin with `credentials: true`.
- Allowed methods: `GET`, `POST`, `PATCH`, `DELETE`, `PUT`.
- Allowed headers: `Content-Type`, `Authorization`.

### Cookie Settings
- `httpOnly: true` — not accessible via JavaScript.
- `secure: true` in `PROD`, `false` in `DEV`.
- `sameSite: "strict"`.
- `maxAge`: 7 days.

---

## 7. API Conventions

### Routing
- Public auth routes: `/api/auth/*`
- Protected app routes: `/api/app/*` — all requests here pass through `verifyToken` middleware automatically.
- All routes are prefixed with `/api`.
- Use standard HTTP verbs: `GET`, `POST`, `PATCH`, `DELETE`.

### Request Validation
- All request bodies and query params **must** be validated with a Zod schema using `validateMiddleware`.

### Response Shape
- Success: `{ status: "success", message: "..." }` with appropriate `2xx` status code.
- Error: `{ status: "error", message: "..." | string[] }` with appropriate `4xx/5xx` status code.
- Always use `STATUS_CODES` from `src/lib/constants.ts` — never hardcode numbers.

### Authentication
- After `verifyToken` runs, `req.user.id` (the user's UUID) is available in the handler.
- `req.user` is typed via Express augmentation (see `tsconfig.json` and Express type extensions).

---

## 8. Database Schema

### `users` table (`src/database/schemas/users.ts`)

| Column | Type | Notes |
|---|---|---|
| `internal_id` | `serial` | Internal auto-increment primary key |
| `id` | `uuid` | Public-facing unique user ID, random default |
| `full_name` | `text` | Nullable |
| `email` | `text` | Not null, unique — conflict target for upsert |
| `avatar_url` | `text` | Nullable |
| `created_at` | `timestamp` | Defaults to now |

- Column names in the schema use **snake_case** to match the database column names exactly.
- Drizzle maps them 1:1 — no camelCase aliasing is used.
- Generate migrations: `npx drizzle-kit generate`
- Push schema directly: `npx drizzle-kit push`

---

## 9. TypeScript Config

Key settings in `tsconfig.json`:
- `strict: true` — all strict checks enabled
- `rootDir: ./src` / `outDir: ./dist` — compile to `dist/`
- `module: nodenext` — native ESM with Node.js resolution
- `verbatimModuleSyntax: true` — use `import type` for type-only imports
- `noUncheckedIndexedAccess: true` — array/object access is always potentially `undefined`

All internal imports must include the `.ts` extension (e.g. `import foo from "./foo.ts"`).

---

## 10. Adding New Features (Agent Instructions)

When adding a new resource (e.g. `expenses`):

1. **Define the Drizzle schema** in `src/database/schemas/expenses.ts` using snake_case column names
2. **Run** `npx drizzle-kit push` to apply the schema to the database
3. **Add a Zod validator** in `src/validators/expenses.validator.ts` — wrap fields under `body`/`query`/`params`
4. **Create the service** in `src/services/expenses.service.ts` — all DB and business logic lives here
5. **Create the controller** in `src/controllers/expenses.controller.ts` — only HTTP concerns (parse body, call service, send response)
6. **Create the route file** at `src/routes/expenses.route.ts` — thin, use `validateMiddleware`
7. **Register the router** in `src/app.ts` under `/api/app/expenses` (protected) or `/api/expenses` (public)
8. All routes under `/api/app/*` are **automatically protected** by `verifyToken` — no need to add it per-route
9. Throw `new APIError(STATUS_CODES.X, "message")` for all expected errors — never `res.status(...).json(...)` for errors
10. Always import env variables from `src/lib/constants.ts`, never from `process.env` directly
