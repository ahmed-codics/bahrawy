ALTER TABLE "Assessment"
ADD COLUMN IF NOT EXISTS "lessonId" TEXT;

CREATE INDEX IF NOT EXISTS "Assessment_lessonId_idx"
ON "Assessment"("lessonId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Assessment_lessonId_fkey'
  ) THEN
    ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_lessonId_fkey"
      FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "Unit"
ADD COLUMN "prerequisiteAssessmentId" TEXT;

CREATE INDEX "Unit_prerequisiteAssessmentId_idx"
ON "Unit"("prerequisiteAssessmentId");

ALTER TABLE "Unit"
ADD CONSTRAINT "Unit_prerequisiteAssessmentId_fkey"
FOREIGN KEY ("prerequisiteAssessmentId")
REFERENCES "Assessment"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

UPDATE "Assessment" AS assessment
SET "unitId" = lesson."unitId"
FROM "Lesson" AS lesson
WHERE assessment."lessonId" = lesson."id"
  AND assessment."unitId" IS NULL;
