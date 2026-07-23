-- AlterTable
ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'BUNDLE',
  ADD COLUMN IF NOT EXISTS "coverImageUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "descriptionAr" TEXT;

-- AlterTable
ALTER TABLE "Lesson"
  ADD COLUMN IF NOT EXISTS "attachedPdfUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "homeworkPdfUrl" TEXT;

-- AlterTable
ALTER TABLE "Assessment"
  ADD COLUMN IF NOT EXISTS "unitId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ProductUnit" (
  "productId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ProductUnit_pkey" PRIMARY KEY ("productId","unitId")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ProductUnit_unitId_idx" ON "ProductUnit"("unitId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Assessment_unitId_idx" ON "Assessment"("unitId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProductUnit_productId_fkey'
  ) THEN
    ALTER TABLE "ProductUnit" ADD CONSTRAINT "ProductUnit_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ProductUnit_unitId_fkey'
  ) THEN
    ALTER TABLE "ProductUnit" ADD CONSTRAINT "ProductUnit_unitId_fkey"
      FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Assessment_unitId_fkey'
  ) THEN
    ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_unitId_fkey"
      FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
