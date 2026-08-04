CREATE SEQUENCE "StudentProfile_studentNumber_seq" START WITH 10000;

ALTER TABLE "StudentProfile"
ADD COLUMN "studentNumber" INTEGER;

WITH numbered_students AS (
  SELECT
    "id",
    9999 + ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, "id" ASC) AS "studentNumber"
  FROM "StudentProfile"
)
UPDATE "StudentProfile" AS student
SET "studentNumber" = numbered_students."studentNumber"
FROM numbered_students
WHERE student."id" = numbered_students."id";

SELECT setval(
  '"StudentProfile_studentNumber_seq"',
  COALESCE((SELECT MAX("studentNumber") FROM "StudentProfile"), 9999),
  true
);

ALTER TABLE "StudentProfile"
ALTER COLUMN "studentNumber" SET DEFAULT nextval('"StudentProfile_studentNumber_seq"'),
ALTER COLUMN "studentNumber" SET NOT NULL;

ALTER SEQUENCE "StudentProfile_studentNumber_seq"
OWNED BY "StudentProfile"."studentNumber";

CREATE UNIQUE INDEX "StudentProfile_studentNumber_key"
ON "StudentProfile"("studentNumber");
