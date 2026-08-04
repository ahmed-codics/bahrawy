# Architecture & System Design

**Production Profile (Lean V1):**

- **Host:** Hostinger KVM 4 VPS (4 vCPU, 16 GB RAM, 200 GB NVMe, 16 TB Transfer)
- **Deployment:** Docker Compose (Single-VPS modular monolith)
- **Edge:** Cloudflare Free (DNS, TLS, WAF, Turnstile, Access)
- **Database:** PostgreSQL (Authoritative for all critical data)
- **Cache/Queue:** Valkey (Session cache, BullMQ for outbox/background jobs)
- **Storage:** Hostinger Local NVMe volumes (HLS and private files) outside web roots.
- **Backups:** Cloudflare R2 (encrypted database dumps and configs)
- **Video Origin:** Direct DNS pointing to Hostinger (Nginx signed HLS delivery)

**Component Boundaries:**

- `api` (NestJS 11): REST API, transactional commands, query resolution.
- `worker` (NestJS 11): Outbox processor, report generation, async file scanning (ClamAV).
- `academy-web` (Next.js 16): Student and Guardian PWA (React 19, Server Components).
- `staff-admin` (Next.js 16): Staff Portal.
- `domain` (TypeScript): Framework-agnostic rules, state machines, entity types.
- `db` (Prisma): Prisma schema and generated clients.
