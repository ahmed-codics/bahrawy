# Phase 1 Verification Walkthrough

## What is now real

- `/admin/v1/dashboard` requires a valid staff session and `STAFF_MANAGE`.
- Dashboard metrics use the authenticated account's `organizationId`.
- Canonical success responses have exactly one `{ data }` envelope.
- Canonical errors hide internal exception messages, normalize validation failures,
  return a trace ID, and echo it through `x-request-id`.
- Legacy and canonical routes use the same permission metadata and seeded permission
  values.
- Audit payloads redact exact secret fields while preserving business fields such as
  course codes.
- Shared admin tables are typed and support loading, error, empty, sorting, pagination,
  and row-action states.
- The shared drawer supports Escape, focus trapping/restoration, scroll locking, and
  dialog semantics.

## Database evidence

- Migration: `packages/db/prisma/migrations/20260719210000_phase1_foundations/migration.sql`
- Verification: `npm run verify:migrations -w @bahrawy/db`
- Result: every migration was applied in timestamp order to disposable PGlite
  PostgreSQL, required enums/columns were queried, and lifecycle defaults were inserted
  and checked successfully.
- The verifier does not read `.env` or connect to Neon.

## Automated verification

```text
API:         16 suites, 64 tests passed
Shared UI:    4 suites, 16 tests passed
Staff admin:  1 suite,   1 test passed
Typecheck:   API, DB, shared UI, and Staff Admin passed
Prisma:      format and generate passed
```

## Deployment boundary

The migration has not been applied to Neon. Production deployment must start with the
database backup script, followed by migration verification against a restored or
disposable database, and only then `prisma migrate deploy`.
