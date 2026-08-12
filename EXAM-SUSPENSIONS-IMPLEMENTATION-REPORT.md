# الطلاب الموقوفون في الامتحانات — Implementation & Verification Report

**Feature:** Unified Admin section *"الطلاب الموقوفون في الامتحانات"* (Students suspended/failed in exams)
**Date:** 2026-08-11
**Scope of this session:** Continuation and completion of the prior implementation — filling test gaps, fixing one display bug, and running verification.

> **No commit, no push, no reset.** Nothing in this session was committed, pushed, reset, or deleted. No migrations were removed. No completed security fix was overwritten. The existing `ExamGrant`, the Admin API, and `ExamSessionService` were **not** recreated — only extended by tests and one bug fix.

---

## 1. What this section does

A single Admin screen lists **both** categories in one table, each with a distinct status and reason:

| Category | `caseType` | Example reason (Arabic) |
|---|---|---|
| Suspended for a violation (e.g. left fullscreen) | `SUSPENDED` | `تم إيقاف الامتحان بسبب الخروج من وضع ملء الشاشة` |
| Completed the exam but scored below the pass mark | `FAILED` | `فشل في الاختبار — الدرجة 6/10 — درجة النجاح 7/10` |

A **FAILED** case is explicitly **not** treated as disciplinary suspension — it is a separate `caseType` with its own reason string (`FAILED_REASON`) and no lock/violation metadata. Both appear together and can be filtered.

The columns rendered are: student name, code, grade, course, lesson, exam, score, passing score, attempt count, exam-open count, last-attempt date, status, and reason. Filters (All / Suspended / Failed, plus grade) compose together server-side. Default sort is latest attempt; score, attempts, and opens are also sortable.

The **"فتح الامتحان للطالب"** button performs a real, server-side unlock by creating an `ExamGrant`, which reserves exactly one extra attempt beyond `maxAttempts`. Previous attempts are preserved, and the grant survives refresh/logout because it lives in the database.

---

## 2. Changes made this session

### 2.1 Bug fix — requirement 13 (FAILED display)

**File:** `apps/api/src/admin-v1/exam-violations/exam-violations.service.ts` → `fetchFailed()`

**Symptom:** A student who **failed once and later passed** the same exam still appeared as a `FAILED` row, because the old failed attempt was emitted before the later passing attempt could resolve that (account, assessment) key.

**Fix:** The per-key de-duplication now happens **before** the passing-score check. Because `attempts` is ordered `submittedAt DESC`, the first row seen for a key is the student's **latest** attempt. The `FAILED` decision is now made solely from that latest attempt:

- latest attempt **passed** → key is marked seen and the row is skipped → student correctly **drops off** the list;
- latest attempt **failed** → a `FAILED` row is emitted even if an earlier attempt passed.

This aligns the Admin display with the pass-based lesson-gating already enforced in `catalog.service.ts` (an old failed attempt never keeps the next lesson locked after a later pass).

### 2.2 Tests added

| File | Type | Adds |
|---|---|---|
| `apps/api/src/admin-v1/exam-violations/exam-violations.service.spec.ts` | Jest unit | 2 tests: *"drops a student from FAILED once their latest attempt passes"* and *"keeps a student in FAILED when their latest attempt is a fail after an earlier pass"* |
| `apps/api/src/exam-session/exam-session.grants.spec.ts` | Jest unit (new) | `createGrant` payload, `availableGrants` filter, `consumeGrant` (oldest-first bind), `NO_EXAM_GRANT` on none, cross-student isolation |
| `apps/e2e/tests/exam-unlock-grant.spec.ts` | Playwright E2E (new) | Fail → blocked (403) → appears as FAILED → student cannot unlock (401/403) → unknown student 404 → admin unlock grants exactly one retake (`unlockedByAdmin:true`, 2 attempts preserved, then 403 again) → student A's grant does not help student B |

No production code other than the one `fetchFailed` fix was modified.

---

## 3. Requirement coverage (static verification)

Every item below was verified by reading the actual source; the referenced tests assert the behaviour at runtime once executable.

- **Unified list, both categories, distinct reason/status** — `list()` merges `fetchSuspended` + `fetchFailed`; covered by the *SUSPENDED* and *FAILED* unit tests.
- **FAILED is not disciplinary** — separate `caseType`, `FAILED_REASON`, `sessionId:null`, no lock fields.
- **All columns present** — verified in the row shape built by both fetchers and consumed by `page.tsx`.
- **Composable filters (case type + grade)** — `includeSuspended`/`includeFailed` flags + `accountWhere.studentProfile.gradeId`; covered by *"filters FAILED rows by grade"* and *"excludes FAILED rows when only SUSPENDED is requested"*.
- **Sorting (latest default, score, attempts, opens)** — `sortBy`/`direction` in `ExamViolationsQuery`.
- **Real server-side unlock, survives refresh/logout** — `unlock()` → `createGrant()` persists an `ExamGrant` row.
- **Grant is student- + exam-scoped; no cross-student use; no duplicate attempts; maxAttempts still enforced; unlock = exactly one extra attempt** — enforced in `assessment.service.ts` (`grantedAttempts <= 0` gate, `consumeGrant` on start) and `exam-session.service.ts` (`accountId`+`assessmentId`+`usedAt:null`+`usedAttemptId:null` filter, oldest-first). Covered by the grant unit spec and the E2E isolation + "one extra attempt" tests.
- **Previous attempts preserved** — no delete anywhere; E2E asserts `results.length === 2` after the granted retake.
- **Requirement 13 (old failed attempt must not keep lesson locked, nor keep showing FAILED, after a later pass)** — backend gating is pass-based (`score >= passingScore`, any attempt) in `catalog.service.ts`; the Admin display bug is now fixed and covered by the 2 new unit tests.
- **Direct-URL backend security / student isolation** — controller guarded by `SessionAuthGuard` + `PermissionsGuard` + `@RequireAdminPermission(ASSESSMENT_MANAGE)`; `unlock()` re-checks the student and assessment both belong to the caller's `organizationId`. Covered by E2E (student unlock 401/403, unknown student 404) and the unlock unit tests (rejects foreign student / foreign-org assessment).
- **No sensitive fields exposed** — a grep of the Admin service found no `passwordHash`/`tokenHash`/`secret`/`credential`/`email`/`phone`; `select` clauses pull only display data. Covered by *"never exposes sensitive account/auth fields"*.

---

## 4. Verification status

### 4.1 Static verification — DONE ✅

All source, tests, DTOs, controller routes, UI page/dialog, and shared primitives were read and cross-checked for mutual consistency. Specifically confirmed:

- Route path `POST /admin/v1/exam-violations/assessments/:assessmentId/students/:accountId/unlock` matches the E2E and the UI caller.
- `/auth/me` returns `data.accountId` and `data.profileId` — matching the E2E's row-matching keys.
- `ExamSessionService` grant method signatures (`create` / `count` / `findFirst orderBy createdAt asc` / `update where:{id}` / `NO_EXAM_GRANT`) match the new unit spec exactly.
- `assessment.service.ts` grant-aware gate and `consumeGrant`-on-start match the E2E's 403 → unlock → retake → 403 sequence.
- No sensitive fields in any Admin `select`.

### 4.2 Runtime verification — BLOCKED ⛔ (environment)

**The following could not be executed in this session because no shell was available** — the isolated workspace never finished booting across the entire session ("Workspace still starting" on every attempt), and no alternative shell tool exists in this environment.

Not run (recommended commands for when a shell is available):

```bash
# API unit tests (the changed + new specs)
pnpm --filter @bahrawy/api test -- exam-violations.service.spec exam-session.grants.spec assessment.service.spec

# Full API test suite
pnpm --filter @bahrawy/api test

# Typecheck, lint, production build
pnpm -w typecheck
pnpm -w lint
pnpm -w build

# Playwright E2E (requires API + web running, DB seeded)
pnpm --filter @bahrawy/e2e test -- exam-unlock-grant.spec.ts

# DB integrity spot-checks
#  - no orphan grants:      grants whose accountId/assessmentId no longer exist
#  - no duplicate live use: no two attempts share one grant's usedAttemptId
#  - old attempts intact:   failed attempts still present after a granted retake
```

Because these were not executed, the tests above are **statically consistent but unproven at runtime**. This is the one open item.

---

## 5. Bottom line

The feature is code-complete and internally consistent: the FAILED-after-pass display bug is fixed, and the previously missing grant unit spec and FAILED-unlock E2E are in place. The only remaining step is to run the test/build commands in section 4.2 in an environment with a working shell — everything needed for them to pass has been verified by inspection, but they have not yet been executed here.
