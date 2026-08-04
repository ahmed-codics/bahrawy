DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PublishStatus') THEN
    CREATE TYPE "PublishStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SupportTicketStatus') THEN
    CREATE TYPE "SupportTicketStatus" AS ENUM (
      'OPEN', 'IN_PROGRESS', 'WAITING_FOR_STUDENT', 'RESOLVED', 'CLOSED'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SupportPriority') THEN
    CREATE TYPE "SupportPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SupportAuthorKind') THEN
    CREATE TYPE "SupportAuthorKind" AS ENUM ('STUDENT', 'STAFF', 'SYSTEM');
  END IF;
END $$;

ALTER TABLE "Course"
  ADD COLUMN IF NOT EXISTS "gradeId" TEXT,
  ADD COLUMN IF NOT EXISTS "subjectId" TEXT,
  ADD COLUMN IF NOT EXISTS "termId" TEXT,
  ADD COLUMN IF NOT EXISTS "descriptionAr" TEXT,
  ADD COLUMN IF NOT EXISTS "publishAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "unpublishAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

UPDATE "Course"
SET "descriptionAr" = COALESCE("descriptionAr", "description")
WHERE "description" IS NOT NULL;

ALTER TABLE "Course" DROP COLUMN IF EXISTS "description";

ALTER TABLE "Course"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "PublishStatus" USING (
    CASE
      WHEN "status" IN ('DRAFT', 'PUBLISHED', 'ARCHIVED') THEN "status"
      WHEN "status" = 'ACTIVE' THEN 'PUBLISHED'
      ELSE 'DRAFT'
    END
  )::"PublishStatus",
  ALTER COLUMN "status" SET DEFAULT 'DRAFT';

ALTER TABLE "Chapter"
  ADD COLUMN IF NOT EXISTS "publishAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "unpublishAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Chapter"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "PublishStatus" USING (
    CASE WHEN "status" IN ('DRAFT', 'PUBLISHED', 'ARCHIVED') THEN "status" ELSE 'DRAFT' END
  )::"PublishStatus",
  ALTER COLUMN "status" SET DEFAULT 'DRAFT';

ALTER TABLE "Unit"
  ADD COLUMN IF NOT EXISTS "publishAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "unpublishAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Unit"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "PublishStatus" USING (
    CASE WHEN "status" IN ('DRAFT', 'PUBLISHED', 'ARCHIVED') THEN "status" ELSE 'DRAFT' END
  )::"PublishStatus",
  ALTER COLUMN "status" SET DEFAULT 'DRAFT';

ALTER TABLE "Lesson"
  ADD COLUMN IF NOT EXISTS "publishAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "unpublishAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Lesson"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "PublishStatus" USING (
    CASE WHEN "status" IN ('DRAFT', 'PUBLISHED', 'ARCHIVED') THEN "status" ELSE 'DRAFT' END
  )::"PublishStatus",
  ALTER COLUMN "status" SET DEFAULT 'DRAFT';

ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "publishAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "unpublishAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Price"
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Question"
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Assessment"
  ADD COLUMN IF NOT EXISTS "publishAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "unpublishAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Assessment"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "PublishStatus" USING (
    CASE WHEN "status" IN ('DRAFT', 'PUBLISHED', 'ARCHIVED') THEN "status" ELSE 'DRAFT' END
  )::"PublishStatus",
  ALTER COLUMN "status" SET DEFAULT 'DRAFT';

ALTER TABLE "SupportTicket"
  ADD COLUMN IF NOT EXISTS "priority" "SupportPriority" NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS "assignedStaffId" TEXT,
  ADD COLUMN IF NOT EXISTS "lastMessageAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "studentUnreadAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "staffUnreadAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "SupportTicket"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "SupportTicketStatus" USING (
    CASE
      WHEN "status" IN ('OPEN', 'IN_PROGRESS', 'WAITING_FOR_STUDENT', 'RESOLVED', 'CLOSED')
        THEN "status"
      ELSE 'OPEN'
    END
  )::"SupportTicketStatus",
  ALTER COLUMN "status" SET DEFAULT 'OPEN';

CREATE TABLE IF NOT EXISTS "SupportMessage" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "authorAccountId" TEXT,
  "authorKind" "SupportAuthorKind" NOT NULL,
  "body" TEXT NOT NULL,
  "isInternal" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Course_gradeId_fkey'
  ) THEN
    ALTER TABLE "Course"
      ADD CONSTRAINT "Course_gradeId_fkey"
      FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Course_subjectId_fkey'
  ) THEN
    ALTER TABLE "Course"
      ADD CONSTRAINT "Course_subjectId_fkey"
      FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Course_termId_fkey'
  ) THEN
    ALTER TABLE "Course"
      ADD CONSTRAINT "Course_termId_fkey"
      FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SupportTicket_assignedStaffId_fkey'
  ) THEN
    ALTER TABLE "SupportTicket"
      ADD CONSTRAINT "SupportTicket_assignedStaffId_fkey"
      FOREIGN KEY ("assignedStaffId") REFERENCES "StaffProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SupportMessage_ticketId_fkey'
  ) THEN
    ALTER TABLE "SupportMessage"
      ADD CONSTRAINT "SupportMessage_ticketId_fkey"
      FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SupportMessage_authorAccountId_fkey'
  ) THEN
    ALTER TABLE "SupportMessage"
      ADD CONSTRAINT "SupportMessage_authorAccountId_fkey"
      FOREIGN KEY ("authorAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Course_gradeId_idx" ON "Course"("gradeId");
CREATE INDEX IF NOT EXISTS "Course_subjectId_idx" ON "Course"("subjectId");
CREATE INDEX IF NOT EXISTS "Course_termId_idx" ON "Course"("termId");
CREATE INDEX IF NOT EXISTS "Course_status_publishAt_unpublishAt_idx" ON "Course"("status", "publishAt", "unpublishAt");
CREATE INDEX IF NOT EXISTS "Chapter_status_publishAt_unpublishAt_idx" ON "Chapter"("status", "publishAt", "unpublishAt");
CREATE INDEX IF NOT EXISTS "Unit_status_publishAt_unpublishAt_idx" ON "Unit"("status", "publishAt", "unpublishAt");
CREATE INDEX IF NOT EXISTS "Lesson_status_publishAt_unpublishAt_idx" ON "Lesson"("status", "publishAt", "unpublishAt");
CREATE INDEX IF NOT EXISTS "Product_status_publishAt_unpublishAt_idx" ON "Product"("status", "publishAt", "unpublishAt");
CREATE INDEX IF NOT EXISTS "Price_status_idx" ON "Price"("status");
CREATE INDEX IF NOT EXISTS "Assessment_status_publishAt_unpublishAt_idx" ON "Assessment"("status", "publishAt", "unpublishAt");
CREATE INDEX IF NOT EXISTS "SupportTicket_assignedStaffId_idx" ON "SupportTicket"("assignedStaffId");
CREATE INDEX IF NOT EXISTS "SupportMessage_ticketId_idx" ON "SupportMessage"("ticketId");
CREATE INDEX IF NOT EXISTS "SupportMessage_authorAccountId_idx" ON "SupportMessage"("authorAccountId");
