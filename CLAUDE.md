# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FairShare is an expense-sharing backend API built with Express.js, TypeScript, PostgreSQL (via Drizzle ORM), and Google OAuth authentication. The application manages shared expenses between friends and groups, tracking who paid what and calculating balances.

## Development Commands

- **Start development server with hot reload**: `npm run dev`
- **Build TypeScript to JavaScript**: `npm run build`
- **Start production server**: `npm start`
- **Database migrations**: `npx drizzle-kit generate` (generate migrations), `npx drizzle-kit migrate` (apply migrations), `npx drizzle-kit studio` (open Drizzle Studio)

## Architecture

### Request Flow

1. Request enters through `src/app.ts` CORS and middleware setup
2. Logger middleware (`logRequest`) logs all `/api/*` requests
3. JWT middleware (`verifyToken`) protects all `/api/app/*` routes, extracting user from token and attaching to `req.user`
4. Route handlers in `src/routes/*.route.ts` define endpoints
5. Validation middleware (`validateMiddleware`) validates request using Zod schemas from `src/validators/`
6. Controllers in `src/controllers/*.controller.ts` handle request/response
7. Services in `src/services/*.service.ts` contain business logic and database operations
8. Global error handler (`errorHandler`) catches all errors, especially `APIError` instances

### Authentication & Authorization

- Uses Google OAuth for authentication via `google-auth-library`
- JWT tokens stored in HTTP-only cookies
- Token contains `{ id: string, internal_id: number }` payload
- All authenticated routes must be under `/api/app/*` to be protected by JWT middleware
- User information available via `req.user` in protected routes (see `src/types/express.d.ts` for type augmentation)

### Database Layer

- **ORM**: Drizzle ORM with PostgreSQL adapter (`postgres` package)
- **Schema location**: `src/database/schemas/` - one file per table
- **Database client**: `src/database/client.ts` exports singleton `db` instance
- **Connection**: Uses `DATABASE_URL` from environment variables
- **Schema structure**:
  - `users` - User accounts (Google ID, email, name, profile pic)
  - `friends` & `friendRequests` - Friend relationships
  - `groups` & `groupMembers` - Expense groups with members
  - `expenses` & `expenseMembers` - Expenses with split details (who paid, who owes)
  - All tables have `internal_id` (serial PK) and `id` (UUID) for external references

### Expense System

The core domain model centers around expenses and their split calculations:

- **Expenses** can be regular expenses or transactions (direct payments between users)
- **Split modes**: Expenses track how costs are divided (equal, unequal, percentage-based)
- **Expense members**: Junction table tracking `paid_amount` and `owed_amount` per participant
- **Balance calculation**: Services compute net balances from expense member data using efficient queries with CTEs
- **Transaction handling**: Direct user-to-user payments are modeled as special expenses with `is_transaction: true`

When editing expense logic, pay attention to:
- The `expense.service.ts` contains complex balance calculation logic using CTEs and aggregations
- Updates must maintain balance consistency across all group members
- The `expenseMembers` table is the source of truth for financial data

### Validation Pattern

All endpoints follow a consistent validation pattern:

1. Zod schemas in `src/validators/*.validator.ts` define structure for `{ body, query, params }`
2. `validateMiddleware(schema)` applied in route definitions
3. Schemas validate shape, types, and business rules (e.g., UUIDs, min/max values)
4. Validation errors return 400 with descriptive messages from Zod

### Error Handling

- Use `APIError` class for operational errors with appropriate status codes
- Constants defined in `src/lib/constants.ts` (e.g., `STATUS_CODES.NOT_FOUND`)
- Throw errors in services/controllers - global error handler catches them
- Non-operational errors (programming errors) will be caught and logged with stack traces

### Environment Variables

Required environment variables (see `src/server.ts` for validation):
- `DATABASE_URL` - PostgreSQL connection string
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `JWT_SECRET` - Secret for signing JWT tokens
- `FRONTEND_URL` - CORS-allowed frontend origin
- `PORT` - Server port (defaults to 3000 if not set)

### Code Organization

- **Routes**: Thin layer defining HTTP endpoints and applying middleware
- **Controllers**: Handle request/response cycle, call services, return formatted responses
- **Services**: Business logic, database queries, complex computations
- **Types**: TypeScript interfaces in `src/types/*.types.ts` for domain models and DTOs
- **Utils**: Helper functions in `src/lib/utils/` for reusable logic
- **Middlewares**: Cross-cutting concerns (auth, validation, logging, error handling)

### TypeScript Configuration

- Uses `nodenext` module resolution with ESM (`.ts` extensions required in imports)
- Strict mode enabled with additional strictness flags (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`)
- Output directory: `dist/`
- All source code must be in `src/` directory

## Development Notes

- The application uses cookie-based authentication - ensure CORS credentials are properly configured
- Database connection is validated on startup with `SELECT 1` query
- Logger utility (`src/lib/utils/logger.ts`) provides consistent logging interface
- When adding new routes, follow the pattern: define route → add validator → implement controller → implement service
- Group membership validation is critical - most operations require verifying the user belongs to the group
