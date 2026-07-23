ALTER TABLE "Assessment"
ADD COLUMN "passingScore" INTEGER,
ADD COLUMN "maxAttempts" INTEGER;

ALTER TABLE "AssessmentAttempt"
ALTER COLUMN "expiresAt" DROP NOT NULL;

UPDATE "AssessmentAttempt" AS attempt
SET "expiresAt" = NULL
FROM "Assessment" AS assessment
WHERE attempt."assessmentId" = assessment.id
  AND assessment."durationMinutes" <= 0;

ALTER TABLE "Assessment"
ADD CONSTRAINT "Assessment_passingScore_range"
CHECK ("passingScore" IS NULL OR ("passingScore" >= 0 AND "passingScore" <= 100)),
ADD CONSTRAINT "Assessment_maxAttempts_positive"
CHECK ("maxAttempts" IS NULL OR "maxAttempts" > 0);
