-- Short-lived playback issuance records bound to account + session + lesson.
CREATE TABLE "VideoPlaybackSession" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "provider" "VideoProvider" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoPlaybackSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VideoPlaybackSession_accountId_issuedAt_idx" ON "VideoPlaybackSession"("accountId", "issuedAt");
CREATE INDEX "VideoPlaybackSession_sessionId_idx" ON "VideoPlaybackSession"("sessionId");
CREATE INDEX "VideoPlaybackSession_lessonId_status_idx" ON "VideoPlaybackSession"("lessonId", "status");