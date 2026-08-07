# Security Model

**Authentication:**

- Closed registration (Invite/Roster only).
- Telephone + password login; one-use activation credentials for initial setup.
- Staff: Cloudflare Access + local app password + TOTP.

**Authorization:**

- Server-side RBAC enforced for all mutations.
- Guardian scopes strictly limited to linked children.
- No IDORs: Every read/write requires context boundary validation.

**Data Protection:**

- Audit logging for all financial and destructive actions.
- Files quarantined until scanned (ClamAV) and promoted.
- Passwords hashed; staff never sets or views permanent passwords.

## Phase 5: Auth & Session Security Audit

Scope: `apps/api` authentication/session layer. Verify → fix → regression. No commits pushed.

### Architecture mapped
- Global `AuthModule`: `AuthController` (login, staff-login, register, activate, logout,
  check-phone, staff/recovery-consume), `StudentsController` (staff-managed student lifecycle),
  `AuthService`, `SessionAuthGuard`. Also `SessionAuthGuard`-protected routes across the app.
- Sessions persisted in Postgres (`AuthSession`): token stored only as a hash
  (`SecurityService.hashOpaqueToken`, argon2 salt), idle + absolute expiry, `lastSeenAt`
  sliding touch every 5 min, `revokedAt`/`revokedReason`.
- Cookies: `HttpOnly`, `SameSite=lax`, `path=/`; secure = `NODE_ENV==='production'`;
  `__Host-`-prefixed names in prod, prefixed dev-name otherwise.
- CSRF: HMAC-SHA256 of the raw session cookie using `HMAC_KEY`; header checked on mutation routes;
  exempt: login/staff-login/register/activate/check-phone/staff-recovery-consume.
- Rate limit: global throttle + per-auth-route limits (login/staff-login 10/15min, register 3/hr,
  activate 5/15min, recovery 5/15min, check-phone 30/15min).
- Passwords: argon2 hashes (`$argon2i` confirmed in DB), `mustChangePassword` flag.
- RBAC: `SESSION_COOKIE_`, tenant org boundary; blocker-staff permissions
  `StaffPermission.*` for privileged admin routes.

### Findings (real vulnerabilities found & fixed)
1. **Suspended accounts could still authenticate.** `login()`/`staffLogin()` never checked
   `account.status`; existing sessions for a later-suspended account were not terminated.
2. **Activation never flipped status.** `activate()` consumed the credential and set the password
   but left status stuck at seed `PENDING_ACTIVATION`, so newly initialized accounts stayed
   non-ACTIVE forever (and later-policy enforcement would permanently lock them).
3. **Cross-tenant password reset.** `createPasswordResetCase(initiatorStaffId, targetAccountId)`
   had no org check, so a privileged staff member could overwrite accounts in any other org.
4. **Idle-expiry gap in `validateSession()`.** Expiry validation enforced only `absoluteExpiresAt`,
   not the per-session idle window.

### Fixes (all in `auth.service.ts`)
- `login()`: after a correct password, non-`ACTIVE` → log `FAILED_ACCOUNT_INACTIVE` security event
  and throw the same `UnauthorizedException` as a bad credential (anti-enumeration).
- `activate()`: transaction now also sets `status: 'ACTIVE'` (same `update`).
- `validateSession()`: check both `absoluteExpiresAt` and `idleExpiresAt`; if `account.status !==
  'ACTIVE'`, revoke the session (`revokedReason:'ACCOUNT_INACTIVE'`) and reject.
- `createPasswordResetCase()`: fetch the initiator's org and require
  `target.organizationId === initiator.organizationId`, else `ForbiddenException`
  (`Cannot reset password for an account in another organization`).

### Regression tests
- `apps/api/src/auth/auth.security.spec.ts` (new, 10 tests): suspended/ACTIVE/pending login,
  activation→ACTIVE, revoked/expired (idle+absolute)/suspended session rejection + side effects,
  cross-org reset forbidden, same-org allowed.

### Verification (live, server rebuilt)
- Correct staff login → 201; bad credential → generic 401 `Invalid email address or password`
  (non-enumerable, same message for inactive).
- Full gates: API unit **165/165** (incl. 10 new), API integration **2/2**, Playwright **30/30**,
  `tsc --noEmit` clean, `eslint` clean on changed files, `nest build` OK.

### Notes / decisions requiring product confirmation
- `check-phone` currently returns a constant `{ available: true }` — a stub. If it ever returns
  existence, it leaks enrollment; recommend keeping it constant or gating behind auth/rate-limit.
- Session idle expiry exists and is now enforced; consider a fixed total session TTL if desired.
- TOTP is enforced for staff; consider optional second factor for students if product wants it.
