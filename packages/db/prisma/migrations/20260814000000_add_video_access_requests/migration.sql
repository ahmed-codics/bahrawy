-- Video Access Requests + Grants: student video-opening request workflow.
-- Applied manually to the local dev DB (migration history has drift that
-- blocks `prisma migrate dev`), matching the remember_me precedent.

CREATE TYPE "VideoAccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'REVOKED');
CREATE TYPE "VideoAccessGrantDuration" AS ENUM ('SESSION', 'ONE_DAY', 'THREE_DAYS', 'SEVEN_DAYS', 'CUSTOM');

CREATE TABLE "VideoAccessRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "requestedEmail" TEXT NOT NULL,
    "status" "VideoAccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "rejectionReason" TEXT,
    "grantExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoAccessRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VideoAccessGrant" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "sessionId" TEXT,
    "durationType" "VideoAccessGrantDuration" NOT NULL DEFAULT 'SESSION',
    "grantedBy" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "revokedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoAccessGrant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VideoAccessGrant_requestId_key" ON "VideoAccessGrant"("requestId");
CREATE INDEX "VideoAccessGrant_organizationId_idx" ON "VideoAccessGrant"("organizationId");
CREATE INDEX "VideoAccessGrant_accountId_lessonId_idx" ON "VideoAccessGrant"("accountId", "lessonId");
CREATE INDEX "VideoAccessGrant_accountId_revokedAt_idx" ON "VideoAccessGrant"("accountId", "revokedAt");

CREATE INDEX "VideoAccessRequest_organizationId_status_requestedAt_idx" ON "VideoAccessRequest"("organizationId", "status", "requestedAt");
CREATE INDEX "VideoAccessRequest_accountId_status_idx" ON "VideoAccessRequest"("accountId", "status");
CREATE INDEX "VideoAccessRequest_lessonId_status_idx" ON "VideoAccessRequest"("lessonId", "status");

ALTER TABLE "VideoAccessGrant" ADD CONSTRAINT "VideoAccessGrant_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "VideoAccessRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
