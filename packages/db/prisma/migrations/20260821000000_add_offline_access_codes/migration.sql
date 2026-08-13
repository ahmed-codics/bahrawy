-- Offline Student Access Codes: staff-generated codes that students redeem to
-- unlock a course. Codes are stored only as a keyed HMAC (codeHash) plus an
-- AES-GCM encrypted copy (codeEncrypted) so the raw code is never stored in
-- plaintext and can only be retrieved by the export/print flow. codePrefix is
-- a short masked display value shown in the admin UI.
-- Applied manually to the local dev DB (migration history has drift that
-- blocks `prisma migrate dev`), matching the device_lock precedent.

CREATE TABLE "OfflineAccessCodeBatch" (
  "id"                 TEXT         NOT NULL,
  "organizationId"     TEXT         NOT NULL,
  "createdByAccountId" TEXT         NOT NULL,
  "courseId"           TEXT         NOT NULL,
  "gradeId"            TEXT,
  "quantity"           INTEGER      NOT NULL,
  "maxUses"            INTEGER      NOT NULL DEFAULT 1,
  "expiresAt"          TIMESTAMP(3),
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OfflineAccessCodeBatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OfflineAccessCodeBatch_organizationId_idx" ON "OfflineAccessCodeBatch"("organizationId");
CREATE INDEX "OfflineAccessCodeBatch_organizationId_createdAt_idx" ON "OfflineAccessCodeBatch"("organizationId", "createdAt");

CREATE TABLE "OfflineAccessCode" (
  "id"                  TEXT         NOT NULL,
  "organizationId"      TEXT         NOT NULL,
  "batchId"             TEXT         NOT NULL,
  "codeHash"            TEXT         NOT NULL,
  "codePrefix"          TEXT         NOT NULL,
  "codeEncrypted"       TEXT         NOT NULL,
  "status"              TEXT         NOT NULL DEFAULT 'ACTIVE',
  "courseId"            TEXT         NOT NULL,
  "gradeId"             TEXT,
  "accountId"           TEXT,
  "createdByAccountId"  TEXT         NOT NULL,
  "maxUses"             INTEGER      NOT NULL DEFAULT 1,
  "useCount"            INTEGER      NOT NULL DEFAULT 0,
  "expiresAt"           TIMESTAMP(3),
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activatedAt"         TIMESTAMP(3),
  "disabledAt"          TIMESTAMP(3),
  "disabledByAccountId" TEXT,
  "deletedAt"           TIMESTAMP(3),
  "version"             INTEGER      NOT NULL DEFAULT 1,
  CONSTRAINT "OfflineAccessCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OfflineAccessCode_organizationId_codeHash_key" ON "OfflineAccessCode"("organizationId", "codeHash");
CREATE INDEX "OfflineAccessCode_organizationId_status_idx" ON "OfflineAccessCode"("organizationId", "status");
CREATE INDEX "OfflineAccessCode_organizationId_courseId_idx" ON "OfflineAccessCode"("organizationId", "courseId");
CREATE INDEX "OfflineAccessCode_organizationId_gradeId_idx" ON "OfflineAccessCode"("organizationId", "gradeId");
CREATE INDEX "OfflineAccessCode_organizationId_batchId_idx" ON "OfflineAccessCode"("organizationId", "batchId");
CREATE INDEX "OfflineAccessCode_organizationId_accountId_idx" ON "OfflineAccessCode"("organizationId", "accountId");

ALTER TABLE "OfflineAccessCodeBatch" ADD CONSTRAINT "OfflineAccessCodeBatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OfflineAccessCodeBatch" ADD CONSTRAINT "OfflineAccessCodeBatch_createdByAccountId_fkey" FOREIGN KEY ("createdByAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OfflineAccessCodeBatch" ADD CONSTRAINT "OfflineAccessCodeBatch_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OfflineAccessCodeBatch" ADD CONSTRAINT "OfflineAccessCodeBatch_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OfflineAccessCode" ADD CONSTRAINT "OfflineAccessCode_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OfflineAccessCode" ADD CONSTRAINT "OfflineAccessCode_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "OfflineAccessCodeBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OfflineAccessCode" ADD CONSTRAINT "OfflineAccessCode_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OfflineAccessCode" ADD CONSTRAINT "OfflineAccessCode_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OfflineAccessCode" ADD CONSTRAINT "OfflineAccessCode_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OfflineAccessCode" ADD CONSTRAINT "OfflineAccessCode_createdByAccountId_fkey" FOREIGN KEY ("createdByAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;