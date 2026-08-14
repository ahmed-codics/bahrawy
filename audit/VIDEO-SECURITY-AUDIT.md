# Bahrawy Academy — Video Content Protection Audit (Phases 1–2)

**Date:** 2026-08-14
**Scope:** 17-phase video-content-protection plan. Phase 1 (architecture audit) + Phase 2 (live black-box security testing) of the video pipeline.
**Stack under test:** API :3000, web :3001, staff :3002, Postgres :5432 (dev `bahrawy_db`). All test accounts/devices were created and fully removed afterward.

---

## Phase 1 — Architecture Findings

### 1.1 Video delivery flow
- Admin uploads video → `VideoUploadArea.tsx` (YouTube URL, R2 presigned PUT, or local upload) → `AdminVideoController` (`admin/v1/video/*`, guarded by Session + Permissions `CATALOG_MANAGE`).
- Student fetches `GET /video/:lessonId/hls` → `VideoService.getLessonPlayback(accountId, lessonId)` → checks `catalogService.canAccessLesson` → returns provider + signed URL.
- Provider dispatch in frontend: `ProviderVideoPlayer.tsx` → YOUTUBE → IFrame Player API (youtube-nocookie); R2/LOCAL → `VideoPlayer` (HLS / `<video>`).

### 1.2 Provider configuration (live)
- **All dev `VideoLesson` records are `YOUTUBE` provider.** No LOCAL/R2 videos exist on disk or in DB.
- `.env` has NO R2 credentials → R2 paths would fail; LOCAL is the only self-hosted path currently viable.
- YouTube videos are publicly playable (verified below) — this is the dominant protection gap.

### 1.3 Security model already in place (verified)
- `SessionAuthGuard`: cookie session (`bahrawy_session_student`), CSRF, session expiry/revocation, account-status enforcement (`Account.status !== ACTIVE` → revoke + 401).
- `DeviceGuard` + `DeviceLeaseService`: per-request `X-Device-Fingerprint`; unknown device → `DEVICE_BLOCKED` + all sessions revoked.
- Lesson gating: `canAccessLesson` (entitlement) + `computeLessonLocks` (previous-lesson-quiz gate → `LESSON_LOCKED`).
- `SecurityEvent` model exists (accountId, phoneHmac, eventType, outcome, metadata) — currently **unused by the video pipeline**.

### 1.4 Identified weaknesses (static review)

| # | Area | Finding |
|---|---|---|
| V1 | `GET /video/:lessonId/stream.mp4` | **No auth guards.** Protected only by a query HMAC token (`token` + `expires`). Token is `HMAC(secret, "${lessonId}:${expires}")` — **not bound to account, session, or device**; replayable by anyone who holds it. |
| V2 | Token TTL | `PLAYBACK_URL_TTL_SECONDS = 8 * 60 * 60` (**8 hours**). Long window for a leaked/shared URL. |
| V3 | Token binding | `verifyLessonVideoToken` only verifies HMAC + expiry. No entitlement re-check at stream time, no account binding, no single-use. `VideoDeliveryToken` model exists but is **completely unused** (dead code). |
| V4 | YouTube videoId exposure | `GET /video/:lessonId/hls` returns the raw YouTube `videoId` in the response body. Anyone with it can open `youtube.com/watch?v=<id>` or embed/download it. |
| V5 | Multi-tenant catalog | `getUnitAccess` free-product fallback is **not org-scoped**; public `GET /catalog/courses` lists all orgs' published courses + lesson IDs. (Consistent with prior audit's H-series findings.) |
| V6 | No watermark | No watermark/session-identifier overlay anywhere in `VideoPlayer`. |
| V7 | No playback security events | No events recorded for video access, playback start, share/replay, or device anomalies. |
| V8 | Admin controls | Admin has upload only; no playback-session revoke, no per-student video-access audit view. |

---

## Phase 2 — Live Black-Box Results

Test student A (registered, no entitlements) and test student B (registered, no entitlements) used against dev stack. **Free course lesson** = `b86b470e…` (active free product + YOUTUBE video). **Paid course lesson** = `a7d31d8f…`. **Locked lesson** = `3318de6c…` (requires previous-quiz pass).

| # | Test | Result | Verdict |
|---|---|---|---|
| T1 | Entitled student requests free-lesson HLS | HTTP 200, returns `{provider:YOUTUBE, videoId:"Iyhac-tl3_c"}` | ✅ works |
| T2 | Catalog lesson detail (entitled) | HTTP 200, `contentUrl: null`, `contentType: VIDEO` | ✅ no URL leak via catalog |
| T3 | Open video directly on YouTube | `youtube.com/watch?v=Iyhac-tl3_c` → **HTTP 200** (public) | ❌ V4 confirmed |
| T4 | Unauthorized (paid) lesson | HTTP 403 `MISSING_ENTITLEMENT` | ✅ gate works |
| T5 | No session | HTTP 401 "Session token missing" | ✅ gate works |
| T6 | Session, no device header | HTTP 401 "Device fingerprint header required" | ✅ gate works |
| T7 | Session, wrong device fingerprint | HTTP 403 `DEVICE_BLOCKED` (account + all sessions revoked) | ✅ device lock works |
| T8 | Suspended account | HTTP 401 "Account is not active"; session revoked server-side | ✅ works |
| T9 | Replay revoked session | HTTP 401 "Session not found or revoked" | ✅ works |
| T10 | Locked lesson (quiz gate not passed) | HTTP 403 `LESSON_LOCKED` with `requiredAssessmentId`/score | ✅ gate works |
| T11 | Cross-course video ID (free vs paid) | Free→200, Paid→403 `MISSING_ENTITLEMENT` | ✅ per-lesson gating |
| T12 | Locked-lesson catalog detail | HTTP 403 (no contentUrl leak) | ✅ |
| T13 | Public catalog multi-tenant | Only 1 org exists in dev; catalog lists 258 published courses unauthenticated | ⚠️ V5 (need 2-org test to confirm cross-tenant) |

### Phase 2 conclusions
1. **Authn, device lock, entitlement, and lesson gating are all strong** — sessions can't be replayed, devices are locked, wrong device kills the account, suspension revokes sessions, quiz gates hold.
2. **The single biggest live vulnerability is YouTube:** the API hands the student a public YouTube video ID; the video opens directly on YouTube (HTTP 200) and can be downloaded/re-embedded freely. No amount of frontend JS can fix this.
3. **The LOCAL/R2 signed-URL token is weak by design** (V1–V3): unauthenticated endpoint, 8h TTL, no account/session/device binding, replayable, no entitlement re-check. Since no LOCAL videos currently exist, this is latent but real.
4. **No watermark, no security events, no admin playback controls** (V6–V8) — all net-new work.

### Not reproduced
- Cross-tenant video access: dev has a single org. Needs a second org + free-product fallback test to confirm V5 end-to-end (code review already shows the fallback is unscoped).

---

## Hardening implemented (2026-08-14)

Safe, non-migratory hardening — no provider migration, no schema change (`VideoDeliveryToken`/`SecurityEvent` already existed).

### V1–V3 (LOCAL/R2 playback tokens) — DONE
- `PLAYBACK_URL_TTL_SECONDS` reduced **8h → 15 min** (`apps/api/src/video/video.service.ts`).
- LOCAL stream token now HMACs `accountId:sessionId:lessonId:expires` (was `lessonId:expires`) and the URL carries `account` + `session` query params → a URL captured by one student can't be replayed by another.
- Each issued LOCAL token is stored in `VideoDeliveryToken` (accountId, sessionId, tokenHash, expiresAt) for audit + revocation.
- `GET /video/:lessonId/stream.mp4` now:
  - verifies token binding (account + session),
  - checks the session is still live (`isSessionLive`: not revoked, not expired, account ACTIVE),
  - re-validates entitlement at request time (`assertEntitlementAtStreamTime`, cached 60s) so a URL dies within ~60s of revocation/suspension.
- Admin preview/anonymous streams still work via non-bound tokens.

### V4 (YouTube videoId) — Mitigated / documented
- The IFrame Player API needs the videoId client-side, so the ID cannot be fully hidden for YouTube playback (structural limitation). Mitigations: only returned to entitled students, not leaked via catalog, and the raw YouTube limitation is documented in Phase 3. **Real fix = provider decision (Phase 10).**

### V6 (watermark) — DONE
- `VideoPlayback` now carries a `watermark` (`B<ACCT6>·<DEVICE6>` derived from accountId + device fingerprint, server-side).
- Rendered as a subtle overlay in both `VideoPlayer` and `ProviderVideoPlayer`/`YouTubePlayer`.

### V7 (security events) — DONE
- `VIDEO_PLAYBACK_ISSUED` (SUCCESS) recorded on every playback issuance.
- `VIDEO_STREAM_DENIED` recorded on invalid/expired token, revoked access, or invalid session at stream time (deduplicated 30s, non-fatal).

### V5 (multi-tenant catalog) — DONE
- `getUnitAccess`: free-product fallback + entitlement query now scoped to the unit's course `organizationId`.
- All public catalog endpoints (`courses`, `grades`, `products`, `products/:id`, `grades/:gradeId/bundles`, `grades/:gradeId/units`, `getUnitsForGrade`) now resolve a **primary organization** and scope every query to it → no cross-tenant enumeration.
- `getOrganizationSettings` already primary-org scoped.

### V8 (admin controls) — DONE
- `GET admin/v1/video/delivery-tokens/:lessonId` — list active delivery tokens (org-scoped).
- `POST admin/v1/video/delivery-tokens/:lessonId/revoke` — revoke ALL issued URLs for a lesson instantly.
- `POST admin/v1/video/delivery-tokens/revoke/:tokenId` — revoke a single token.
- `GET admin/v1/video/security-events?accountId=` — per-account video security audit (org-scoped).

### Verification
- API typecheck clean, `nest build` clean, eslint clean on touched files.
- API unit tests: **299 passed** (was 277) incl. 22 video tests (token binding, watermark, isSessionLive, entitlement re-check, delivery-token admin, YouTube parse).
- Catalog tests: 16 passed.
- UI tests: 17 passed; ui + academy-web typecheck clean.
- Live stack note: the running API (`node dist/main`) predates these changes — restart it to activate.
1. **Bind playback tokens to account + session + device**; short TTL (≤15 min); single-use or sliding-window; entitlement re-check per manifest/segment request. Reuse the existing `VideoDeliveryToken` model (or a signed JWT claim set) instead of the bare `lessonId:expires` HMAC.
2. **Remove the raw YouTube videoId from the API response** and gate the actual video fetch server-side; prefer signed, origin-restricted delivery where possible.
3. **Add a watermark** (session/account identifier) overlay to `VideoPlayer` for LOCAL/R2; add deterrence + security-event logging.
4. **Org-scope the free-product fallback** (`getUnitAccess`) and the public catalog listing.
5. **Record security events** for video access, token issue/use, and device anomalies; expose a scoped admin audit view + playback revoke.
6. **Tests**: extend `video.service.spec.ts` and add Playwright e2e cases for the flows in Phase 2.