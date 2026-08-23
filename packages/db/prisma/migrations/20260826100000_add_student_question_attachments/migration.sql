-- CreateTable
CREATE TABLE "StudentQuestionAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "storedObjectId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentQuestionAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentQuestionAttachment_messageId_idx" ON "StudentQuestionAttachment"("messageId");

-- CreateIndex
CREATE INDEX "StudentQuestionAttachment_storedObjectId_idx" ON "StudentQuestionAttachment"("storedObjectId");

-- CreateIndex
CREATE INDEX "StudentQuestionAttachment_messageId_storedObjectId_idx" ON "StudentQuestionAttachment"("messageId", "storedObjectId");

-- AddForeignKey
ALTER TABLE "StudentQuestionAttachment" ADD CONSTRAINT "StudentQuestionAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "StudentQuestionMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentQuestionAttachment" ADD CONSTRAINT "StudentQuestionAttachment_storedObjectId_fkey" FOREIGN KEY ("storedObjectId") REFERENCES "StoredObject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;