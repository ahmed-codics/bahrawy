# Bahrawy Academy - Task Execution Ledger

## Milestones

- `[x]` Milestone 1: Repository, Tooling, Compose, CI & Config
- `[x]` Milestone 2: UI Tokens, Arabic RTL Shell, Shared Components
- `[IMPLEMENTED_PENDING_DATABASE_VERIFICATION]` Milestone 3: Core organization/academic schema plus audit/outbox foundations
- `[IMPLEMENTED_PENDING_DATABASE_VERIFICATION]` Milestone 4: Identity activation, sessions, password recovery, staff TOTP and RBAC
- `[IMPLEMENTED_PENDING_DATABASE_VERIFICATION]` Milestone 5: Student/guardian relationships, roster activation, devices and activity leases
- `[IMPLEMENTED_PENDING_DATABASE_VERIFICATION]` Milestone 6: Catalog, products, pricing, courses, lessons and entitlement-scope resolver
- `[IMPLEMENTED_PENDING_DATABASE_VERIFICATION]` Milestone 7: Private files, ClamAV pipeline and authorized delivery
- `[IMPLEMENTED_PENDING_DATABASE_VERIFICATION]` Milestone 8: Orders, manual payments, ledger, refunds/upgrades and entitlements
- `[IMPLEMENTED_PENDING_DATABASE_VERIFICATION]` Milestone 9: Video Playback and Device Authorization
- `[IMPLEMENTED_PENDING_DATABASE_VERIFICATION]` Milestone 10: Learning Progress and Assessments (MCQ)
- `[IMPLEMENTED_PENDING_DATABASE_VERIFICATION]` Milestone 11: Core Operations and Auditing
- `[ ]` Milestone 12: Production-Ready Edge and CDN
- `[ ]` Milestone 13: Final Polish and Pre-Launch Checklist
- `[ ]` Milestone 14: Lean V1 Launch

## Traceability

- **Specification**: Authoritative Lean V1 requirements (BAHRAWY_ACADEMY_MASTER_IMPLEMENTATION_SPEC.md)
- **Implementation Files**: `packages/db/prisma/schema.prisma`, `packages/db/prisma/migrations/20260714170000_add_m4_auth_and_security/`, `apps/api/src/auth/`, `apps/api/src/rbac/`, `apps/api/src/security/`, `apps/api/src/staff-access/`, `apps/api/src/totp/`
- **Tests**: Jest suites across `packages/` and `apps/`
- **Status**: Milestone 3 & 4 Implemented (Pending DB verification)
