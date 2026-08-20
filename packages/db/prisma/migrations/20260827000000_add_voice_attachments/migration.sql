ALTER TABLE "StudentQuestionAttachment" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'IMAGE';
ALTER TABLE "StudentQuestionAttachment" ADD COLUMN "durationSeconds" INTEGER;