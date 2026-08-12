-- ExamGrant: one-time admin-granted "extra attempt" token per student+assessment.
-- Used by the admin "فتح الامتحان للطالب" flow for FAILED quiz cases so the
-- previous FAILED attempt stays untouched in history (requirement 8/9/10).
-- Applied manually to the local dev DB (migration history has drift that
-- blocks `prisma migrate dev`), matching the `add_exam_sessions` precedent.

CREATE TABLE "ExamGrant" (
  "id"            TEXT         NOT NULL,
  "accountId"     TEXT         NOT NULL,
  "assessmentId"  TEXT         NOT NULL,
  "createdBy"     TEXT,
  "reason"        TEXT         NOT NULL DEFAULT 'ADMIN_UNLOCK',
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "usedAt"        TIMESTAMP(3),
  "usedAttemptId" TEXT,
  CONSTRAINT "ExamGrant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExamGrant_accountId_assessmentId_idx" ON "ExamGrant"("accountId", "assessmentId");
CREATE INDEX "ExamGrant_assessmentId_idx" ON "ExamGrant"("assessmentId");
CREATE INDEX "ExamGrant_createdAt_idx" ON "ExamGrant"("createdAt");

ALTER TABLE "ExamGrant" ADD CONSTRAINT "ExamGrant_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamGrant" ADD CONSTRAINT "ExamGrant_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamGrant" ADD CONSTRAINT "ExamGrant_usedAttemptId_fkey" FOREIGN KEY ("usedAttemptId") REFERENCES "AssessmentAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;