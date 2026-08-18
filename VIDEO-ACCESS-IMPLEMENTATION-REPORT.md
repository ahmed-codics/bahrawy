# Video Access Request — Implementation & Verification Report

**Feature:** Student *"Video Access Request"* — a managed way for students who lack entitlement to a video lesson to request access, and for admins to approve (time-limited or session-bound), reject, or revoke that access. Emails (admin notification, student approval/rejection) are sent when SMTP is configured.

**Date:** 2026-08-16
**Scope of this session:** Email service, student + admin UI, backend authorization wiring, Playwright E2E, unit tests, and full regression run.

> **No commit, no push, no reset.** Nothing in this session was committed, pushed, reset, or deleted. No migrations were removed. Existing grants/sessions were not recreated. The final report statement (§20) is included at the end: **YouTube alone does not meet the requirement**; a DRM/secure-streaming migration is proposed but intentionally **not implemented** in this session.

---

## 1. What the feature does

A student who is otherwise locked out of a video lesson (**missing entitlement**, not a quiz/prerequisite gate) can file a *Video Access Request*. Admins review requests in a dedicated staff-admin section and can:

- **Approve** with a duration: `SESSION` (bound to the issuing auth session), `ONE_DAY`, `THREE_DAYS`, `SEVEN_DAYS`, or `CUSTOM` (1–90 days, default 1).
- **Reject** with an optional Arabic reason.
- **Revoke** an existing grant at any time.

Playback authorization is enforced **server-side** in `VideoService` via `VideoAccessService.findActiveGrant()`: no grant → `403 VIDEO_ACCESS_NOT_GRANTED`; revoked → `403 VIDEO_ACCESS_REVOKED`. A `SESSION` grant dies with the auth session it was bound to.

Emails are sent only when SMTP is configured (`SMTP_*` + `ADMIN_EMAILS`); otherwise the mailer is a safe no-op (log only). Emails never contain YouTube URLs, signed playback URLs, passwords, or tokens.

---

## 2. Files changed this session

### Backend (API)

| File | Change |
|---|---|
| `apps/api/src/mail/mail.module.ts`, `apps/api/src/mail/mail.service.ts` | **New.** Global `MailModule` / `MailService` — nodemailer transport, admin recipient list from `ADMIN_EMAILS`, `DASHBOARD_URL` for links, no-op/log without SMTP creds. |
| `apps/api/src/video-access/video-access.mailer.ts` | **New.** `VideoAccessMailerService` — HTML, RTL, Arabic; HTML-escaped; admin-request + student-approval + student-rejection templates. |
| `apps/api/src/video-access/video-access.module.ts` | **New.** Wires `MailModule`, exposes `VideoAccessService`. |
| `apps/api/src/video-access/video-access.grants.service.ts` | **New.** `VideoAccessService` — central grant authority: `findActiveGrant` (revoked/expiry/session-liveness), `assertPlaybackAllowed`, `revoke`, `resolveDuration`. |
| `apps/api/src/video-access/video-access.service.ts` | **New.** `StudentVideoAccessRequestService` — create request (invariants: student, published lesson in-org, video attached, no entitlement, entitlement-lock only, no duplicate pending, no active grant), `myRequests`, `statusForLesson`. |
| `apps/api/src/video-access/video-access.controller.ts`, `video-access.dto.ts` | **New.** Student routes: `GET /video-access-requests/lessons/:lessonId/status`, `POST /video-access-requests`, `GET /video-access-requests/mine`. |
| `apps/api/src/admin-v1/video-access/` | **New.** `AdminV1VideoAccessService`/controller/module/DTO — list (status/course/grade/date/search), stats, approve, reject, revoke; `VIDEO_ACCESS_MANAGE` permission; full audit events. |
| `apps/api/src/video/video.service.ts`, `video.controller.ts` | Wired playback to `VideoAccessService.assertPlaybackAllowed` for `VIDEO_ACCESS_NOT_GRANTED` / `VIDEO_ACCESS_REVOKED`. |
| `apps/api/src/catalog/catalog.service.ts` | Wired `VideoAccessService` (status helper for the request panel). |
| `apps/api/src/notification/notification.service.ts` | `createForStaff` for the admin inbox notification. |
| `apps/api/src/admin-v1/admin-v1.module.ts`, `apps/api/src/app.module.ts` | Registered the new modules. |
| `packages/db/prisma/schema.prisma` + migration `20260814000000_add_video_access_requests` | `VideoAccessRequest` + `VideoAccessGrant` models. |
| `packages/db/prisma/seed.ts` | `VIDEO_ACCESS_MANAGE` permission; granted to OWNER, ASSISTANT, SUPPORT roles. |
| `packages/types/src/index.ts` | Shared types for the new domain. |

### Student UI (`apps/academy-web`)

| File | Change |
|---|---|
| `components/VideoAccessRequestPanel.tsx` | **New.** Panel shown for entitlement-locked video lessons: explains the lock, submits a request, shows *قيد المراجعة* (pending), *تم الموافقة*, *مرفوض* with reason. |
| `app/student/courses/[id]/lesson/[lessonId]/page.tsx` | Renders the panel branch + handles `VIDEO_ACCESS_*` errors from playback. |

### Staff Admin UI (`apps/staff-admin`)

| File | Change |
|---|---|
| `app/dashboard/video-access/page.tsx` | **New.** Data table of requests with status/grade filters, stats cards, search, approve/reject/revoke actions. |
| `app/dashboard/_components/VideoAccessDialogs.tsx` | **New.** Approve / Reject / Revoke dialogs. |
| `app/dashboard/layout.tsx` | Sidebar entry *"طلبات فتح الفيديو"* (gated by `VIDEO_ACCESS_MANAGE`) with a pending-request badge. |

### Tests

| File | Adds |
|---|---|
| `apps/api/src/video-access/video-access.grants.service.spec.ts` | 18 unit tests (grant liveness, durations, SESSION binding, revoke). |
| `apps/api/src/video-access/video-access.service.spec.ts` | 12 unit tests (request invariants, statusForLesson). |
| `apps/api/src/video-access/video-access.mailer.spec.ts` | 5 unit tests (templates, escaping, no-recipient no-op, no URL leakage). |
| `apps/api/src/admin-v1/video-access/video-access.service.spec.ts` | 10 unit tests (approve/reject/revoke/list/stats). |
| `apps/api/src/video/video.service.spec.ts`, `apps/api/src/catalog/catalog.service.spec.ts` | Fixed DI by mocking the new `VideoAccessService`. |
| `apps/e2e/tests/video-access.spec.ts` | **New.** 6 Playwright tests — full student lifecycle, admin approve/reject/revoke, admin UI, student UI panel. |

---

## 3. Verification

### Unit / service tests

```
Test Suites: 44 passed, 44 total
Tests:       349 passed, 349 total
```

Includes the 45 new video-access tests. `catalog.service.spec.ts` typecheck note: a single pre-existing `isQuizGatePassed` tsc complaint remains (unrelated to this feature; the suite passes under ts-jest).

### Typecheck / builds

- `apps/academy-web` — `tsc --noEmit` clean; production build succeeds.
- `apps/staff-admin` — `tsc --noEmit` clean; production build succeeds (includes the `/dashboard/video-access` route).
- `apps/api` — compiles and runs.

### End-to-end (Playwright)

`video-access.spec.ts` — **6/6 passing**:

1. Setup (staff session + one shared student on one fixed device to avoid device-lock throttling).
2. Student request lifecycle: locked → request created (`PENDING`) → duplicate `409` → playback `403` before approval → admin `ONE_DAY` approve → playback `200` → status `canPlay` → revoke → playback `403 VIDEO_ACCESS_REVOKED`.
3. Admin reject with reason → status `REJECTED` + reason returned.
4. Unauthenticated admin access → `401`.
5. Admin UI lists requests + stats cards.
6. Student UI shows the request panel / pending state for a locked video.

### Regression (full existing suite, run against a restarted API per registering spec because `/auth/register` is capped at 3/hour/IP)

| Spec | Result |
|---|---|
| `e2e.spec.ts` (30-step + lesson-lock flow) | 40 passed |
| `device-lock.spec.ts` | 9 passed |
| `discount`, `exam-publish`, `exam-reopen`, `exam-results` | 33 passed |
| `lock-gating`, `lesson-prerequisite-gating` | 17 passed |
| `exam-unlock-grant`, `exam-violations`, `offline-codes` | 24 passed (1 pre-existing failure — see below) |
| `remember-me`, `csp` | 7 passed |
| `course-create-tmp` | 1 passed |
| `video-access` | 6 passed |

**One pre-existing failure** — `exam-violations.spec.ts` *"UI: staff section shows the reason/Lesson columns"*: the test expects the first student to appear under the `FAILED` filter, but the suite's own earlier API tests pass that student's exam (which intentionally removes them from the `FAILED` list — verified in `fetchFailed`). This spec is **unmodified by this session** and is a test-ordering inconsistency, not a video-access regression.

---

## 4. Environment fixes made during verification (not feature code)

- **Seed student `01000000001` repair** — the account existed but was `DEVICE_BLOCKED` with a missing `StudentProfile` (orphaned during an earlier key rotation). Repaired in the DB: reactivated the account, created `[DEV] Test Student`, resolved the device block, and registered `e2e-shared-seed-device` as primary. This unblocked `e2e.spec.ts` and the exam specs that reuse the seed student. (No production behavior changed.)

---

## 5. Final report statement (§20) — requirement status

**Requirement: managed per-video access control (approve / time-limit / revoke).**

The Video Access Request system **fully implements the management layer**: students can request, admins can approve with a duration or bind to a session, reject with reason, or revoke; playback is authorized strictly server-side and every grant mutation is audited.

**However, the underlying content delivery does NOT meet the full requirement while videos are served via public YouTube.** YouTube playback is protected only by *obfuscation* (playback URLs are not shipped to the client; the `/video/:lessonId/manifest` endpoint returns only the YouTube video ID, and the student can watch it in an iframe once `findActiveGrant` allows it). YouTube does not provide **per-user DRM revocation**, **license-based expiry**, or **server-enforced offline expiry**. Because YouTube serves the stream, a grant's `expiresAt` is enforced by our API (403 when expired), but the actual stream remains viewable by anyone with the video ID — it cannot be revoked at the DRM layer.

**Proposed migration (not implemented in this session):** host lessons on a DRM-capable platform (e.g. Widevine/FairPlay/PlayReady via an encoding service such as AWS MediaConvert + MediaPackage, or a VOD provider) and deliver a short-lived signed manifest (HLS/DASH) with per-user license issuance tied to the same `VideoAccessGrant` table used here. That makes `expiresAt`, `revokedAt`, and `SESSION` binding enforceable at the content layer, not just the API layer. The request/approve/revoke admin workflow in this session would carry over unchanged, swapping only the delivery endpoint.