# Database Architecture & Schema Constraints

**Engine:** PostgreSQL (Managed locally in V1, DigitalOcean for HA deferred)
**ORM:** Prisma
**State Management:**

- Valkey: Ephemeral session cache, rate limits, BullMQ.
- PostgreSQL: Authoritative for all accounts, RBAC, orders, progress, and audit.

**Core Rules:**

- Database constraints and transactions must protect all financial and academic invariants.
- No floating versions. Schema migrations must be reversible and explicitly tested from an empty database.
- IDOR prevention is enforced in SQL queries via implicit `organization_id` or `student_id` boundaries.
