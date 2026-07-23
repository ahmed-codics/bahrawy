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
