-- Add per-lesson "requires passing the previous lesson" gate flag.
-- Defaults to false: lessons stay accessible unless the admin opts in.
-- Applied manually to the local dev DB (migration history has drift that
-- blocks `prisma migrate dev`), matching the `add_exam_sessions` precedent.

ALTER TABLE "Lesson"
  ADD COLUMN "requiresPreviousLessonPass" BOOLEAN NOT NULL DEFAULT false;