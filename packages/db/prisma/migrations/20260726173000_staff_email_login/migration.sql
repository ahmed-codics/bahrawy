ALTER TABLE "Account"
  ALTER COLUMN "phoneEncrypted" DROP NOT NULL,
  ALTER COLUMN "phoneHmac" DROP NOT NULL;

CREATE UNIQUE INDEX "Account_organizationId_emailHmac_key"
  ON "Account"("organizationId", "emailHmac");

CREATE INDEX "Account_emailHmac_idx" ON "Account"("emailHmac");
