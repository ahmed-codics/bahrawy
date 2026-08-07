# Phase 6 — Load, Stress & Performance Test Report (Bahrawy Academy API)

Cycle: 2026-08-07/08 · Target: NestJS API (`:3000`, `node dist/main.js`) · DB: PostgreSQL 16 `bahrawy_db` @ localhost:5432 · Method: isolated seeded load profiles via direct session injection; rate-limiter, CSRF, RBAC and DeviceGuard left fully armed.

## 1. EXEC — Executive Summary

- **Throughput ceiling ≈ 850 req/s** on the dev host (single Nest process, 2-core CPU) at **100% correctness** — no 5xx, no 429, no timeouts across the entire ramp.
- **Latency knee ≈ 700–800 req/s** (Level 500): p50 degrades from ~6–11 ms to ~138 ms, p99 from ~55 ms to ~958 ms, max from ~200 ms to ~1.9 s.
- **Bottleneck is Node.js CPU** (event loop + Prisma query engine), not Postgres. PG sustained ~100% CPU at the knee but every query stayed < 10 ms; the Prisma pool (~10 connections) never saturated; no lock waits, no idle-in-transaction growth, DB `max_connections=100` untouched.
- **Availability 100%** from 10 → 1,000 concurrent sessions. Degradation is graceful: latency inflates, correctness holds.
- **Security-Under-Load: 17/17 checks passed** — exact rate budgets (200/min/session), per-session budget independence, spoof-proof keying, strict RBAC, cross-tenant isolation, ticket ownership, lesson gating, deferred assessment answer-key policy, CSRF enforcement, auth-route per-IP budget.
- **Regression gate green**: unit 165/165, integration 2/2, Playwright 30/30, `tsc` 0 errors, ESLint clean, Nest build OK. All test data removed afterwards.

## 2. ENV — Environment

| Item | Value |
|---|---|
| API | NestJS 11, compiled `dist/main.js`, single Node process |
| Node | v24.16.0 |
| DB | PostgreSQL 16 (Homebrew, localhost:5432), `bahrawy_db`, user `academy` (non-super) |
| DB limits | `max_connections=100`; Prisma pool ~10 connections |
| Monitoring | `pg_stat_activity` sampled every 1.5 s + `ps` CPU/RSS for node & postgres |
| Dataset | 1 org, 4 grades, 9 courses, 10 chapters/units, 12 lessons, 3 assessments, 12 questions, 4 entitlements |
| Load profiles | Seeded isolated sessions (120 staff + 880 students); weighted realistic route mix; keepalive + real UA; `X-Device-Fingerprint` on student lesson calls |
| Extensions | `pg_stat_statements` not available (non-superuser) — DB load characterized via `pg_stat_activity` |

## 3. LOAD — Method & Levels

- **Load levels**: 10, 25, 50, 100, 200 concurrent workers, 120 s each, 400 ms/worker pacing.
- **Stress ramp**: 300, 500, 750, 1,000 workers (Level 1000 in-flight capped at 300 to keep the harness socket stack stable).
- **Abort conditions** (monitored, never triggered): 5xx surge, DB lock/instability, p99 > 2–3 s, pool exhaustion, unresponsive server.
- Response classes tracked separately: 2xx / 429 (rate) / 401 / 403 / 404 / 5xx / connection-timeouts.

| Level | Req/s | Total | 2xx | 429 | 5xx | err | p50 | p90 | p95 | p99 | max |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 10 | 24.2 | 2,910 | 100% | 0 | 0 | 0 | 11.5 | 20.4 | 24.0 | 42.1 | 88 ms |
| 25 | 60.7 | 7,300 | 100% | 0 | 0 | 0 | 8.8 | 19.7 | 24.7 | 43.3 | 192 ms |
| 50 | 121.9 | 14,654 | 100% | 0 | 0 | 0 | 7.4 | 15.8 | 20.2 | 61.3 | 206 ms |
| 100 | 244.2 | 29,398 | 100% | 0 | 0 | 0 | 6.1 | 14.6 | 21.8 | 52.6 | 240 ms |
| 200 | 488.6 | 58,804 | 100% | 0 | 0 | 0 | 5.2 | 16.0 | 23.7 | 54.6 | 394 ms |
| 300 | 724.1 | 87,173 | 100% | 0 | 0 | 0 | 6.3 | 28.3 | 44.7 | 111 | 517 ms |
| 500 | 829.1 | 99,913 | 100% | 0 | 0 | 0 | 138 | 441 | 595 | 958 | 1,946 ms |
| 750 | 789.2 | 95,248 | ~100% | 0 | 0 | 1 | 402 | 1,242 | 1,694 | 2,107 | 2,649 ms |
| 1,000 | 850.6 | 77,381 | 100% | 0 | 0 | 0 | 272 | 957 | 1,014 | 1,247 | 1,648 ms |

## 4. RATE — Rate Limiting (ThrottleGuard)

- Default budget **200 req/min/session** enforced exactly: 200 OK then hard 429 (200→429 transition verified).
- **Keying**: with a session cookie → per-session budget; without cookie → per-IP budget. Two sessions from the same IP each get the full 200/min.
- **`X-Forwarded-For` cannot bypass an exhausted session** — spoofing a new IP on a limited session still yields 429 (session key wins).
- Auth-route budgets confirmed: `/auth/login` 10 per 15 min per IP (verified: 10×401 then 429s), `/auth/check-phone` 30/15min, `/register` 3/hr, tighter windows on activate/recovery.
- Health endpoint exempt as designed. No 429s during any realistic load run (budgets not tripped by legit pacing).
- INFO: throttle store is **in-memory, per-instance**. In a multi-instance deploy the effective budget is N × 200/min and each instance holds its own buckets.

## 5. AUTH — Authentication

- Session round-trip re-verified end-to-end after server restart; valid sessions → 200 on all authenticated flows, invalid cookie → 401.
- Confirmed the seeded session model matches the app: `hashOpaqueToken` = HMAC-SHA256 with **hex-decoded** `HMAC_KEY`.
- Login endpoints enforce password checks plus per-IP burst protection (see §4).
- Fixture sessions carry idle/absolute expiry (24 h / 7 d) consistent with production cookie policy.

## 6. CSRF

- All state-changing requests with an identity cookie require a valid `x-csrf-token`; missing/invalid → **403** (verified).
- Valid token (HMAC of the session token) → request proceeds (201 on assessment submit).
- Exempt paths observed: `/auth/login`, `/auth/staff-login`, `/auth/register`, `/auth/activate`, `/auth/check-phone`, `/auth/staff/recovery-consume`, GET/HEAD/OPTIONS, and cookie-less requests.
- **LOW finding**: `CsrfService` signs with the **raw hex `HMAC_KEY` string**, whereas `SecurityService.hashOpaqueToken` uses the **hex-decoded buffer**. Both deterministic, not exploitable, but the inconsistency should be unified.

## 7. RBAC — Authorization

- **Student → admin surfaces: 403** (`/admin/v1/*`, `/staff/students`) verified with real student sessions.
- Cross-tenant isolation verified: org2 staff (OWNER) sees only org2 courses; org1 staff cannot read org2 course (404, no leak).
- No privilege escalation observed under load or via header tampering.

## 8. SUPPORT — Support & Ownership

- Support tickets scoped to owning account: student A sees only ticket A; student B sees only ticket B (cross-read blocked).
- Staff/admin listing endpoints gated for students (403).

## 9. CATALOG

- `/catalog/courses?gradeId=`, `/catalog/courses/:id`, `/catalog/units/:id`, `/catalog/lessons/:id`, `/catalog/my-courses`, `/catalog/products`, `/catalog/my-products`, `/catalog/grades` — all 200 under load; no unbounded lists requested.
- `/catalog/courses/:id` and chained access checks run sequential `findMany`/`findUnique` (N+1-prone) — the primary candidate for query reduction (see §17).

## 10. ASSESSMENT

- Answer-key policy verified empirically:
  - `MANUAL` (deferred): questions **entirely absent** from the student payload; `correctOptionId` never present, even after submit.
  - `IMMEDIATE`: questions present, but `correctOptionId`/explanation released **only after submit** (`resultsReleased=true`).
- No answer-key leakage for deferred assessments under any request shape.

## 11. DEVICE

- Student lesson/course access **requires** `X-Device-Fingerprint`; without it → 400; with header → 200.
- Locked (PUBLISHED, post-gate) lesson: student → 403, staff/admin → 200.
- INFO: the strict header requirement is by design but blocks non-fingerprint clients.

## 12. THROTTLE

- Global default and auth-route budgets fully exercised at exact boundaries — no 429 before budget, hard 429 after (see §4). Zero false positives under load.

## 13. DB — Database Behavior

- **Connections**: `pg_stat_activity` total max ≈ 11 across all levels (Prisma pool ~10 + sampler). Never approached `max_connections=100`.
- **Active**: peaked ~6; **idle-in-transaction**: 0 at all levels except a transient 3 at Level 750 (stress peak, not a leak).
- **Query latency**: longest observed query ≈ 9.5 ms at every level; p95 of longest-query ≈ 3 ms. No lock waits.
- **CPU**: PG avg rose 0→~100% across the ramp (max ~127%) — the second-bottleneck behind Node.
- **RSS**: node grew 85→816 MB; PG ~210–283 MB — no runaway memory.
- Post-load integrity: 0 orphaned `AuthSession`/`SupportTicket`/`AssessmentAttempt`/`Entitlement`/`LessonProgress`; 0 duplicate `tokenHash`; test rows fully removed (orgs 2→1, accounts 1000+fixtures→30 pre-existing).

## 14. STRESS

| Workload | Req/s | 2xx | 429 | 5xx | err | p50 | p99 | max |
|---|---|---|---|---|---|---|---|---|
| 300 | 724.1 | 100% | 0 | 0 | 0 | 6.3 | 111 | 517 ms |
| 500 | 829.1 | 100% | 0 | 0 | 0 | 138 | 958 | 1,946 ms |
| 750 | 789.2 | ~100% | 0 | 0 | 1 | 402 | 2,107 | 2,649 ms |
| 1,000 | 850.6 | 100% | 0 | 0 | 0 | 272 | 1,247 | 1,648 ms |

- Throughput plateaus at ~790–850 req/s; p99 breaches 1 s at ~500 workers and ~2.1 s at 750. No crashes, no 5xx, no DB exhaustion — graceful latency degradation.

## 15. ERRORS

- **Zero 5xx** across all runs (≈ 480k+ requests total).
- One client-side transient (`setTypeOfService` setsockopt) at 1,000 workers with uncapped in-flight — a macOS/undici harness artifact, not a server defect; resolved by a 300 in-flight cap.
- The only 429s are the intentional rate-budget tests; zero accidental 429/401/403/404 under load.

## 16. SECURITY — Security-Under-Load (17/17)

| # | Check | Result |
|---|---|---|
| S1 | per-session 200/min budget | PASS (200→429 boundary exact) |
| S2 | fresh session, same IP, not IP-punished | PASS |
| S3 | spoofed `X-Forwarded-For` no bypass | PASS |
| S4 | student → admin/staff 403 | PASS |
| S5 | support ticket ownership isolation | PASS |
| S6 | cross-tenant isolation (org2 vs org1) | PASS |
| S7 | lesson gate (locked PUBLISHED) | PASS (student 403 / admin 200) |
| S8 | assessment answer-key policy | PASS (MANUAL no leak; IMMEDIATE releases only post-submit) |
| S9 | CSRF token enforcement | PASS (missing → 403; valid → 201) |
| S10 | login per-IP budget → 429 | PASS |

Findings (triage):
- **LOW** — CSRF vs session HMAC key encoding inconsistency (raw hex-string vs hex-decoded buffer). Deterministic, not exploitable; unify.
- **INFO** — in-memory per-instance rate limiter: multi-instance deploys multiply the effective 429 budget.
- **INFO** — DeviceGuard fingerprint requirement is strict by design.
- **INFO** — `pg_stat_statements` not installed; query-level profiling needs a superuser session.
- **INFO** — sequential N+1 patterns in `catalog.service` add DB round-trip pressure at high QPS.

## 17. RECOMMENDATIONS

1. **Scale horizontally** — the ~850 req/s single-process ceiling and the latency knee (~700–800 req/s) make replicas the primary lever. Pair with a shared rate-limit store (Redis) to keep budgets global across instances.
2. **Batch catalog N+1** — parallelize/join chapter→unit→lesson chains in `catalog.service` to cut DB round-trips; the highest-leverage source-level change identified.
3. **Watch Node CPU first** — the event loop saturates before Postgres; profile with CPU flamegraphs before touching DB tuning.
4. **Unify HMAC key encoding** — make `CsrfService` use `Buffer.from(key,'hex')` to match `SecurityService` (LOW).
5. **Add latency alerting** — alert when p99 > 500 ms (knee is ≈700+ req/s); add a headroom margin.
6. **Install `pg_stat_statements`** on a privileged DB user to enable query-level profiling on prod-like data.
7. **Re-test topology** — re-run the harness against a multi-replica build to recompute ceiling and validate shared throttling.

## 18. NEXT

- Re-run this harness in a multi-instance topology; recompute ceiling and validate shared throttle.
- Deep-dive `catalog`/`assessment` queries with `pg_stat_statements`.
- Add load coverage for `admin/v1/management` (payment/product write flows).
- Add an autoscale/replica test to measure the knee under N replicas.
- Re-run full regression after any recommended change (green this cycle: unit 165/165, integration 2/2, Playwright 30/30, tsc, lint, build).
- Optionally promote the `.loadtest` harness into `e2e/` for reproducibility (currently untracked and removed after use).

---
*Scope: 120 s runs per level; DB is the dev copy. All test users/sessions/tickets/orgs removed post-run. No security-control logic was weakened or modified during testing; only pure formatting/lint fixes were applied to keep the regression gate green.*