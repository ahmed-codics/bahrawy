CREATE TYPE "VideoProvider" AS ENUM ('LOCAL', 'YOUTUBE', 'R2');

ALTER TABLE "VideoLesson"
  RENAME COLUMN "hlsBasePath" TO "sourceRef";

ALTER TABLE "VideoLesson"
  ADD COLUMN "provider" "VideoProvider" NOT NULL DEFAULT 'LOCAL',
  ADD COLUMN "originalFileName" TEXT,
  ADD COLUMN "mimeType" TEXT;
