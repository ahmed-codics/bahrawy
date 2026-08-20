import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { randomUUID, createHmac, timingSafeEqual } from 'crypto';
import sharp from 'sharp';
import { db, Prisma } from '@bahrawy/db';
import { ClamAvService, StorageService } from '../storage/storage.service';

export const MAX_QUESTION_IMAGES = 3;
export const MAX_QUESTION_VOICES = 1;
export const MAX_QUESTION_ATTACHMENTS =
  MAX_QUESTION_IMAGES + MAX_QUESTION_VOICES;
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_VOICE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_IMAGE_DIMENSION = 8000;
const SIGNED_URL_TTL_SECONDS = 6 * 60 * 60; // 6 hours
const SIGNING_SECRET =
  process.env.ATTACHMENT_SIGNING_SECRET || 'dev_attachment_signing_secret';
const IMAGE_QUALITY = 80;
const MAX_IMAGE_SIDE = 1920;

// Max recording duration (seconds), overridable through application config.
const configuredMaxDuration = Number.parseInt(
  process.env.MAX_VOICE_DURATION_SECONDS ?? '',
  10,
);
export const MAX_VOICE_DURATION_SECONDS =
  Number.isFinite(configuredMaxDuration) &&
  configuredMaxDuration >= 10 &&
  configuredMaxDuration <= 900
    ? configuredMaxDuration
    : 180; // 3 minutes default

const SIZE_TOO_LARGE_MESSAGE = 'حجم الصورة يجب ألا يتجاوز 5 ميجابايت';
const INVALID_TYPE_MESSAGE =
  'صيغة الملف غير مدعومة. يُسمح فقط بصور JPG أو PNG أو WebP.';
const TOO_MANY_IMAGES_MESSAGE = 'يُسمح بإرفاق 3 صور كحد أقصى لكل سؤال أو رد.';
const VOICE_SIZE_TOO_LARGE_MESSAGE = 'حجم التسجيل يجب ألا يتجاوز 10 ميجابايت';
const INVALID_AUDIO_MESSAGE = 'صيغة التسجيل الصوتي غير مدعومة';
const TOO_MANY_VOICES_MESSAGE =
  'يُسمح بإرفاق تسجيل صوتي واحد كحد أقصى لكل سؤال أو رد.';
const INVALID_DURATION_MESSAGE = 'مدة التسجيل الصوتي غير صالحة';
const INVALID_REFERENCE_MESSAGE = 'ملف مرفق غير صالح';

export type AttachmentType = 'IMAGE' | 'VOICE';

export interface AttachmentMeta {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: bigint | number;
  type: AttachmentType;
  durationSeconds: number | null;
  url: string;
}

/**
 * Image attachments for the Student Questions feature. Uploads reuse the
 * existing StorageService / StoredObject pipeline (server-side object key,
 * sha256, scan + approval, sharp optimization). Attached images are always
 * re-encoded to WebP (metadata stripped, dimensions capped) before being
 * stored, and are served only through short-lived HMAC-signed URLs bound to
 * the owning question so a tampered URL is rejected.
 */
@Injectable()
export class StudentQuestionAttachmentsService {
  private readonly logger = new Logger(StudentQuestionAttachmentsService.name);

  constructor(
    private readonly storage: StorageService,
    private readonly clam: ClamAvService,
  ) {}

  sniffImageMime(
    buffer: Buffer,
  ): 'image/jpeg' | 'image/png' | 'image/webp' | null {
    if (!buffer || buffer.length < 12) return null;
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'image/jpeg';
    }
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return 'image/png';
    }
    if (
      buffer.toString('latin1', 0, 4) === 'RIFF' &&
      buffer.toString('latin1', 8, 12) === 'WEBP'
    ) {
      return 'image/webp';
    }
    return null;
  }

  /**
   * Sniffs the real audio container from magic bytes (browser MIME is never
   * trusted). Supports the formats MediaRecorder actually produces: WebM
   * (Chrome/Firefox/Edge), Ogg (older Firefox), MP4/M4A (Safari/iOS) and MP3.
   */
  sniffAudioMime(
    buffer: Buffer,
  ): 'audio/webm' | 'audio/ogg' | 'audio/mp4' | 'audio/mpeg' | null {
    if (!buffer || buffer.length < 16) return null;
    // WebM / Matroska EBML magic: 0x1A 0x45 0xDF 0xA3
    if (
      buffer[0] === 0x1a &&
      buffer[1] === 0x45 &&
      buffer[2] === 0xdf &&
      buffer[3] === 0xa3
    ) {
      return 'audio/webm';
    }
    if (buffer.toString('latin1', 0, 4) === 'OggS') return 'audio/ogg';
    // MP4 / M4A: 'ftyp' box at offset 4
    if (buffer.toString('latin1', 4, 8) === 'ftyp') return 'audio/mp4';
    // MP3: ID3 tag or an MPEG frame sync
    if (buffer.toString('latin1', 0, 3) === 'ID3') return 'audio/mpeg';
    if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return 'audio/mpeg';
    return null;
  }

  private audioExtension(mimeType: string): string {
    switch (mimeType) {
      case 'audio/webm':
        return 'webm';
      case 'audio/ogg':
        return 'ogg';
      case 'audio/mp4':
        return 'm4a';
      case 'audio/mpeg':
        return 'mp3';
      default:
        return 'audio';
    }
  }

  /**
   * Validates an uploaded image strictly on the server: actual content is
   * sniffed from magic bytes (never trusting the browser MIME), the file must
   * decode as a raster image, dimensions are capped, and size is capped at
   * 5 MB. The file is re-encoded to WebP (quality 80, capped at 1920px) which
   * strips metadata, then registered in StoredObject and scanned.
   */
  async upload(
    account: { id: string; organizationId: string },
    file: Express.Multer.File | undefined,
  ): Promise<{
    storedObjectId: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
  }> {
    if (!file) {
      throw new BadRequestException('الصورة مطلوبة');
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: SIZE_TOO_LARGE_MESSAGE,
      });
    }

    let header: Buffer;
    try {
      header = await this.readHeader(file.path, 12);
    } catch {
      throw new BadRequestException(INVALID_TYPE_MESSAGE);
    }
    const sniffed = this.sniffImageMime(header);
    if (!sniffed) {
      throw new BadRequestException({
        code: 'INVALID_MIME_TYPE',
        message: INVALID_TYPE_MESSAGE,
      });
    }

    let metadata: sharp.Metadata;
    try {
      metadata = await sharp(file.path).metadata();
    } catch {
      throw new BadRequestException({
        code: 'INVALID_IMAGE',
        message: INVALID_TYPE_MESSAGE,
      });
    }
    if (!metadata.width || !metadata.height) {
      throw new BadRequestException(INVALID_TYPE_MESSAGE);
    }
    if (
      metadata.width > MAX_IMAGE_DIMENSION ||
      metadata.height > MAX_IMAGE_DIMENSION
    ) {
      throw new BadRequestException(
        'أبعاد الصورة كبيرة جداً. اختر صورة بأبعاد أصغر.',
      );
    }

    const originalName = sanitizeFileName(file.originalname);
    const objectKey = `${randomUUID()}.webp`;
    const uploadDir = path.join(process.cwd(), '.uploads', 'storage');
    await fs.mkdir(uploadDir, { recursive: true });
    const finalPath = path.join(uploadDir, objectKey);

    let storedObjectId: string | undefined;
    try {
      await sharp(file.path)
        .rotate()
        .resize({
          width: MAX_IMAGE_SIDE,
          height: MAX_IMAGE_SIDE,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: IMAGE_QUALITY })
        .toFile(finalPath);

      const stat = await fs.stat(finalPath);
      const sha256 = await this.storage.computeFileSha256(finalPath);
      const stored = await this.storage.registerUpload({
        organizationId: account.organizationId,
        uploadedBy: account.id,
        bucket: 'storage',
        objectKey,
        originalName,
        mimeType: 'image/webp',
        sizeBytes: stat.size,
        sha256,
      });
      storedObjectId = stored.id;

      const scanResult = await this.clam.scanFile(finalPath, stored.id);
      await this.storage.markScanResult(stored.id, scanResult);

      return {
        storedObjectId: stored.id,
        originalName,
        mimeType: 'image/webp',
        sizeBytes: stat.size,
      };
    } catch (error) {
      if (storedObjectId) {
        await db.storedObject
          .delete({ where: { id: storedObjectId } })
          .catch(() => undefined);
      }
      try {
        await fs.unlink(finalPath);
      } catch {
        /* ignore */
      }
      throw error;
    }
  }

  /**
   * Validates an uploaded voice recording strictly on the server: the actual
   * container is sniffed from magic bytes (never trusting the browser MIME),
   * the file must be a supported audio format, and size is capped at 10 MB.
   * The recording is stored as-is (MediaRecorder output is already suitable
   * for playback) with a server-side object key, registered in StoredObject
   * and scanned.
   */
  async uploadVoice(
    account: { id: string; organizationId: string },
    file: Express.Multer.File | undefined,
  ): Promise<{
    storedObjectId: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
  }> {
    if (!file) {
      throw new BadRequestException('التسجيل الصوتي مطلوب');
    }
    if (file.size > MAX_VOICE_SIZE_BYTES) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: VOICE_SIZE_TOO_LARGE_MESSAGE,
      });
    }

    let header: Buffer;
    try {
      header = await this.readHeader(file.path, 16);
    } catch {
      throw new BadRequestException(INVALID_AUDIO_MESSAGE);
    }
    const sniffed = this.sniffAudioMime(header);
    if (!sniffed) {
      throw new BadRequestException({
        code: 'INVALID_MIME_TYPE',
        message: INVALID_AUDIO_MESSAGE,
      });
    }

    const originalName = sanitizeFileName(file.originalname);
    const objectKey = `${randomUUID()}.${this.audioExtension(sniffed)}`;
    const uploadDir = path.join(process.cwd(), '.uploads', 'storage');
    await fs.mkdir(uploadDir, { recursive: true });
    const finalPath = path.join(uploadDir, objectKey);

    let storedObjectId: string | undefined;
    try {
      await fs.copyFile(file.path, finalPath);
      await fs.unlink(file.path).catch(() => undefined);

      const stat = await fs.stat(finalPath);
      const sha256 = await this.storage.computeFileSha256(finalPath);
      const stored = await this.storage.registerUpload({
        organizationId: account.organizationId,
        uploadedBy: account.id,
        bucket: 'storage',
        objectKey,
        originalName,
        mimeType: sniffed,
        sizeBytes: stat.size,
        sha256,
      });
      storedObjectId = stored.id;

      const scanResult = await this.clam.scanFile(finalPath, stored.id);
      await this.storage.markScanResult(stored.id, scanResult);

      return {
        storedObjectId: stored.id,
        originalName,
        mimeType: sniffed,
        sizeBytes: stat.size,
      };
    } catch (error) {
      if (storedObjectId) {
        await db.storedObject
          .delete({ where: { id: storedObjectId } })
          .catch(() => undefined);
      }
      try {
        await fs.unlink(finalPath);
      } catch {
        /* ignore */
      }
      throw error;
    }
  }

  /**
   * Validates a list of attachment storedObjectIds before they are attached to
   * a message: max 4 total (3 images + 1 voice), each must exist and be
   * APPROVED, must be an image or a supported audio file, must belong to the
   * same organization, and (for students) must have been uploaded by the same
   * account. Voice durations (if provided) are bounds-checked. Prevents
   * referencing arbitrary storage keys.
   */
  async resolveAttachments(
    organizationId: string,
    accountId: string,
    attachmentIds: string[] | undefined,
    isStaff: boolean,
    voiceDurations?: Record<string, number>,
    existingVoiceCount = 0,
  ): Promise<
    Array<{
      id: string;
      originalName: string;
      mimeType: string;
      sizeBytes: bigint;
      type: AttachmentType;
      durationSeconds: number | null;
    }>
  > {
    if (!attachmentIds || attachmentIds.length === 0) return [];
    if (attachmentIds.length > MAX_QUESTION_ATTACHMENTS) {
      throw new BadRequestException({
        code: 'TOO_MANY_ATTACHMENTS',
        message: TOO_MANY_IMAGES_MESSAGE,
      });
    }

    const objects = await db.storedObject.findMany({
      where: { id: { in: attachmentIds } },
    });
    if (objects.length !== attachmentIds.length) {
      throw new BadRequestException({
        code: 'INVALID_ATTACHMENT',
        message: INVALID_REFERENCE_MESSAGE,
      });
    }

    let imageCount = 0;
    let voiceCount = 0;
    const resolved: Array<{
      id: string;
      originalName: string;
      mimeType: string;
      sizeBytes: bigint;
      type: AttachmentType;
      durationSeconds: number | null;
    }> = [];

    for (const object of objects) {
      if (object.status !== 'APPROVED') {
        throw new BadRequestException({
          code: 'INVALID_ATTACHMENT',
          message: INVALID_REFERENCE_MESSAGE,
        });
      }
      const isImage = object.mimeType.startsWith('image/');
      const isVoice = object.mimeType.startsWith('audio/');
      if (!isImage && !isVoice) {
        throw new BadRequestException({
          code: 'INVALID_ATTACHMENT',
          message: INVALID_REFERENCE_MESSAGE,
        });
      }
      if (object.organizationId !== organizationId) {
        throw new ForbiddenException({
          code: 'ATTACHMENT_ORG_MISMATCH',
          message: INVALID_REFERENCE_MESSAGE,
        });
      }
      if (!isStaff && object.uploadedBy !== accountId) {
        throw new ForbiddenException({
          code: 'ATTACHMENT_OWNER_MISMATCH',
          message: INVALID_REFERENCE_MESSAGE,
        });
      }

      if (isImage) {
        imageCount += 1;
        if (imageCount > MAX_QUESTION_IMAGES) {
          throw new BadRequestException({
            code: 'TOO_MANY_ATTACHMENTS',
            message: TOO_MANY_IMAGES_MESSAGE,
          });
        }
        resolved.push({
          id: object.id,
          originalName: object.originalName,
          mimeType: object.mimeType,
          sizeBytes: object.sizeBytes,
          type: 'IMAGE',
          durationSeconds: null,
        });
      } else {
        voiceCount += 1;
        if (voiceCount + existingVoiceCount > MAX_QUESTION_VOICES) {
          throw new BadRequestException({
            code: 'TOO_MANY_ATTACHMENTS',
            message: TOO_MANY_VOICES_MESSAGE,
          });
        }
        const provided = voiceDurations?.[object.id];
        let durationSeconds: number | null = null;
        if (provided !== undefined) {
          if (
            !Number.isInteger(provided) ||
            provided < 1 ||
            provided > MAX_VOICE_DURATION_SECONDS
          ) {
            throw new BadRequestException({
              code: 'INVALID_DURATION',
              message: INVALID_DURATION_MESSAGE,
            });
          }
          durationSeconds = provided;
        }
        resolved.push({
          id: object.id,
          originalName: object.originalName,
          mimeType: object.mimeType,
          sizeBytes: object.sizeBytes,
          type: 'VOICE',
          durationSeconds,
        });
      }
    }
    return resolved;
  }

  /**
   * Persists attachment rows for a message inside the caller's transaction.
   */
  async linkToMessage(
    tx: Prisma.TransactionClient,
    messageId: string,
    attachments: Array<{
      storedObjectId: string;
      originalName: string;
      mimeType: string;
      sizeBytes: bigint;
      type: AttachmentType;
      durationSeconds: number | null;
    }>,
  ): Promise<void> {
    await tx.studentQuestionAttachment.createMany({
      data: attachments.map((attachment) => ({
        messageId,
        storedObjectId: attachment.storedObjectId,
        originalName: attachment.originalName,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        type: attachment.type,
        durationSeconds: attachment.durationSeconds,
      })),
    });
  }

  signImageUrl(
    accountId: string,
    questionId: string,
    attachmentId: string,
    basePath: string,
  ): string {
    const expiresAt = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS;
    const token = this.signToken(
      accountId,
      questionId,
      attachmentId,
      expiresAt,
    ).toString('base64url');
    return `${basePath}/${questionId}/attachments/${attachmentId}?expires=${expiresAt}&account=${accountId}&token=${token}`;
  }

  verifyImageToken(
    accountId: string,
    questionId: string,
    attachmentId: string,
    expiresAt: string | undefined,
    token: string | undefined,
  ): boolean {
    if (!token || !expiresAt) return false;
    const expires = Number.parseInt(expiresAt, 10);
    if (!Number.isFinite(expires) || expires < Math.floor(Date.now() / 1000)) {
      return false;
    }
    const expected = this.signToken(
      accountId,
      questionId,
      attachmentId,
      expires,
    );
    let received: Buffer;
    try {
      received = Buffer.from(token, 'base64url');
    } catch {
      return false;
    }
    return (
      received.length === expected.length && timingSafeEqual(expected, received)
    );
  }

  private signToken(
    accountId: string,
    questionId: string,
    attachmentId: string,
    expiresAt: number,
  ): Buffer {
    return createHmac('sha256', SIGNING_SECRET)
      .update(`${accountId}:${questionId}:${attachmentId}:${expiresAt}`)
      .digest();
  }

  /**
   * Streams the stored image file for an attachment after the signed URL has
   * been verified. Reads through StoredObject so storage credentials and
   * private paths are never exposed.
   */
  async resolveFile(
    questionId: string,
    attachmentId: string,
  ): Promise<{ mimeType: string; filePath: string }> {
    const attachment = await db.studentQuestionAttachment.findFirst({
      where: {
        id: attachmentId,
        message: { questionId },
      },
      select: {
        storedObjectId: true,
        mimeType: true,
      },
    });
    if (!attachment) {
      throw new BadRequestException('الملف غير متاح');
    }
    const object = await db.storedObject.findFirst({
      where: { id: attachment.storedObjectId, status: 'APPROVED' },
    });
    if (!object) {
      throw new BadRequestException('الملف غير متاح');
    }
    const filePath = path.join(
      process.cwd(),
      '.uploads',
      'storage',
      object.objectKey,
    );
    try {
      await fs.access(filePath);
    } catch {
      throw new BadRequestException('الملف غير متاح');
    }
    return { mimeType: attachment.mimeType, filePath };
  }

  /**
   * Decorates raw attachment rows with short-lived signed image URLs so the
   * frontend can render `<img>` / `<audio>` tags without the device-fingerprint
   * header. Type and voice duration are passed through for rendering.
   */
  decorate(
    accountId: string,
    questionId: string,
    basePath: string,
    attachments: Array<{
      id: string;
      originalName: string;
      mimeType: string;
      sizeBytes: bigint | number;
      type?: string;
      durationSeconds?: number | null;
    }>,
  ): AttachmentMeta[] {
    return (attachments || []).map((attachment) => ({
      id: attachment.id,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      sizeBytes:
        typeof attachment.sizeBytes === 'bigint'
          ? Number(attachment.sizeBytes)
          : attachment.sizeBytes,
      type: attachment.type === 'VOICE' ? 'VOICE' : 'IMAGE',
      durationSeconds: attachment.durationSeconds ?? null,
      url: this.signImageUrl(accountId, questionId, attachment.id, basePath),
    }));
  }

  /**
   * Public client-side policy (single source of truth) so the recorder UI and
   * timers match the server-side limits instead of duplicating constants.
   */
  getPolicy() {
    return {
      maxImageCount: MAX_QUESTION_IMAGES,
      maxImageSizeBytes: MAX_IMAGE_SIZE_BYTES,
      maxVoiceCount: MAX_QUESTION_VOICES,
      maxVoiceSizeBytes: MAX_VOICE_SIZE_BYTES,
      maxVoiceDurationSeconds: MAX_VOICE_DURATION_SECONDS,
    };
  }

  private async readHeader(filePath: string, length: number): Promise<Buffer> {
    const handle = await fs.open(filePath, 'r');
    try {
      const buffer = Buffer.alloc(length);
      const { bytesRead } = await handle.read(buffer, 0, length, 0);
      return buffer.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }
  }
}

function sanitizeFileName(name: string): string {
  const base = path
    .basename(name || 'image')
    .replace(/[^\w.\-\u0600-\u06FF ]/g, '_')
    .trim();
  return base.slice(0, 120) || 'image';
}
