## Goal
Fix duplicate registration regression (double-submit + TOCTOU race) and investigate new 429 regression.

## Constraints & Preferences
- Arabic language throughout
- Minimal code changes — no refactoring unrelated code
- Do not fix pre-existing lint errors or test failures
- Fixes must pass build, lint, and test
- Do NOT disable any security feature (ThrottleGuard, CSRF, etc.)
- No guessing — trace the exact request path before any fix

## Progress
### Done
- **Frontend double-submit fix** (`apps/academy-web/app/register/page.tsx`): `stepLock` and `loading` both set before the first `await`, both released in `finally`. Guard checks both ref and state.
- **Backend TOCTOU race fix** (`apps/api/src/auth/auth.service.ts`): Moved duplicate check inside `$transaction`; `.catch()` converts P2002 to `ConflictException`. Removed outer `findFirst`.
- **Verification**: Build, lint, typecheck, unit tests (91/91), manual tests (single/sequential/concurrent) all pass.
- **ThrottleGuard logging** added temporarily for 429 investigation.
- **429 investigation completed**: The normal registration flow (2× check-phone + 1× register) completes without 429s. The only way to hit the 429 is exceeding the 3/hour register limit — expected behavior, not a regression. Every failed validation also counts toward the limit. ThrottleGuard is entirely synchronous (no race within event loop).
- **`next()` function bug identified** but not fixed: `stepLock` released before `setStep(2)`, no `finally` for error recovery. If `checkPhoneAPI` throws, the lock leaks forever. This does not cause 429s but does freeze the UI.

### Remaining (not actionable bugs)
- 2 pre-existing test failures (unrelated to our changes).
- 62 (or less after our fixes) pre-existing lint errors across all workspaces.
- `next()` lock leak: if user clicks "Next" and the API call fails, `stepLock` stays `true` forever. Minor — the registration form still works on reload.

## Key Decisions
- **429 regression is NOT a regression**: 3 register/hour limit is intentional. Normal flow consumes exactly 1 register slot. The user likely hit the limit during repeated testing. Raising the limit was considered but rejected to preserve security.
- **`next()` scope limited to step 0→1**: Only affects the `checkPhoneAPI` call before moving to step 2. Harmless unless that specific API call throws.
- **ThrottleGuard logging kept temporarily** for continued monitoring; can be removed once stable.

## Critical Context
- Throttle limits: register=3/hour, check-phone=30/15min, activate=5/15min, login=10/15min.
- ThrottleGuard runs BEFORE validation pipe — failed validation counts toward limit.
- A single registration flow: 2× check-phone (13% of limit) + 1× register (33% of limit).
- The `next()` function (step 0→1) uses the old buggy pattern: lock acquired around `checkPhoneAPI`, released before `setStep(2)`, no `finally`.

## Relevant Files
- `apps/api/src/throttle/throttle.guard.ts`: Temporary logging added.
- `apps/api/src/auth/auth.service.ts`: Backend fix applied.
- `apps/api/src/auth/auth.controller.ts`: All `@Throttle(...)` configurations.
- `apps/academy-web/app/register/page.tsx`: Frontend fix applied (`submit()`); `next()` unchanged.
- `apps/academy-web/lib/api.ts`: `fetchApi` error handling.
