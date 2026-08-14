# Bahrawy Academy — Production Readiness & Security Audit

**Date:** 2026-08-13
**Scope:** 23-phase audit across API (NestJS, `apps/api`), student web (`apps/academy-web`), staff admin (`apps/staff-admin`), and PostgreSQL.
**Method:** Source review + live black-box verification against running dev stack (API :3000, web :3001, staff :3002), with temporary test tenants/accounts that were fully removed afterward.
**Verdict:** **NOT READY FOR PRODUCTION — must fix CRITICAL/HIGH tenant-isolation gaps first.**

---

## 1. Executive Summary

The application has a **very strong authentication, RBAC, anti-cheat, and payment-ledger core** — auth (sessions, CSRF, device lock, expiry, fixation), RBAC, exam integrity, and lesson gating were all verified working correctly. **However, the entire catalog/tenant layer is not organization-scoped**, producing reproducible cross-tenant data leaks at the public catalog, payment, and support levels. This is the single systemic blocker to production.

Findings count by severity:

| Severity | Count | Theme |
|---|---|---|
| CRITICAL | 2 | Cross-tenant payment order creation/approval |
| HIGH | 6 | Cross-tenant data exposure (catalog/settings/support/orders) |
| MEDIUM | 6 | Device-lock spoof, malware scanning stub, CSP gap, storage abuse, etc. |
| LOW | 5 | N+1 queries, throttle reset, client-trusted anti-cheat, etc. |
| INFO | 4 | Dead code, seed data hygiene |

---

## 2. CRITICAL

### C1. Cross-tenant payment order creation — `POST /payment/initiate` not org-scoped
- **Files:** `apps/api/src/payment/payment.controller.ts` (Initiate / createOrder, ~L186–299); `payment.service.ts`
- **Evidence (live):** Org1 student submitted an order for an **org2 product** (`prod-org2-1`) and received a created order `aa2f0132-ff11-4cc3-8b0f-d0822750b30b` with `organizationId=audit-org-2`, amount 9999. The scoped endpoint `GET /payments/order` correctly rejects the org2 product (400), proving the gap is in `initiate` only.
- **Impact:** A student in tenant A can purchase/initiate payment for tenant B's product, submitting payment proofs against another business's catalog. Denial/integrity impact on the other tenant; cross-tenant business confusion; potential revenue/order fraud.
- **Fix:** Resolve the product/price by `organizationId = req.account.organizationId` (like `createOrder` does) and reject if not found or if the product belongs to another org.

### C2. Cross-tenant payment order approval — `reviewPaymentOrder` + `getPendingQueue` unscoped
- **Files:** `apps/api/src/payment/payment.service.ts` (reviewPaymentOrder ~L99; getPendingQueue ~L183)
- **Evidence (live):** `getPendingQueue` returns pending orders for **all organizations**; an org1 staff member with `PAYMENT_MANAGE` can approve/reject any org's order (verified: org2 order visible and actionable from org1 staff).
- **Impact:** Any staff with PAYMENT_MANAGE in any tenant can review/approve/reject another tenant's payments — direct financial control cross-tenant.
- **Fix:** Filter queue and order lookup by the staff member's `organizationId`; enforce in `reviewPaymentOrder` before mutating.

---

## 3. HIGH

### H1. Public catalog is not org-scoped (grades/products/courses/bundles) — cross-tenant leakage
- **Files:** `apps/api/src/catalog/catalog.service.ts` — `getPublicProducts` (L477), `getPublicProduct` (L570), `getBundlesForGrade` (L595), and friends: **no `organizationId` filter anywhere**.
- **Evidence (live):** `GET /catalog/grades` returned org2's grade `grade-org2-1` to anonymous callers; `GET /catalog/products` returned org2 products. `GET /catalog/my-products` for an org1 student returned products whose `organizationId` = `audit-org-2` (95 products, mixed orgs).
- **Impact:** All catalog data across all tenants is publicly readable; org1 students are shown/browsable org2 products and grades.
- **Fix:** Add `organizationId` to every public catalog query (tenant header, settings org, or per-entity column). Derive the tenant from the request (host header or `X-Organization`), not from a global "first org".

### H2. Public org settings leak — `getOrganizationSettings` uses `findFirst()`
- **Files:** `apps/api/src/catalog/catalog.service.ts` L35–44
- **Evidence (live):** `GET /catalog/settings` (public) returns the **first row** of `Organization`, regardless of tenant. During testing it returned org1's name/currency/instapay to everyone.
- **Impact:** Settings (branding, payment instructions) of one tenant are shown to all; with the dev-first-org this is currently benign, but in multi-tenant production it leaks org A's payment details to org B's storefront.
- **Fix:** Scope by the requesting tenant.

### H3. Legacy support staff endpoint is cross-org and permission-less
- **Files:** `apps/api/src/support/support.service.ts` (getTickets uses `where: {}` L6–12); `apps/api/src/support/support.controller.ts`
- **Evidence (live):** Org1 staff (SessionAuthGuard only — no permission check) called the legacy `/support` and saw org2's ticket `ticket-org2-1`. The admin-v1 support endpoint is correctly org-scoped.
- **Impact:** Any logged-in staff in any tenant can read/modify all tenants' support tickets via the legacy route.
- **Fix:** Org-scope the legacy route (or remove it) and require `SUPPORT_MANAGE`.

### H4. `GET /payment/orders/:orderId` — any staff can read any order by ID
- **Files:** `apps/api/src/payment/payment.controller.ts` (getOwnOrder ~L309–319)
- **Evidence (live):** Org1 staff read org2 order `aa2f0132…` (200 SUCCESS) with no org/permission check.
- **Impact:** Order details (amounts, account, product, proof object) readable across tenants by any staff.
- **Fix:** Check `order.organizationId === staff.organizationId` (+ permission).

### H5. Catalog access helpers are org-agnostic
- **Files:** `apps/api/src/catalog/catalog.service.ts` — `hasEntitlementToProduct` (L10), `hasEntitlementToCourse` (L47), `getUnitAccess` (L82)
- **Evidence:** These derive access from entitlements/free-products only, ignoring the product/course org. Since products themselves are cross-org (H1), a student in tenant A can satisfy entitlement checks against tenant B courses/content (free product in org2 → access to org2 lessons/videos/assessments).
- **Impact:** Extends H1 into content access: cross-tenant lesson/video/quiz access for free products.
- **Fix:** After entitlement lookup, verify the product/course `organizationId` matches the requester's org.

### H6. Assessment metadata leak — `listAssessments` unscoped
- **Files:** `apps/api/src/assessment/assessment.service.ts` L445–470
- **Evidence:** `GET /assessments/course/:courseId` returns assessment titles, types, counts and prereq names for **any** courseId; access is only marked in an `available` flag (enforced later at startAttempt).
- **Impact:** Cross-tenant/cross-entitlement exposure of assessment titles and metadata for any course the caller guesses.
- **Fix:** Scope by org and entitlement before returning; return only assessments the student may see.

---

## 4. MEDIUM

### M1. Device lock relies on spoofable client fingerprint
- **Files:** `apps/academy-web/lib/api.ts` (DEVICE_FINGERPRINT_KEY, L15–30); API `DeviceGuard`/`StudentDevice`
- **Evidence (live):** The one-device restriction was verified working (unknown device → DEVICE_BLOCKED). But the "fingerprint" is a `randomUUID` stored in **localStorage** and sent as `X-Device-Fingerprint`. Any user can copy the header from their primary device (or set it arbitrarily) and defeat the lock.
- **Fix:** If one-device-per-student is a real requirement, use a device registration (challenge/HTTPS-only HttpOnly cookie or server-issued device token) rather than a client-stored value.

### M2. Malware scanning is a stub — files auto-APPROVED
- **Files:** `apps/api/src/storage/storage.service.ts` (ClamAvService L139–165; markScanResult L99)
- **Evidence:** `scanFile` returns `'CLEAN'` unconditionally — including when `CLAMAV_ENABLED=true` ("Placeholder — actual implementation…"). Every upload is therefore marked APPROVED and served publicly if referenced by a published course/product.
- **Impact:** Malicious files (e.g. PDF/MP4 with embedded payloads, stored XSS via served content) can be uploaded and served in production as long as the stub is in place.
- **Fix:** Wire a real clamd connection; treat scan ERROR as QUARANTINE; only serve APPROVED + scanned files.

### M3. academy-web ships without security headers (CSP)
- **Files:** `apps/academy-web/next.config.ts` — no `headers()` block. API (:3000) and staff-admin (:3002) both emit CSP (verified live); academy-web emits none.
- **Impact:** No clickjacking/CSP protection on the student app (which handles payment and exam flows).
- **Fix:** Add a Next.js `headers()` config mirroring staff-admin's CSP.

### M4. Any authenticated user may upload large files (storage abuse)
- **Files:** `apps/api/src/storage/storage.controller.ts` (`POST /storage/upload`, L34–113)
- **Evidence:** Requires only `SessionAuthGuard`; allows 500 MB uploads of 5 MIME types; files auto-APPROVED (M2). Any student can fill disk via concurrent uploads (unbounded, no rate limit).
- **Fix:** Role-gate uploads (STAFF / receipt-scoped upload only), lower max size, add per-account throttles, and quarantine until scanned.

### M5. Anti-cheat is client-trusted
- **Files:** `apps/academy-web/app/student/assessments/[id]/page.tsx` (reportViolation L176–206)
- **Evidence (live):** Violations (FULLSCREEN_EXIT/TAB_SWITCH/WINDOW_BLUR) are **reported by the client**; the server locks only when told. A student who disables the listeners / devtools can take the exam with no violations recorded. Server-side enforcement is limited to session expiry + submit blocking.
- **Fix:** Accept as a stated limitation, or enforce server-side signals (e.g. input focus/polling heartbeat that flags silent gaps, backend-driven kill switch).

### M6. Login/register throttles are in-memory per process
- **Files:** `apps/api/src/throttle/throttle.guard.ts`
- **Evidence (live):** Hit `429 Too many requests` during testing; throttle state is per-process and resets on restart (verified twice). In a multi-replica or restarting deployment, brute-force limits can be bypassed by restart/rotation.
- **Fix:** Use a shared store (Redis) for throttle counters in production.

---

## 5. LOW

- **L1** — Offline-code status-flip race (`offline-codes.service.ts` ~L496–537): consumption is protected by an atomic `updateMany` conditional on `useCount < maxUses`, so **over-consumption is prevented**; the stale-`useCount` read only affects the cosmetic USED-status flip. Downgraded from earlier suspicion.
- **L2** — N+1 in `listAssessments`: `getUnitAccess` called per assessment (`assessment.service.ts` L471–478). Minor at expected sizes.
- **L3** — Video progress/resume endpoints lack `DeviceGuard` (`video.controller.ts` L108–133) though they still enforce `canAccessLesson`; defense-in-depth gap only.
- **L4** — Score is returned on submit even for MANUAL-release assessments (own score; matches design, but confirm product intent).
- **L5** — Throttle-reset-on-restart also documented as an operational note (see M6).

---

## 6. INFO

- **I1** — `rotateSession` (auth.service.ts L645) defined, never called; dead code.
- **I2** — Seed data hygiene: 220 ACTIVE entitlements point at DRAFT products; 73 PUBLISHED assessments have no questions (present in dev DB).
- **I3** — DB timestamps are `timestamp without time zone` with `Africa/Cairo` server time while Prisma reads UTC — footgun for any manual/ops queries (use `(now() at time zone 'utc')`).
- **I4** — `X-Frame-Options`/CSP present on API; `Cross-Origin-Resource-Policy: cross-origin` is deliberate (served media).

---

## 7. Verified PASS (no action needed)

- **Auth:** registration validation; login vs nonexistent-user identical 401 (no enumeration); logout revocation; concurrent sessions; unknown-device → DEVICE_BLOCKED; password change revokes all sessions + invalidates old password; no session fixation (new token issued, attacker token rejected); idle + absolute expiry enforced server-side; sliding refresh; remember-me 30d; CSRF 403 on missing/wrong, success with valid; token rotates on new login.
- **RBAC:** SUPPORT role denied `PAYMENT_MANAGE`/`CATALOG_MANAGE` (FORBIDDEN), allowed `SUPPORT_MANAGE`; `mustChangePassword` enforced; admin-v1 endpoints are org-scoped.
- **Exam integrity:** per-attempt + session timers enforced server-side; expired session blocks submit (`EXAM_SESSION_EXPIRED`); attachAttempt doesn't reset expiry; violation → session LOCKED; admin reopen works; legacy submit still respects maxAttempts/expiry.
- **Answer release:** correctOptionId/explanation stripped pre-submit and for MANUAL release; IMMEDIATE reveals by design.
- **Lesson gating:** locked lesson → `LESSON_LOCKED` until previous quiz passed.
- **Suspension:** non-ACTIVE account → session revoked (`ACCOUNT_INACTIVE`), admin setStatus (by profileId + version, VERSION_CONFLICT enforced).
- **Security headers:** API + staff-admin emit strong CSP, HSTS-era headers, nosniff, X-Frame-Options DENY, COOP/CORP, Referrer-Policy.
- **DB integrity:** zero orphans across Account/AuthSession/Entitlement/PaymentOrder/AssessmentAttempt; ledger consistent with APPROVED orders; no over-used offline codes; no duplicate primary devices; entitlements never granted for ARCHIVED products.

---

## 8. Required fixes before production (priority order)

1. Scope the **entire public catalog** by organization (H1, H2, H5, H6) — derive tenant from request, not "first org".
2. Org-scope **payment initiate / queue / review / getOwnOrder** (C1, C2, H4).
3. Org-scope + permission-gate the **legacy support route** (H3).
4. Real **ClamAV** integration + quarantine semantics; gate/limit **uploads** (M2, M4).
5. Device-lock server-issued token or documented acceptance (M1).
6. Add **CSP/security headers** to academy-web (M3).
7. Shared throttle store + staff fingerprint hardening (M5, M6).

## 9. Cleanup verification

All temporary audit data was removed from the DB after testing:
- org2 (`audit-org-2`), its grade/product/price/ticket, and cross-org payment orders (incl. `aa2f0132…`) — **0 rows remain**.
- Audit student (`0eaf89ef…`), SUPPORT staff (`7c82b3e1…`), their sessions/devices/profiles/roles — **0 rows remain**.
- `assess-*` assessments, `ent-*` entitlements, `ticket-org2-*` — **0 rows remain**.
- Org1 restored to `[DEV ONLY] Bahrawy Academy`, currency `EGP`, no instapay/wallet override.
- API restarted clean; `/catalog/settings` and `/catalog/grades` return 200.
