# FairShare Backend — Agent Guide

> This document is the source of truth for any AI agent or developer working on this codebase.
> Read it fully before making any changes.

---

## 1. Project Overview

**FairShare** is an expense-splitting platform between friends. Users can create groups, log shared expenses, and track who owes whom.

This repository contains the **REST API backend** only. It is responsible for:
- Verifying user identity (via Supabase-issued JWTs)
- Enforcing business logic
- Reading from and writing to the Postgres database (hosted on Supabase)

It does **not** handle:
- Authentication flows (Google OAuth is handled entirely by Supabase + the frontend)
- Frontend rendering

---

## 2. Architecture Flow

```
Frontend (Supabase Google OAuth)
        │
        │  Authorization: Bearer <supabase_jwt>
        ▼
Express Backend (this repo)
        │
        │  1. Verify JWT locally using SUPABASE_JWT_SECRET + jsonwebtoken
        │  2. Extract user identity (sub, email) from JWT payload
        │  3. Query / mutate Postgres via postgres + drizzle-orm
        ▼
Postgres Database (Supabase-hosted)
```

### JWT Verification
- The frontend authenticates via Supabase (Google OAuth) and receives a JWT.
- Every protected API request must include the header: `Authorization: Bearer <token>`
- The backend verifies the JWT **locally** using `jsonwebtoken` and `SUPABASE_JWT_SECRET` — no network call to Supabase is made.
- The decoded payload (at minimum `sub` — the Supabase user UUID) is attached to `req.user` by the auth middleware.

---

## 3. Tech Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js |
| Language | TypeScript (strict mode) |
| Framework | Express |
| DB Client | `postgres` (postgres.js) |
| ORM / Query Builder | `drizzle-orm` |
| Schema validation | `zod` |
| JWT verification | `jsonwebtoken` |
| Environment variables | `dotenv` |

---

## 4. Folder Structure

```
src/
├── app.ts               # Express app setup (middleware, route registration)
├── server.ts            # HTTP server entry point (listens on PORT)
├── middleware/
│   ├── auth.ts          # JWT verification middleware → attaches req.user
│   └── validate.middleware.ts      # Zod request validation middleware factory
├── routes/
│   └── <resource>.ts    # One file per REST resource (e.g. groups.ts, expenses.ts)
├── db/
│   ├── client.ts        # postgres.js + drizzle-orm client instance
│   └── schema/
│       └── <domain>.ts  # One schema file per domain (e.g. users.ts, groups.ts)
└── types/
    └── express.d.ts     # Augments Express Request to include req.user
```

- **Never** put business logic in route files — keep routes thin (parse → validateMiddleware → call logic → respond).
- Schema files in `src/db/schema/` define Drizzle table definitions. Each domain gets its own file.

---

## 5. Environment Variables

Create a `.env` file at the root of the project. **Never commit it.**

| Variable | Description |
|---|---|
| `PORT` | Port the Express server listens on (default: `3000`) |
| `DATABASE_URL` | Postgres connection string from Supabase |
| `SUPABASE_JWT_SECRET` | JWT secret from Supabase dashboard → Project Settings → API |

---

## 6. API Conventions

### Routing
- Routes are resource-based: `/groups`, `/expenses`, `/users`, etc.
- Use standard HTTP verbs: `GET`, `POST`, `PATCH`, `DELETE`
- All routes are prefixed with `/api` (e.g. `/api/groups`)
- All protected routes **must** use the `auth` middleware

### Request Validation
- All request bodies and query params **must** be validated with a `zod` schema
- Use the `validateMiddleware` middleware factory to keep route handlers clean

### Response Shape
- Response shape is determined per endpoint as the project evolves
- Always use appropriate HTTP status codes (`200`, `201`, `400`, `401`, `403`, `404`, `500`)
- Errors must return a JSON body with at minimum an `error` string field: `{ "error": "message" }`

### Authentication
- Every non-public route must run the `auth` middleware
- After `auth` runs, `req.user.id` (Supabase UUID) is available in the handler

---

## 7. TypeScript Config

Key settings in `tsconfig.json`:
- `strict: true` — all strict checks enabled
- `rootDir: ./src` / `outDir: ./dist` — compile to `dist/`
- `module: nodenext` — native ESM with Node.js resolution
- `verbatimModuleSyntax: true` — use `import type` for type-only imports
- `noUncheckedIndexedAccess: true` — array/object access always potentially `undefined`

---

## 8. Adding New Features (Agent Instructions)

When adding a new resource (e.g. `expenses`):

1. **Define the Drizzle schema** in `src/db/schema/expenses.ts`
2. **Create the route file** at `src/routes/expenses.ts`
3. **Register the router** in `src/app.ts` under `/api/expenses`
4. **Validate all inputs** with `zod` using the `validateMiddleware` middleware
5. **Protect all non-public routes** with the `auth` middleware
6. **Never** bypass the auth middleware on routes that touch user data
