-- CreateEnum
CREATE TYPE "StudentQuestionStatus" AS ENUM ('PENDING_REVIEW', 'ANSWERED', 'CLOSED');

-- CreateEnum
CREATE TYPE "StudentQuestionSenderType" AS ENUM ('STUDENT', 'STAFF');

-- CreateTable
CREATE TABLE "StudentQuestion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "courseId" TEXT,
    "lessonId" TEXT,
    "status" "StudentQuestionStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentQuestionMessage" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "senderAccountId" TEXT NOT NULL,
    "senderType" "StudentQuestionSenderType" NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentQuestionMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentQuestion_organizationId_idx" ON "StudentQuestion"("organizationId");

-- CreateIndex
CREATE INDEX "StudentQuestion_accountId_idx" ON "StudentQuestion"("accountId");

-- CreateIndex
CREATE INDEX "StudentQuestion_courseId_idx" ON "StudentQuestion"("courseId");

-- CreateIndex
CREATE INDEX "StudentQuestion_lessonId_idx" ON "StudentQuestion"("lessonId");

-- CreateIndex
CREATE INDEX "StudentQuestion_status_idx" ON "StudentQuestion"("status");

-- CreateIndex
CREATE INDEX "StudentQuestion_organizationId_status_createdAt_idx" ON "StudentQuestion"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "StudentQuestionMessage_questionId_idx" ON "StudentQuestionMessage"("questionId");

-- CreateIndex
CREATE INDEX "StudentQuestionMessage_senderAccountId_idx" ON "StudentQuestionMessage"("senderAccountId");

-- AddForeignKey
ALTER TABLE "StudentQuestion" ADD CONSTRAINT "StudentQuestion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentQuestion" ADD CONSTRAINT "StudentQuestion_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentQuestion" ADD CONSTRAINT "StudentQuestion_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentQuestion" ADD CONSTRAINT "StudentQuestion_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentQuestionMessage" ADD CONSTRAINT "StudentQuestionMessage_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "StudentQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentQuestionMessage" ADD CONSTRAINT "StudentQuestionMessage_senderAccountId_fkey" FOREIGN KEY ("senderAccountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
