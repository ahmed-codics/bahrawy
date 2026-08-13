-- Device Lock forensics: capture request metadata and the pre-block account
-- status so admin unlock/allow/reset can restore it instead of blindly
-- forcing ACTIVE (spec #15). Applied manually to the local dev DB (migration
-- history has drift that blocks `prisma migrate dev`), matching the
-- `add_device_lock` precedent.

ALTER TABLE "DeviceBlock" ADD COLUMN "ipAddress" TEXT;
ALTER TABLE "DeviceBlock" ADD COLUMN "userAgent" TEXT;
ALTER TABLE "DeviceBlock" ADD COLUMN "previousStatus" TEXT;