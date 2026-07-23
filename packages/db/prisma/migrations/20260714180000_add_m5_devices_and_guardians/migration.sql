-- CreateTable
CREATE TABLE "StudentDevice" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "deviceFingerprint" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLease" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "deviceFingerprint" TEXT NOT NULL,
    "activityType" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityLease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentGuardian" (
    "studentProfileId" TEXT NOT NULL,
    "guardianProfileId" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL DEFAULT 'PRIMARY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentGuardian_pkey" PRIMARY KEY ("studentProfileId","guardianProfileId")
);

-- CreateIndex
CREATE INDEX "StudentDevice_accountId_idx" ON "StudentDevice"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentDevice_accountId_deviceFingerprint_key" ON "StudentDevice"("accountId", "deviceFingerprint");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityLease_accountId_key" ON "ActivityLease"("accountId");

-- CreateIndex
CREATE INDEX "ActivityLease_accountId_idx" ON "ActivityLease"("accountId");

-- CreateIndex
CREATE INDEX "StudentGuardian_studentProfileId_idx" ON "StudentGuardian"("studentProfileId");

-- CreateIndex
CREATE INDEX "StudentGuardian_guardianProfileId_idx" ON "StudentGuardian"("guardianProfileId");

-- AddForeignKey
ALTER TABLE "StudentDevice" ADD CONSTRAINT "StudentDevice_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGuardian" ADD CONSTRAINT "StudentGuardian_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentGuardian" ADD CONSTRAINT "StudentGuardian_guardianProfileId_fkey" FOREIGN KEY ("guardianProfileId") REFERENCES "GuardianProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
