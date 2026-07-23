# Backup and Restore (Lean V1)

**Strategy:**

- Encrypted PostgreSQL custom-format dumps.
- Destination: Cloudflare R2 Standard.
- Frequency: Every 6 hours (retained 7 days, 30 dailies, 6 monthlies).

**Recovery Targets:**

- RPO ≤ 6 hours
- RTO ≤ 4 hours

**Verification:**

- Automated weekly restore tests.
- Rebuild drill (clean VPS) performed quarterly.
