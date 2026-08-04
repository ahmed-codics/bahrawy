-- CreateTable
CREATE TABLE "StoredObject" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "sha256" TEXT,
    "scanStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "scannedAt" TIMESTAMP(3),
    "backupStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "backedUpAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'QUARANTINE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoredObject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoredObject_bucket_objectKey_key" ON "StoredObject"("bucket", "objectKey");

-- CreateIndex
CREATE INDEX "StoredObject_organizationId_idx" ON "StoredObject"("organizationId");

-- CreateIndex
CREATE INDEX "StoredObject_uploadedBy_idx" ON "StoredObject"("uploadedBy");

-- CreateIndex
CREATE INDEX "StoredObject_scanStatus_idx" ON "StoredObject"("scanStatus");
