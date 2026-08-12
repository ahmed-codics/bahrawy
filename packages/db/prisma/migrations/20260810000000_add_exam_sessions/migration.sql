-- ExamSession / proctoring DDL (applied manually for the local dev DB,
-- whose migration history has pre-existing drift that blocks `prisma migrate dev`.)

CREATE TYPE "ExamSessionStatus" AS ENUM ('ACTIVE', 'LOCKED', 'EXPIRED', 'SUBMITTED');

CREATE TABLE "ExamSession" (
  "id"             TEXT             NOT NULL,
  "assessmentId"   TEXT             NOT NULL,
  "accountId"      TEXT             NOT NULL,
  "startedAt"      TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"      TIMESTAMP(3),
  "lastActivityAt" TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt"        TIMESTAMP(3),
  "status"         "ExamSessionStatus" NOT NULL DEFAULT 'ACTIVE',
  "attemptCount"   INTEGER          NOT NULL DEFAULT 1,
  "openCount"      INTEGER          NOT NULL DEFAULT 1,
  "violationCount" INTEGER          NOT NULL DEFAULT 0,
  "lockedAt"       TIMESTAMP(3),
  "lockReason"     TEXT,
  "reopenedAt"     TIMESTAMP(3),
  "reopenedBy"     TEXT,
  "createdAt"      TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3)     NOT NULL,
  CONSTRAINT "ExamSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExamSessionEvent" (
  "id"           TEXT         NOT NULL,
  "sessionId"    TEXT         NOT NULL,
  "accountId"    TEXT         NOT NULL,
  "assessmentId" TEXT         NOT NULL,
  "eventType"    TEXT         NOT NULL,
  "metadata"     JSONB,
  "actor"        TEXT,
  "timestamp"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExamSessionEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AssessmentAttempt" ADD COLUMN "examSessionId" TEXT;

CREATE INDEX "ExamSession_accountId_idx" ON "ExamSession"("accountId");
CREATE INDEX "ExamSession_assessmentId_idx" ON "ExamSession"("assessmentId");
CREATE INDEX "ExamSession_accountId_assessmentId_status_idx" ON "ExamSession"("accountId", "assessmentId", "status");
CREATE INDEX "ExamSession_status_idx" ON "ExamSession"("status");
CREATE INDEX "ExamSession_lockedAt_idx" ON "ExamSession"("lockedAt");
CREATE INDEX "ExamSession_expiresAt_idx" ON "ExamSession"("expiresAt");
CREATE INDEX "ExamSession_createdAt_idx" ON "ExamSession"("createdAt");

ALTER TABLE "ExamSession" ADD CONSTRAINT "ExamSession_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamSession" ADD CONSTRAINT "ExamSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ExamSessionEvent_sessionId_idx" ON "ExamSessionEvent"("sessionId");
CREATE INDEX "ExamSessionEvent_accountId_idx" ON "ExamSessionEvent"("accountId");
CREATE INDEX "ExamSessionEvent_assessmentId_idx" ON "ExamSessionEvent"("assessmentId");
CREATE INDEX "ExamSessionEvent_eventType_idx" ON "ExamSessionEvent"("eventType");
CREATE INDEX "ExamSessionEvent_timestamp_idx" ON "ExamSessionEvent"("timestamp");

ALTER TABLE "ExamSessionEvent" ADD CONSTRAINT "ExamSessionEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExamSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "AssessmentAttempt_examSessionId_idx" ON "AssessmentAttempt"("examSessionId");
ALTER TABLE "AssessmentAttempt" ADD CONSTRAINT "AssessmentAttempt_examSessionId_fkey" FOREIGN KEY ("examSessionId") REFERENCES "ExamSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;