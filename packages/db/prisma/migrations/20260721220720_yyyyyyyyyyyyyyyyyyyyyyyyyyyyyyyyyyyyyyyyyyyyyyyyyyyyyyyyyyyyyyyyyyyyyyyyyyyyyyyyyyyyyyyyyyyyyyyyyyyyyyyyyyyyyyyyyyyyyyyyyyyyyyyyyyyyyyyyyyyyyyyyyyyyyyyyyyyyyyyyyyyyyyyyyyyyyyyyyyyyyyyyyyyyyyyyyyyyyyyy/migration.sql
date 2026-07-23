/*
  Warnings:

  - You are about to drop the `VideoAsset` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "VideoAsset" DROP CONSTRAINT "VideoAsset_lessonId_fkey";

-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'QUIZ';

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "gradeId" TEXT;

-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "gradeId" TEXT;

-- DropTable
DROP TABLE "VideoAsset";

-- CreateIndex
CREATE INDEX "Question_gradeId_idx" ON "Question"("gradeId");

-- CreateIndex
CREATE INDEX "StudentProfile_gradeId_idx" ON "StudentProfile"("gradeId");

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
