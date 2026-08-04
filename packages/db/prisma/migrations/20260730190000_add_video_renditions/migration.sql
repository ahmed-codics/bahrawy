CREATE TABLE "VideoRendition" (
  "id" TEXT NOT NULL,
  "videoLessonId" TEXT NOT NULL,
  "quality" TEXT NOT NULL,
  "objectKey" TEXT NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "bitrateKbps" INTEGER NOT NULL,
  "fileSizeBytes" BIGINT NOT NULL,
  "mimeType" TEXT NOT NULL DEFAULT 'video/mp4',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "VideoRendition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VideoRendition_videoLessonId_quality_key"
  ON "VideoRendition"("videoLessonId", "quality");

CREATE INDEX "VideoRendition_videoLessonId_idx"
  ON "VideoRendition"("videoLessonId");

ALTER TABLE "VideoRendition"
  ADD CONSTRAINT "VideoRendition_videoLessonId_fkey"
  FOREIGN KEY ("videoLessonId") REFERENCES "VideoLesson"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "VideoLesson"
SET "status" = 'QUEUED', "updatedAt" = CURRENT_TIMESTAMP
WHERE "provider" = 'R2';
