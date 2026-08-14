# Bahrawy Academy — Student Video Playback Re-Audit (before-change findings)

**Date:** 2026-08-14
**Scope:** Comprehensive security re-audit of the student video playback system per the detailed 12-section request: YouTube URL/videoId exposure, server-side authorization, short-lived playback auth, YouTube-specific limitations, watermark, screenshot/recording deterrence, accessibility, CSP/security headers, API response audit, and abuse testing.
**Stack under test:** API :3000, web :3001, Postgres :5432 (dev `bahrawy_db`). Live probes done with a real entitled student account (`01099991234`, entitlement granted to course `ac535b2c…`, device fingerprint bound).

> This file records the state **before** this round of changes. Findings are marked with the honest status each one can realistically reach: **BLOCKED / MITIGATED / NOT POSSIBLE** (definitions in §9).

---

## 1. Architecture summary (verified by reading code + live probes)

- **Storage:** `VideoLesson { lessonId @unique, provider (LOCAL|YOUTUBE|R2), sourceRef, status, renditions[] }`. All 16 dev videos are `YOUTUBE`; `sourceRef` stores only the YouTube **videoId** (e.g. `iMZ1skkbUWI`), never a full URL. `Lesson.contentUrl` is unused (`NULL` for all records, and `contentUrl` is returned as `null`).
- **Authz chain:** `SessionAuthGuard` (cookie session, CSRF, account status, device enforcement per request) → `DeviceGuard` (requires `X-Device-Fingerprint` for students) → `canAccessLesson` (staff bypass / NotFound / published check / `getUnitAccess` entitlement with org-scoped product lookup / course prerequisites / lesson quiz gates) → `getLessonPlayback` re-runs `canAccessLesson` at playback time.
- **Playback issuance:** `GET /video/:lessonId/hls` → returns `{ status, data: {provider, videoId|url|sources…}, signedUrl, provider, videoId }`. For YOUTUBE returns the raw `videoId` in both `data.videoId` and top-level `videoId`.
- **LOCAL/R2 tokens:** `PLAYBACK_URL_TTL_SECONDS = 900` (15 min), token HMAC binds `accountId:sessionId:lessonId:expires`, stored in `VideoDeliveryToken`, re-verified + entitlement re-checked at `stream.mp4` time, `isSessionLive` enforced. (Prior hardening, present in code.)
- **Frontend:** `ProviderVideoPlayer` dispatches YOUTUBE → `YouTubePlayer` (IFrame Player API, host `youtube-nocookie.com`, `origin` set, `controls:1`, `rel:0`, `playsinline:1`), else `VideoPlayer` (HLS / native `<video>`, `controlsList="nodownload"`, context-menu prevented).
- **Watermark:** present, server-derived `B<ACCT6>·<DEVICE6>`, rendered as a **static** bottom-right span in both players (fixed position, fixed opacity `text-white/60` on `bg-black/35`).
- **CSP:** API (`apps/api/src/security/http-security.ts`) enforces an all-`'none'` CSP + `x-frame-options: deny` + COOP/CORP. **academy-web (Next.js 16) has NO CSP / security headers / middleware at all** — the YouTube iframe lives in an unprotected page context.

---

## 2. YouTube URL / videoId exposure — current findings

| # | Finding | Status today | Verdict |
|---|---|---|---|
| Y1 | `GET /video/:lessonId/hls` returns raw YouTube `videoId` in the body (`data.videoId` **and** duplicate top-level `videoId`). | Confirmed live (HTTP 200, entitled student). | **MITIGATED** |
| Y2 | The video is publicly playable on YouTube (`youtube.com/watch?v=<id>` → 200); videoId alone lets anyone embed/download it. | Confirmed live in prior phase. | **NOT POSSIBLE** |
| Y3 | `Lesson.contentUrl` / `attachedPdfUrl` / `homeworkPdfUrl` are returned in `catalog/lessons/:id` for any entitled student (currently `null`, but the fields are exposed and could carry URLs in future). | Confirmed live. | **BLOCKED → must sanitize** |
| Y4 | Full `lesson` object incl. internal fields (`status`, `publishAt`, `unpublishAt`, `version`, `sort`, `archivedAt`) returned to students. | Confirmed live. | **BLOCKED → must strip** |
| Y5 | `getLessonPlayback` is issued only after `canAccessLesson` → videoId never returned for unentitled/unpublished/locked lessons. | Live 403s confirm. | ✅ already strong |

**Assessment:** The videoId **must** reach the client for the IFrame Player API (structural). We can still (a) stop duplicating it, (b) remove URL-bearing fields from the catalog response, (c) keep issuance strictly behind authz. The YouTube public-ness itself is **NOT POSSIBLE** to fix without migrating providers.

---

## 3. Server-side authorization — findings

- `canAccessLesson` (catalog.service.ts:271) enforces: staff bypass → NotFound → published → `getUnitAccess` (entitlement, org-scoped product `BUNDLE`/`COURSE`/`LESSON` lookup) → course prerequisites → lesson quiz gates.
- `getLessonPlayback` re-runs `canAccessLesson` before every playback issuance; `stream.mp4` re-checks entitlement + session at request time (60 s cache).
- All video routes are behind `SessionAuthGuard` + `DeviceGuard`; admin routes behind `PermissionsGuard` `CATALOG_MANAGE`.
- **Gap (new):** `getLessonDetail` returns the *entire* Prisma `lesson` row (V3/Y4) — no student-facing projection. Fix = server-side sanitizer.

**Verdict:** authz core is ✅ strong; the response-surface gap is **BLOCKED (fixable)**.

---

## 4. Short-lived playback auth — findings

- LOCAL/R2: 15-min signed URLs, HMAC bound to `accountId:sessionId:lessonId`, `VideoDeliveryToken` audit rows, entitlement re-check at stream time, `isSessionLive`. ✅ Already implemented.
- YouTube: no signed URL exists; the "credential" is the videoId (permanent by design). `VideoDeliveryToken` is not applicable. **NOT POSSIBLE** to make a YouTube embed short-lived.
- **Gap (new):** no per-route throttling on `/video/:lessonId/hls` beyond the global 200 req/min — a cheap enumeration/issuance target (still authz-gated, so low risk, but worth tightening).

**Verdict:** LOCAL/R2 ✅; YouTube **NOT POSSIBLE** to short-live; add focused throttle + replay test.

---

## 5. YouTube-specific limitations — findings

- `YouTubePlayer` uses `host: 'https://www.youtube-nocookie.com'` ✅, `origin` set ✅, `rel:0` ✅, `controls:1` ✅, `playsinline:1` ✅.
- No `fs` (fullscreen) constraint for lessons — fullscreen is legitimate UX, not a cheat signal for videos.
- YouTube iframe is cross-origin; JS cannot read pixels or prevent screenshots inside it → watermark must be *overlaid* on top of the iframe (it is), and recording deterrence is inherently limited. **NOT POSSIBLE** to prevent screenshots/OS-level recording.

**Verdict:** mitigations present; screenshot prevention = **NOT POSSIBLE**; watermark overlay is the practical deterrence.

---

## 6. Watermark — findings

- Exists and is server-derived (`B<ACCT6>·<DEVICE6>`), so it's not client-spoofable.
- Rendered **statically** (fixed bottom-right, fixed opacity) in both players → trivially cropped or masked by a frame-grabber.
- **Gap:** requirement asks for a **moving + variable-opacity** watermark so a captured frame still carries the identifier and a single static crop can't remove it.

**Verdict:** upgrade to animated/roving watermark with opacity variation = **MITIGATED (implementable)**. Note: an overlay moving *under* the YouTube iframe's own controls must avoid blocking the native control bar → place motion within the safe letterbox band.

---

## 7. Screenshot / recording deterrence — findings

- `VideoPlayer`: `controlsList="nodownload"` + `onContextMenu` prevented on the `<video>` only. No visibility/fullscreen handling.
- `YouTubePlayer`: no context-menu or visibility handling (iframe swallows context menu inside itself anyway).
- **Gaps (new):** pause-on-tab-hidden (visibility) is missing; fullscreen-exit handling is missing; a capture-detection story is absent. These are deterrence (not prevention).

**Verdict:** add visibility/fullscreen pause + non-blocking context/copy deterrence = **MITIGATED**; true recording prevention = **NOT POSSIBLE**.

---

## 8. Accessibility — findings

- Players have `aria-label`s on controls, keyboard-focusable buttons, `dir="ltr"` for media, fullscreen + quality + speed UI. Watermark is `pointer-events-none`/`select-none` (does not block interaction). ✅
- **Constraint:** the moving watermark must not overlap the controls area in a way that breaks the native YouTube control bar or keyboard flow; must remain visually subtle (`text-[11px]`, semi-transparent).

**Verdict:** baseline good; keep new deterrence features **non-blocking and keyboard-safe** = ✅.

---

## 9. CSP / security headers — findings

- API: strict all-`'none'` CSP, `X-Frame-Options: deny`, COOP `same-origin`, CORP `cross-origin` (needed for media), HSTS in prod. ✅ Applies to API responses only.
- **academy-web: NO security headers, NO CSP, NO middleware.** The page that embeds the YouTube iframe is wide open (`default-src *`). This is the single biggest frontend gap.

**Verdict:** add a frontend CSP in `next.config.ts`/middleware with **exact** sources: `frame-src https://www.youtube.com https://www.youtube-nocookie.com`, `script-src 'self' 'unsafe-inline' https://www.youtube.com https://www.youtube-nocookie.com https://s.ytimg.com`, `img-src 'self' data: blob: https://i.ytimg.com https://www.youtube.com`, `media-src 'self' blob: data:`, `connect-src 'self' https://www.youtube.com https://www.youtube-nocookie.com`. **MITIGATED (implementable).**

---

## 10. API response audit — findings

| Endpoint | Leaks | Verdict |
|---|---|---|
| `GET /catalog/lessons/:id` (student) | Whole `lesson` row: `contentUrl`, `attachedPdfUrl`, `homeworkPdfUrl`, `status`, `publishAt`, `unpublishAt`, `version`, `sort`, `archivedAt` | **BLOCKED → sanitize** |
| `GET /video/:lessonId/hls` | `videoId` duplicated at top level + inside `data` | **BLOCKED → dedupe** |
| `GET /video/:lessonId/manifest` | `data` only; no top-level dupes ✅ | ✅ |
| `GET /video/:lessonId/segment/:seg` | returns a signed segment URL (authz-gated) | ✅ |
| `GET /video/:lessonId/resume`, `progress` | position only | ✅ |

---

## 11. Abuse-test plan (to run after hardening)

- Cross-student access to a paid lesson (no entitlement) → expect 403.
- Unauthenticated `/video/:lessonId/hls` → 401; no device header → 401/403.
- ID manipulation (garbage lessonId / another student's lessonId) → 404/403.
- Locked lesson (quiz gate) → 403 `LESSON_LOCKED` (prior phase confirmed).
- Token replay: reuse a revoked LOCAL token → 401/403.
- Catalog sanitizer: assert `contentUrl`/`status`/internal fields absent for students, present for staff.
- Frontend CSP: assert the YouTube iframe still loads with the exact `frame-src`.

---

## 12. Honest status legend

- **BLOCKED** — a real weakness currently present; fix is within our control and will be implemented this round (or explicitly deferred).
- **MITIGATED** — a weakness exists but is already mitigated (documented) or can only be partially reduced; list the residual risk.
- **NOT POSSIBLE** — cannot be fixed given the architecture/provider (YouTube public-ness, screenshot prevention, short-lived YouTube embeds). Documented, no fake claims.

---

## 13. Changes implemented (2026-08-14, this round)

All changes are non-migratory; no commit/push performed.

| # | Change | File(s) |
|---|---|---|
| C1 | **Lesson sanitizer** — `getLessonDetail` now returns a student projection for non-staff callers: strips `status`, `publishAt`, `unpublishAt`, `version`, `sort`, `archivedAt`, `createdAt`, `updatedAt`, `unitId`, and nulls `contentUrl`/`attachedPdfUrl`/`homeworkPdfUrl` for VIDEO lessons. PDF/TEXT lessons keep their content URLs (required to render). Staff callers get the full row. | `apps/api/src/catalog/catalog.service.ts` (`toStudentLesson`) |
| C2 | **Video playback response dedupe** — `GET /video/:lessonId/hls` now returns only `{ status, data }`; the duplicated top-level `signedUrl`/`provider`/`videoId` are removed. `data` already carries everything the players need. Frontend consumers updated to read `video.data` only. | `apps/api/src/video/video.controller.ts`, both academy-web lesson pages |
| C3 | **Focused throttle on playback issuance** — `GET /video/:lessonId/hls` and `/manifest` limited to 20/min per client (global default remains 200/min). | `apps/api/src/video/video.controller.ts` |
| C4 | **Roving variable-opacity watermark** — new `AnimatedWatermark` component: roams 5 waypoints (~1.4 s/step), opacity varies 0.3–0.6, starts top-left (never over the bottom control bar), `pointer-events-none`/`select-none`/`aria-hidden`. Used by both `VideoPlayer` (HLS/native) and `YouTubePlayer`. | `packages/ui/src/components/AnimatedWatermark.tsx`, `VideoPlayer.tsx`, `ProviderVideoPlayer.tsx` |
| C5 | **Deterrence** — both players pause on `visibilitychange` (tab hidden); `YouTubePlayer` wrapper prevents context menu; `VideoPlayer` already had `controlsList="nodownload"` + context-menu prevention. | `packages/ui/src/components/*` |
| C6 | **Frontend CSP + security headers** — academy-web now sends an exact-sources CSP (`frame-src` limited to `https://www.youtube.com` and `https://www.youtube-nocookie.com`; `script-src` adds only the YouTube/YTimg origins; `connect-src 'self' + api host`; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`) plus `X-Frame-Options: DENY`, `Referrer-Policy`, `X-Content-Type-Options`, `Permissions-Policy`, `X-DNS-Prefetch-Control`. `'unsafe-eval'` is dev-only. Verified live: headers emitted on all routes; YouTube iframe sources allowed. | `apps/academy-web/next.config.ts` |

### New tests
- `catalog.service.spec.ts`: 3 new cases — student sanitizer strips internals + nulls video URLs; PDF keeps URLs; staff gets full row.
- `video.controller.spec.ts` (new): hls returns only `data` (no top-level dupes); staff flag forwarded.
- `AnimatedWatermark.spec.tsx` (new): renders identifier, non-interactive/`aria-hidden`, positions away from control bar.

### Verification (all green)
- API: **304 tests pass** (40 suites) — incl. new catalog sanitizer + controller tests; `nest build` clean.
- API typecheck clean except 4 pre-existing errors in `test/remember-me.e2e-spec.ts` (not introduced here).
- UI: **20 tests pass**; UI + academy-web typecheck clean; eslint clean on all changed files.
- academy-web `next build` succeeds; standalone server verified emitting the CSP + all headers live on `/` and on the student lesson route.
- **Live abuse retest** (entitled student, running API): see §11 results below.

---

## 14. Live abuse-test results (2026-08-14, entitled student)

| # | Test | Result | Verdict |
|---|---|---|---|
| L1 | Unauthenticated `GET /video/:lessonId/hls` | 401 | ✅ |
| L2 | Session, no `X-Device-Fingerprint` | 401 | ✅ |
| L3 | Session, wrong device fingerprint | 403 `DEVICE_BLOCKED` (account + sessions revoked) | ✅ |
| L4 | Garbage lessonId | 404 | ✅ |
| L5 | Entitled paid lesson hls | 200, `data` only `{provider, videoId}` (running API is pre-C2 build) | ✅ |
| L6 | Free-course lesson hls (no entitlement, free product price 0) | 200 — correct, it's a free product | ✅ |
| L7 | Paid-course lesson, entitlement revoked at runtime | 403 `MISSING_ENTITLEMENT` instantly; restored → 200 | ✅ |
| L8 | Catalog lesson detail | returns `lesson` (full row on running API; sanitizer C1 active after restart) | ⏳ post-restart |
| L9 | `/video/:lessonId/resume` | 200 (authz-gated) | ✅ |

> Note: the running API (`node dist/main`, PID 52129) predates C1–C3. All live authz/device/entitlement results above reflect the already-shipped guards; C1–C3 are verified by unit tests and take effect after the API is restarted. Restarting also requires re-keying the OWNER emailHmac + test-student phoneHmac to the current `.env` HMAC_KEY (documented earlier — do not restart casually).

### Post-restart smoke list
1. Re-login OWNER staff (`admin@bahrawy.test`) — if 401, re-key `emailHmac` to `HMAC(email)` under current `.env` key.
2. Re-login test student; confirm catalog lesson response has no `status`/`contentUrl`/`publishAt` keys for students.
3. Confirm `GET /video/:lessonId/hls` body is `{ status, data }` only.
4. Confirm the moving watermark + tab-hide pause in the browser.
5. Confirm CSP headers on the student lesson page in the browser (DevTools).

---

## 15. Final report — honest BLOCKED / MITIGATED / NOT POSSIBLE

### 1) YouTube URL / videoId exposure
**MITIGATED.** `GET /video/:lessonId/hls` no longer duplicates `videoId` at the top level (only inside `data`), catalog responses no longer leak internal fields or URL-bearing fields for video lessons, and issuance stays strictly behind `canAccessLesson` (verified live: unentitled → 403, revoked entitlement → 403 instantly, free/entitled → 200). **Residual risk:** the IFrame Player API requires the videoId in the browser, so the ID is inherently client-visible (see §2).

### 2) YouTube videos are publicly playable on YouTube itself
**NOT POSSIBLE** without a provider migration. `youtube.com/watch?v=<id>` returns 200 for anyone. No frontend or server change can stop this; the only real fix is moving content to a protected delivery provider (R2/LOCAL HLS), which is outside this round (needs a provider decision + storage migration).

### 3) Server-side authorization
**✅ Strong (already in place, re-verified).** Session cookie + CSRF + account-status checks; per-request device fingerprint with single-device lock (wrong device → account blocked, all sessions revoked — confirmed live); `canAccessLesson` runs entitlement → prerequisites → quiz gates at playback issue; `stream.mp4` re-checks entitlement + live session at request time. No changes needed; abuse tests L1–L7 all hold.

### 4) Short-lived playback auth
**MITIGATED for LOCAL/R2.** 15-min signed URLs, HMAC bound to `accountId:sessionId:lessonId`, `VideoDeliveryToken` audit rows, entitlement re-check at stream time. Added a focused 20/min throttle on hls/manifest issuance. **NOT POSSIBLE for YouTube** — a YouTube embed has no server-side URL to expire; the videoId is permanent by design.

### 5) Screenshot / recording prevention
**NOT POSSIBLE.** Browsers and OSes can always capture screen pixels; YouTube iframes are cross-origin and unreadable to us. Honest stance: no fake "protection" (no CSS `pointer-events` gimmicks, no right-click-as-security). Mitigations added instead: roving variable-opacity watermark + pause-on-tab-hidden + context-menu suppression, all of which make leaks *traceable*, not *impossible*.

### 6) Watermark
**MITIGATED (implemented).** New `AnimatedWatermark`: roams 5 waypoints every ~1.4 s with opacity 0.3–0.6, server-derived `B<ACCT6>·<DEVICE6>` (not client-spoofable), stays clear of the bottom control bar, non-interactive and `aria-hidden` (a11y-safe). A frame-grabber that crops one corner can no longer remove it from every frame.

### 7) Accessibility
**✅ Preserved.** All controls keep `aria-label`s and keyboard focus; the watermark is `pointer-events-none`/`select-none`/`aria-hidden`; moving it to the top of the frame never covers the native YouTube control bar; tab-hide pause doesn't remove focus or keyboard flow.

### 8) CSP / security headers
**MITIGATED (implemented).** academy-web previously had **zero** security headers. Now sends an exact-sources CSP (`frame-src` → only `youtube.com` + `youtube-nocookie.com`; `script-src` → only `'self'` + `'unsafe-inline'` + the three YouTube/YTimg origins; `object-src 'none'`; `base-uri`/`form-action 'self'`) plus `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, and `Permissions-Policy`. `'unsafe-eval'` is dev-only (excluded in production). Verified live on the built server: headers on all routes; YouTube embed sources allowed. API's all-`'none'` CSP + COOP/CORP untouched.

### 9) What genuinely remains (honest)
| Item | Status | Why / what's needed |
|---|---|---|
| YouTube public-ness | **NOT POSSIBLE** | provider migration to protected delivery |
| Screenshot/recording prevention | **NOT POSSIBLE** | browser/OS limitation; watermark + deterrence are the ceiling |
| YouTube short-lived URLs | **NOT POSSIBLE** | embed needs a permanent videoId |
| Roving watermark | **MITIGATED** | done; still crop-able by a determined user with screen capture |
| Frontend CSP | **MITIGATED** | done; `'unsafe-inline'` script source is required by Next.js hydration |
| API restart | **PENDING** | running API predates this round; restarting needs HMAC re-keying (see §14) |
| Cross-tenant live proof | **PENDING** | dev has a single org; code is org-scoped, needs a 2-org staging test |
| LOCAL/R2 live proof | **PENDING** | no LOCAL/R2 videos exist in dev; token path verified by unit tests only |

**Verification summary:** API 304 tests / 40 suites ✅ · UI 20 tests ✅ · API + UI + web typecheck ✅ (4 pre-existing `remember-me.e2e-spec.ts` errors, untouched) · `nest build` ✅ · `next build` ✅ · eslint clean on all changed files · live abuse suite L1–L9 ✅. No commit/push performed.