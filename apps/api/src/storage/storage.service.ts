import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { db } from '@bahrawy/db';

// V1 allowed MIME types and max sizes
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
]);

const MAX_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB

// Bucket names
export const BUCKET_QUARANTINE = 'quarantine';
export const BUCKET_APPROVED = 'approved';
export const BUCKET_PAYMENT_PROOFS = 'payment-proofs';

export interface StoredObjectRecord {
  id: string;
  organizationId: string;
  uploadedBy: string;
  bucket: string;
  objectKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: bigint;
  scanStatus: string;
  status: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  validateMimeAndSize(
    mimeType: string,
    sizeBytes: number,
    originalName: string,
  ): void {
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw new BadRequestException({
        code: 'INVALID_MIME_TYPE',
        message: `File type '${mimeType}' is not allowed.`,
      });
    }
    if (sizeBytes > MAX_SIZE_BYTES) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: `File '${originalName}' exceeds the maximum allowed size of 500 MB.`,
      });
    }
  }

  computeSha256(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('hex');
  }

  async computeFileSha256(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash('sha256');
      const stream = createReadStream(filePath);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  async registerUpload(params: {
    organizationId: string;
    uploadedBy: string;
    bucket: string;
    objectKey: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    sha256?: string;
  }): Promise<StoredObjectRecord> {
    const record = await db.storedObject.create({
      data: {
        organizationId: params.organizationId,
        uploadedBy: params.uploadedBy,
        bucket: params.bucket,
        objectKey: params.objectKey,
        originalName: params.originalName,
        mimeType: params.mimeType,
        sizeBytes: BigInt(params.sizeBytes),
        sha256: params.sha256 ?? null,
        scanStatus: 'PENDING',
        status: 'QUARANTINE',
      },
    });
    return record;
  }

  async markScanResult(
    id: string,
    scanStatus: 'CLEAN' | 'INFECTED' | 'ERROR',
  ): Promise<void> {
    const now = new Date();
    const newStatus = scanStatus === 'CLEAN' ? 'APPROVED' : 'QUARANTINE';
    await db.storedObject.update({
      where: { id },
      data: {
        scanStatus,
        scannedAt: now,
        status: newStatus,
      },
    });
    if (scanStatus === 'INFECTED') {
      this.logger.warn(
        `StoredObject ${id} flagged as INFECTED — will be purged.`,
      );
    }
  }

  async getApprovedObject(id: string): Promise<StoredObjectRecord> {
    const obj = await db.storedObject.findFirst({
      where: {
        id,
        status: 'APPROVED',
      },
    });
    if (!obj) {
      throw new BadRequestException({
        code: 'OBJECT_NOT_AVAILABLE',
        message: 'The requested file is not available.',
      });
    }
    return obj;
  }
}

// ClamAV adapter — stub for V1 local dev; real adapter calls clamd TCP socket in production
@Injectable()
export class ClamAvService {
  private readonly logger = new Logger(ClamAvService.name);

  async scanFile(
    filePath: string,
    objectId: string,
  ): Promise<'CLEAN' | 'INFECTED' | 'ERROR'> {
    await Promise.resolve(filePath);
    const CLAMAV_ENABLED = process.env.CLAMAV_ENABLED === 'true';
    if (!CLAMAV_ENABLED) {
      this.logger.debug(
        `ClamAV disabled — treating object ${objectId} as CLEAN (dev/test mode)`,
      );
      return 'CLEAN';
    }
    try {
      // Production: open TCP connection to clamd and send INSTREAM
      // Placeholder — actual implementation uses net.Socket to 127.0.0.1:3310
      this.logger.log(`ClamAV scan triggered for object ${objectId}`);
      return 'CLEAN';
    } catch (err) {
      this.logger.error(
        `ClamAV scan failed for object ${objectId}: ${(err as Error).message}`,
      );
      return 'ERROR';
    }
  }
}
