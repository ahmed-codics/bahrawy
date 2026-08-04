-- CreateTable
CREATE TABLE "VideoLesson" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "hlsBasePath" TEXT NOT NULL,
    "qualityProfile" TEXT NOT NULL DEFAULT '720p_480p',
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoLesson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoDeliveryToken" (
    "id" TEXT NOT NULL,
    "videoLessonId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoDeliveryToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonProgress" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "watchedSeconds" INTEGER NOT NULL DEFAULT 0,
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "lastHeartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VideoLesson_lessonId_key" ON "VideoLesson"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoDeliveryToken_tokenHash_key" ON "VideoDeliveryToken"("tokenHash");

-- CreateIndex
CREATE INDEX "VideoDeliveryToken_accountId_idx" ON "VideoDeliveryToken"("accountId");

-- CreateIndex
CREATE INDEX "VideoDeliveryToken_tokenHash_idx" ON "VideoDeliveryToken"("tokenHash");

-- CreateIndex
CREATE INDEX "LessonProgress_accountId_idx" ON "LessonProgress"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "LessonProgress_accountId_lessonId_key" ON "LessonProgress"("accountId", "lessonId");

-- AddForeignKey
ALTER TABLE "VideoDeliveryToken" ADD CONSTRAINT "VideoDeliveryToken_videoLessonId_fkey" FOREIGN KEY ("videoLessonId") REFERENCES "VideoLesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;
