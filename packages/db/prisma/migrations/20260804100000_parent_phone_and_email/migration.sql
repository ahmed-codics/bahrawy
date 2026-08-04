-- Rename father phone column to parent phone (keeps existing encrypted data)
ALTER TABLE "StudentProfile"
  RENAME COLUMN "fatherPhoneEncrypted" TO "parentPhoneEncrypted";

-- Exact-lookup HMAC for parent phone search
ALTER TABLE "StudentProfile"
  ADD COLUMN "parentPhoneHmac" TEXT;

CREATE INDEX "StudentProfile_parentPhoneHmac_idx"
  ON "StudentProfile"("parentPhoneHmac");
