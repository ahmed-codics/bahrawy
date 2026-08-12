-- Device Lock: strict one-device-per-student enforcement.
-- Applied manually to the local dev DB (migration history has drift that
-- blocks `prisma migrate dev`), matching the `add_exam_grants` precedent.
--
-- 1) StudentDevice.isPrimary: marks the account's single allowed device.
--    Existing rows are backfilled by promoting the most-recently-used device
--    per account (only one account currently has more than one device).
-- 2) AuthSession.deviceFingerprint: binds a session to the device fingerprint
--    used at login, so every authenticated student request can be checked
--    against it lazily without a lookup.
-- 3) DeviceBlock: records each unknown-device block and its resolution state,
--    driving the admin actions (فتح الحساب / السماح بالجهاز الحالي /
--    إعادة تعيين الجهاز الأساسي).

ALTER TABLE "StudentDevice" ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT false;

UPDATE "StudentDevice" d
SET "isPrimary" = true
FROM (
  SELECT DISTINCT ON ("accountId") "id"
  FROM "StudentDevice"
  ORDER BY "accountId", "lastUsedAt" DESC, "createdAt" DESC
) chosen
WHERE d."id" = chosen."id";

ALTER TABLE "AuthSession" ADD COLUMN "deviceFingerprint" TEXT;

CREATE TABLE "DeviceBlock" (
  "id"                TEXT         NOT NULL,
  "accountId"         TEXT         NOT NULL,
  "deviceFingerprint" TEXT         NOT NULL,
  "reason"            TEXT         NOT NULL,
  "blockedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt"        TIMESTAMP(3),
  "resolution"        TEXT,
  "resolvedBy"        TEXT,
  CONSTRAINT "DeviceBlock_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DeviceBlock_accountId_idx" ON "DeviceBlock"("accountId");
CREATE INDEX "DeviceBlock_blockedAt_idx" ON "DeviceBlock"("blockedAt");

ALTER TABLE "DeviceBlock" ADD CONSTRAINT "DeviceBlock_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;