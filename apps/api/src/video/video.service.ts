import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { db, VideoProvider } from '@bahrawy/db';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { CatalogService } from '../catalog/catalog.service';
import { VideoAccessService } from '../video-access/video-access.grants.service';

// Short-lived playback tokens bound to account+session+lesson; re-validated on
// every media request so a shared/replayed URL dies once access is revoked.
const PLAYBACK_URL_TTL_SECONDS = 15 * 60;
const UPLOAD_URL_TTL_SECONDS = 15 * 60;
const VIDEO_PATH_CACHE_MAX = 1000;
// Entitlement re-checks at stream time are cached briefly to avoid a DB hit
// per range request while still refusing access within a second of revocation.
const ACCESS_REVALIDATE_MS = 60 * 1000;
const ACCESS_CACHE_MAX = 5000;
const DENY_LOG_DEDUPE_MS = 30 * 1000;

export type VideoPlayback = {
  provider: VideoProvider;
  url?: string;
  videoId?: string;
  expiresInSeconds?: number;
  defaultQuality?: string;
  sources?: Array<{ quality: string; url: string }>;
  processingStatus?: string;
};

type StoredVideo = {
  id: string;
  lessonId: string;
  provider: VideoProvider;
  sourceRef: string;
  mimeType: string | null;
  status: string;
  renditions?: Array<{ quality: string; objectKey: string; mimeType: string }>;
};

@Injectable()
export class VideoService {
  private readonly videoPathCache = new Map<
    string,
    { path: string; expiresAt: number }
  >();
  private readonly accessCache = new Map<
    string,
    { allowed: boolean; expiresAt: number }
  >();
  private readonly denyLogCache = new Map<string, number>();
  private r2Client: S3Client | null = null;

  constructor(
    private readonly catalogService: CatalogService,
    private readonly videoAccess: VideoAccessService,
  ) {}

  private cacheGet(key: string) {
    const value = this.videoPathCache.get(key);
    if (value === undefined) return undefined;
    this.videoPathCache.delete(key);
    this.videoPathCache.set(key, value);
    return value;
  }

  private cacheSet(key: string, value: { path: string; expiresAt: number }) {
    if (this.videoPathCache.size >= VIDEO_PATH_CACHE_MAX) {
      const oldest = this.videoPathCache.keys().next().value;
      if (oldest !== undefined) this.videoPathCache.delete(oldest);
    }
    this.videoPathCache.set(key, value);
  }

  async getLessonPlayback(
    accountId: string,
    lessonId: string,
    isStaff = false,
    sessionId?: string,
    deviceFingerprint?: string,
  ): Promise<VideoPlayback> {
    await this.assertPlaybackAuthorized(
      accountId,
      lessonId,
      isStaff,
      sessionId,
    );
    const video = await db.videoLesson.findUnique({
      where: { lessonId },
      include: { renditions: { orderBy: { height: 'asc' } } },
    });
    if (!video) {
      throw new NotFoundException('Video lesson not found');
    }
    const playback = await this.createPlayback(video, {
      accountId,
      sessionId,
      deviceFingerprint,
    });

    // Record a short-lived playback session for authenticated requests
    // (staff/admin preview streams are not tracked).
    if (accountId && sessionId) {
      await this.issuePlaybackSession(
        accountId,
        lessonId,
        sessionId,
        playback.provider,
      );
    }

    await this.logSecurityEvent(accountId, 'VIDEO_PLAYBACK_ISSUED', 'SUCCESS', {
      lessonId,
      provider: playback.provider,
      isStaff,
    });
    return playback;
  }

  /**
   * Playback authorization for a student: normal catalog access (entitlement,
   * prerequisite, quiz gates) OR an active VideoAccessGrant. Staff always pass.
   * When only a grant would apply, that grant is required to be live — expired
   * or revoked grants map to explicit 403 codes.
   */
  private async assertPlaybackAuthorized(
    accountId: string,
    lessonId: string,
    isStaff: boolean,
    sessionId?: string,
  ): Promise<void> {
    if (isStaff) return;
    let normalAccess = false;
    try {
      await this.catalogService.canAccessLesson(accountId, lessonId);
      normalAccess = true;
    } catch (error: any) {
      if (!(error instanceof ForbiddenException)) throw error;
    }

    if (normalAccess) return;

    const grant = await this.videoAccess.findActiveGrant(
      accountId,
      lessonId,
      sessionId,
    );
    if (!grant) {
      // Distinguish an explicitly denied grant from no grant at all.
      const record = await db.videoAccessGrant.findFirst({
        where: { accountId, lessonId },
        orderBy: { grantedAt: 'desc' },
        select: { revokedAt: true, expiresAt: true },
      });
      if (record) {
        if (record.revokedAt) {
          throw new ForbiddenException({
            code: 'VIDEO_ACCESS_REVOKED',
            message: 'Access to this video has been revoked.',
          });
        }
        if (record.expiresAt && record.expiresAt.getTime() <= Date.now()) {
          throw new ForbiddenException({
            code: 'VIDEO_ACCESS_EXPIRED',
            message: 'Your video access has expired.',
          });
        }
      }
      throw new ForbiddenException({
        code: 'VIDEO_ACCESS_NOT_GRANTED',
        message: 'Video access has not been granted for this lesson.',
      });
    }
  }

  async getAdminPlayback(lessonId: string): Promise<VideoPlayback> {
    const video = await db.videoLesson.findUnique({
      where: { lessonId },
      include: { renditions: { orderBy: { height: 'asc' } } },
    });
    if (!video) {
      throw new NotFoundException('Video lesson not found');
    }
    return this.createPlayback(video, {});
  }

  async signLessonHlsUrl(
    accountId: string,
    lessonId: string,
    _clientIp: string,
    isStaff = false,
  ): Promise<string> {
    const playback = await this.getLessonPlayback(accountId, lessonId, isStaff);
    if (!playback.url) {
      throw new BadRequestException(
        'This provider does not expose a direct video URL',
      );
    }
    return playback.url;
  }

  verifyLessonVideoToken(
    lessonId: string,
    token: string,
    expires: string,
    accountId?: string,
    sessionId?: string,
  ) {
    const expiresAt = Number.parseInt(expires, 10);
    if (
      !token ||
      !Number.isFinite(expiresAt) ||
      expiresAt < Math.floor(Date.now() / 1000)
    ) {
      return false;
    }

    const secret =
      process.env.VIDEO_DELIVERY_SECRET ||
      process.env.VIDEO_SIGNING_SECRET ||
      'dev_video_secret_key_123';
    const expected = createHmac('sha256', secret)
      .update(`${accountId ?? ''}:${sessionId ?? ''}:${lessonId}:${expiresAt}`)
      .digest();

    let received: Buffer;
    try {
      received = Buffer.from(token, 'base64url');
    } catch {
      return false;
    }

    return (
      received.length === expected.length && timingSafeEqual(received, expected)
    );
  }

  async getVideoFilePath(lessonId: string) {
    const cached = this.cacheGet(lessonId);
    if (cached && cached.expiresAt > Date.now() && fs.existsSync(cached.path)) {
      return cached.path;
    }

    const video = await db.videoLesson.findUnique({ where: { lessonId } });
    if (
      !video ||
      video.provider !== VideoProvider.LOCAL ||
      !fs.existsSync(video.sourceRef)
    ) {
      throw new NotFoundException('Local video file not found');
    }

    this.cacheSet(lessonId, {
      path: video.sourceRef,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });
    return video.sourceRef;
  }

  async createR2UploadUrl(
    lessonId: string,
    originalFileName: string,
    mimeType: string,
    fileSizeBytes: number,
  ) {
    await this.assertLessonExists(lessonId);
    if (mimeType !== 'video/mp4') {
      throw new BadRequestException(
        'R2 videos must be MP4 files encoded for web playback',
      );
    }
    if (
      !Number.isSafeInteger(fileSizeBytes) ||
      fileSizeBytes <= 0
    ) {
      throw new BadRequestException(
        'Video size must be at least 1 byte',
      );
    }

    const safeName = this.sanitizeFileName(originalFileName);
    const objectKey = `lessons/${lessonId}/${randomUUID()}-${safeName}`;
    const { bucket } = this.getR2Config();
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ContentType: mimeType,
    });
    const uploadUrl = await getSignedUrl(this.getR2Client(), command, {
      expiresIn: UPLOAD_URL_TTL_SECONDS,
    });

    return {
      provider: VideoProvider.R2,
      uploadUrl,
      objectKey,
      expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
    };
  }

  async createR2MultipartUpload(
    lessonId: string,
    originalFileName: string,
    mimeType: string,
    fileSizeBytes: number,
    partsCount: number,
  ) {
    await this.assertLessonExists(lessonId);
    if (mimeType !== 'video/mp4') {
      throw new BadRequestException('R2 videos must be MP4 files encoded for web playback');
    }
    if (!Number.isSafeInteger(fileSizeBytes) || fileSizeBytes <= 0) {
      throw new BadRequestException('Video size must be at least 1 byte');
    }

    const safeName = this.sanitizeFileName(originalFileName);
    const objectKey = `lessons/${lessonId}/${randomUUID()}-${safeName}`;
    const { bucket } = this.getR2Config();
    
    let uploadId: string;
    try {
      const response = await this.getR2Client().send(
        new CreateMultipartUploadCommand({
          Bucket: bucket,
          Key: objectKey,
          ContentType: mimeType,
        })
      );
      if (!response.UploadId) throw new Error('No UploadId returned');
      uploadId = response.UploadId;
    } catch (error) {
      throw new ServiceUnavailableException('Failed to initialize multipart upload');
    }

    const parts = await Promise.all(
      Array.from({ length: partsCount }, async (_, i) => {
        const partNumber = i + 1;
        const command = new UploadPartCommand({
          Bucket: bucket,
          Key: objectKey,
          UploadId: uploadId,
          PartNumber: partNumber,
        });
        const url = await getSignedUrl(this.getR2Client(), command, {
          expiresIn: UPLOAD_URL_TTL_SECONDS * 4, // Allow more time for large multipart uploads
        });
        return { partNumber, url };
      })
    );

    return {
      provider: VideoProvider.R2,
      uploadId,
      objectKey,
      parts,
    };
  }

  async completeR2MultipartUpload(
    lessonId: string,
    uploadId: string,
    objectKey: string,
    originalFileName: string,
    mimeType: string,
    parts: { PartNumber: number; ETag: string }[],
  ) {
    await this.assertLessonExists(lessonId);
    if (!objectKey.startsWith(`lessons/${lessonId}/`)) {
      throw new BadRequestException('Invalid R2 object key for this lesson');
    }

    const { bucket } = this.getR2Config();
    try {
      await this.getR2Client().send(
        new CompleteMultipartUploadCommand({
          Bucket: bucket,
          Key: objectKey,
          UploadId: uploadId,
          MultipartUpload: {
            Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber),
          },
        })
      );
    } catch (error: any) {
      console.error(`[CompleteMultipartUpload] Failed for ${uploadId}. Parts provided:`, parts.length);
      console.error(`[CompleteMultipartUpload] Error detail:`, error);
      throw new BadRequestException(`فشل تجميع الفيديو في R2. السبب: ${error?.message || 'Unknown'}`);
    }

    return this.replaceVideoLesson(lessonId, {
      provider: VideoProvider.R2,
      sourceRef: objectKey,
      originalFileName,
      mimeType,
      status: 'QUEUED',
    });
  }

  async abortR2MultipartUpload(
    lessonId: string,
    uploadId: string,
    objectKey: string,
  ) {
    await this.assertLessonExists(lessonId);
    if (!objectKey.startsWith(`lessons/${lessonId}/`)) {
      throw new BadRequestException('Invalid R2 object key for this lesson');
    }

    const { bucket } = this.getR2Config();
    try {
      await this.getR2Client().send(
        new AbortMultipartUploadCommand({
          Bucket: bucket,
          Key: objectKey,
          UploadId: uploadId,
        })
      );
    } catch (error) {
      // It might have already been aborted or completed
    }
    return { status: 'ABORTED' };
  }


  async confirmR2Upload(
    lessonId: string,
    objectKey: string,
    originalFileName: string,
    mimeType: string,
  ) {
    await this.assertLessonExists(lessonId);
    if (!objectKey.startsWith(`lessons/${lessonId}/`)) {
      throw new BadRequestException('Invalid R2 object key for this lesson');
    }

    const { bucket } = this.getR2Config();
    let uploadedObject;
    try {
      uploadedObject = await this.getR2Client().send(
        new HeadObjectCommand({ Bucket: bucket, Key: objectKey }),
      );
    } catch {
      throw new BadRequestException(
        'The R2 upload could not be verified. Upload the file again.',
      );
    }
    if (!uploadedObject.ContentLength) {
      throw new BadRequestException('The uploaded R2 object is empty');
    }

    return this.replaceVideoLesson(lessonId, {
      provider: VideoProvider.R2,
      sourceRef: objectKey,
      originalFileName,
      mimeType: uploadedObject.ContentType || mimeType,
      status: 'QUEUED',
    });
  }

  async setYouTubeVideo(lessonId: string, input: string) {
    await this.assertLessonExists(lessonId);
    const videoId = this.parseYouTubeVideoId(input);
    if (!videoId) {
      throw new BadRequestException('Enter a valid YouTube video URL or ID');
    }
    return this.replaceVideoLesson(lessonId, {
      provider: VideoProvider.YOUTUBE,
      sourceRef: videoId,
      originalFileName: null,
      mimeType: null,
    });
  }

  async processUpload(lessonId: string, file: Express.Multer.File) {
    let writtenFile: string | undefined;

    try {
      await this.assertLessonExists(lessonId);

      const uploadDir = path.join(
        process.cwd(),
        '.uploads',
        'videos',
        lessonId,
      );
      fs.mkdirSync(uploadDir, { recursive: true });

      const safeOriginalName = this.sanitizeFileName(file.originalname);
      const fileName = `${Date.now()}_${safeOriginalName}`;
      const filePath = path.join(uploadDir, fileName);

      if (file.path) {
        fs.renameSync(file.path, filePath);
        writtenFile = filePath;
      } else if (file.buffer) {
        fs.writeFileSync(filePath, file.buffer);
        writtenFile = filePath;
      } else {
        throw new BadRequestException('Uploaded video file is unavailable');
      }

      const videoLesson = await this.replaceVideoLesson(lessonId, {
        provider: VideoProvider.LOCAL,
        sourceRef: filePath,
        originalFileName: file.originalname,
        mimeType: file.mimetype,
      });

      this.cacheSet(lessonId, {
        path: filePath,
        expiresAt: Date.now() + 5 * 60 * 1000,
      });
      return videoLesson;
    } catch (error) {
      if (writtenFile) {
        try {
          fs.unlinkSync(writtenFile);
        } catch {
          /* ignore */
        }
      }
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw error;
    }
  }

  async updateWatchProgress(
    accountId: string,
    lessonId: string,
    watchedSeconds: number,
    durationSeconds: number,
  ): Promise<{ id: string; completed: boolean; watchedSeconds: number }> {
    await this.catalogService.canAccessLesson(accountId, lessonId);
    const isCompleted =
      durationSeconds > 0 && watchedSeconds / durationSeconds >= 0.9;
    let canAutoComplete = isCompleted;
    if (isCompleted) {
      canAutoComplete = await this.canCompleteLesson(accountId, lessonId);
    }
    const now = new Date();
    const progress = await db.lessonProgress.upsert({
      where: {
        accountId_lessonId: {
          accountId,
          lessonId,
        },
      },
      create: {
        accountId,
        lessonId,
        watchedSeconds,
        durationSeconds,
        completedAt: canAutoComplete ? now : null,
        lastHeartbeatAt: now,
      },
      update: {
        watchedSeconds: { set: watchedSeconds },
        durationSeconds: { set: durationSeconds },
        lastHeartbeatAt: now,
        completedAt: canAutoComplete ? { set: now } : undefined,
      },
    });
    return {
      id: progress.id,
      completed: !!progress.completedAt,
      watchedSeconds: progress.watchedSeconds,
    };
  }

  private async canCompleteLesson(
    accountId: string,
    lessonId: string,
  ): Promise<boolean> {
    const gate = await db.assessment.findFirst({
      where: {
        lessonId,
        status: 'PUBLISHED',
        archivedAt: null,
        passingScore: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, passingScore: true },
    });
    if (!gate) return true;
    if (gate.passingScore === null) return true;
    const passed = await db.assessmentAttempt.findFirst({
      where: {
        accountId,
        assessmentId: gate.id,
        submittedAt: { not: null },
        score: { gte: gate.passingScore },
      },
      select: { id: true },
    });
    return Boolean(passed);
  }

  async getResumePosition(
    accountId: string,
    lessonId: string,
  ): Promise<number> {
    await this.catalogService.canAccessLesson(accountId, lessonId);
    const progress = await db.lessonProgress.findUnique({
      where: {
        accountId_lessonId: { accountId, lessonId },
      },
    });
    return progress?.watchedSeconds || 0;
  }

  private async createPlayback(
    video: StoredVideo,
    context: {
      accountId?: string;
      sessionId?: string;
      deviceFingerprint?: string;
    } = {},
  ): Promise<VideoPlayback> {
    if (video.provider === VideoProvider.YOUTUBE) {
      return {
        provider: VideoProvider.YOUTUBE,
        videoId: video.sourceRef,
        expiresInSeconds: PLAYBACK_URL_TTL_SECONDS,
      };
    }

    if (video.provider === VideoProvider.R2) {
      const { bucket } = this.getR2Config();
      const signObject = (objectKey: string, mimeType = 'video/mp4') =>
        getSignedUrl(
          this.getR2Client(),
          new GetObjectCommand({
            Bucket: bucket,
            Key: objectKey,
            ResponseContentType: mimeType,
            ResponseContentDisposition: 'inline',
          }),
          { expiresIn: PLAYBACK_URL_TTL_SECONDS },
        );
      const sources = await Promise.all(
        (video.renditions || []).map(async (rendition) => ({
          quality: rendition.quality,
          url: await signObject(rendition.objectKey, rendition.mimeType),
        })),
      );
      const defaultSource =
        sources.find((source) => source.quality === '480p') ?? sources[0];
      const url =
        defaultSource?.url ??
        (await signObject(video.sourceRef, video.mimeType || 'video/mp4'));
      return {
        provider: VideoProvider.R2,
        url,
        ...(sources.length
          ? { sources, defaultQuality: defaultSource?.quality }
          : {}),
        ...(video.status ? { processingStatus: video.status } : {}),
        expiresInSeconds: PLAYBACK_URL_TTL_SECONDS,
      };
    }

    const expires = Math.floor(Date.now() / 1000) + PLAYBACK_URL_TTL_SECONDS;
    const secret =
      process.env.VIDEO_DELIVERY_SECRET ||
      process.env.VIDEO_SIGNING_SECRET ||
      'dev_video_secret_key_123';
    const baseUrl =
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.API_ORIGIN ||
      'http://localhost:3000';

    // Bind the token to account + session + lesson so a URL captured by one
    // student cannot be replayed by another, and dies when the session is
    // revoked. Anonymous (admin preview) streams still work with a non-bound token.
    const boundAccountId = context.accountId ?? '';
    const boundSessionId = context.sessionId ?? '';
    const localToken = createHmac('sha256', secret)
      .update(
        `${boundAccountId}:${boundSessionId}:${video.lessonId}:${expires}`,
      )
      .digest('base64url');

    if (boundAccountId && boundSessionId) {
      const tokenHash = createHash('sha256').update(localToken).digest('hex');
      await db.videoDeliveryToken
        .create({
          data: {
            videoLessonId: video.id,
            accountId: boundAccountId,
            sessionId: boundSessionId,
            tokenHash,
            expiresAt: new Date(expires * 1000),
          },
        })
        .catch(() => undefined);
    }

    return {
      provider: VideoProvider.LOCAL,
      url: `${baseUrl}/video/${video.lessonId}/stream.mp4?token=${localToken}&expires=${expires}&account=${encodeURIComponent(boundAccountId)}&session=${encodeURIComponent(boundSessionId)}`,
      expiresInSeconds: PLAYBACK_URL_TTL_SECONDS,
    };
  }

  // Records a short-lived playback issuance bound to account + session +
  // lesson. Purges this account's already-expired sessions on each issuance so
  // the table stays small. Issuance is best-effort: logging/audit failures must
  // never break playback.
  private async issuePlaybackSession(
    accountId: string,
    lessonId: string,
    sessionId: string,
    provider: VideoProvider,
  ): Promise<void> {
    try {
      const now = new Date();
      await db.videoPlaybackSession.deleteMany({
        where: { accountId, status: 'ACTIVE', expiresAt: { lte: now } },
      });
      await db.videoPlaybackSession.create({
        data: {
          lessonId,
          accountId,
          sessionId,
          provider,
          expiresAt: new Date(
            Date.now() + PLAYBACK_URL_TTL_SECONDS * 1000,
          ),
        },
      });
    } catch {
      // never fail the request because session recording failed
    }
  }

  // Re-validates entitlement (or an active video-access grant) at media-request
  // time. The result is cached for a short window so per-segment range requests
  // stay cheap, while revocation is still enforced within ~60 seconds.
  async assertEntitlementAtStreamTime(
    accountId: string,
    lessonId: string,
    sessionId?: string,
  ): Promise<boolean> {
    const cacheKey = `${accountId}:${lessonId}`;
    const cached = this.accessCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.allowed;

    let allowed = false;
    try {
      await this.catalogService.canAccessLesson(accountId, lessonId);
      allowed = true;
    } catch {
      const grant = await this.videoAccess.findActiveGrant(
        accountId,
        lessonId,
        sessionId,
      );
      allowed = Boolean(grant);
    }
    if (this.accessCache.size >= ACCESS_CACHE_MAX) {
      const oldest = this.accessCache.keys().next().value;
      if (oldest !== undefined) this.accessCache.delete(oldest);
    }
    this.accessCache.set(cacheKey, {
      allowed,
      expiresAt: Date.now() + ACCESS_REVALIDATE_MS,
    });
    return allowed;
  }

  private async replaceVideoLesson(
    lessonId: string,
    data: {
      provider: VideoProvider;
      sourceRef: string;
      originalFileName: string | null;
      mimeType: string | null;
      status?: string;
    },
  ) {
    const previous = await db.videoLesson.findUnique({
      where: { lessonId },
      include: { renditions: true },
    });
    const videoLesson = await db.videoLesson.upsert({
      where: { lessonId },
      update: {
        ...data,
        durationSeconds: 0,
        status: data.status || 'READY',
      },
      create: {
        lessonId,
        ...data,
        durationSeconds: 0,
        status: data.status || 'READY',
      },
    });

    this.videoPathCache.delete(lessonId);
    if (
      previous &&
      (previous.provider !== data.provider ||
        previous.sourceRef !== data.sourceRef)
    ) {
      await this.deleteStoredSource(previous).catch(() => undefined);
    }
    return videoLesson;
  }

  async deleteVideo(lessonId: string) {
    const previous = await db.videoLesson.findUnique({
      where: { lessonId },
      include: { renditions: true },
    });
    if (!previous) return;

    await db.videoLesson.delete({ where: { lessonId } });
    await this.deleteStoredSource(previous).catch(() => undefined);
    this.videoPathCache.delete(lessonId);
  }

  private async deleteStoredSource(video: StoredVideo) {
    if (
      video.provider === VideoProvider.LOCAL &&
      fs.existsSync(video.sourceRef)
    ) {
      fs.unlinkSync(video.sourceRef);
      return;
    }
    if (video.provider === VideoProvider.R2) {
      const { bucket } = this.getR2Config();
      const keys = new Set([
        video.sourceRef,
        ...(video.renditions || []).map((rendition) => rendition.objectKey),
      ]);
      await Promise.all(
        [...keys].map((key) =>
          this.getR2Client().send(
            new DeleteObjectCommand({ Bucket: bucket, Key: key }),
          ),
        ),
      );
    }
  }

  private async assertLessonExists(lessonId: string) {
    const lesson = await db.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true },
    });
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }
  }

  async isSessionLive(sessionId: string): Promise<boolean> {
    if (!sessionId) return false;
    const session = await db.authSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        revokedAt: true,
        absoluteExpiresAt: true,
        idleExpiresAt: true,
        account: { select: { status: true, id: true } },
      },
    });
    if (!session) return false;
    if (session.revokedAt) return false;
    if (session.absoluteExpiresAt.getTime() <= Date.now()) return false;
    if (session.idleExpiresAt.getTime() <= Date.now()) return false;
    return session.account.status === 'ACTIVE';
  }

  // Admin: list active delivery tokens for a lesson (org-scoped by caller).
  async listDeliveryTokens(
    lessonId: string,
    organizationId: string,
    options: { limit?: number; offset?: number } = {},
  ) {
    const videoLesson = await this.findOrgVideoLesson(lessonId, organizationId);
    if (!videoLesson) {
      throw new NotFoundException('Video lesson not found');
    }
    const take = Math.min(options.limit ?? 50, 200);
    const skip = Math.max(options.offset ?? 0, 0);
    const [tokens, total] = await Promise.all([
      db.videoDeliveryToken.findMany({
        where: { videoLessonId: videoLesson.id, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        select: {
          id: true,
          accountId: true,
          sessionId: true,
          expiresAt: true,
          usedAt: true,
          createdAt: true,
        },
      }),
      db.videoDeliveryToken.count({
        where: { videoLessonId: videoLesson.id, expiresAt: { gt: new Date() } },
      }),
    ]);
    return { tokens, total };
  }

  // Admin: revoke all outstanding delivery tokens for a lesson so every
  // currently-issued playback URL dies immediately.
  async revokeLessonDeliveryTokens(lessonId: string, organizationId: string) {
    const videoLesson = await this.findOrgVideoLesson(lessonId, organizationId);
    if (!videoLesson) {
      throw new NotFoundException('Video lesson not found');
    }
    const result = await db.videoDeliveryToken.deleteMany({
      where: { videoLessonId: videoLesson.id },
    });
    await db.videoPlaybackSession.updateMany({
      where: { lessonId: videoLesson.lessonId, status: 'ACTIVE' },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });
    return { revoked: result.count };
  }

  // Admin: revoke a single delivery token by id (org-scoped via lesson).
  async revokeDeliveryToken(tokenId: string, organizationId: string) {
    const token = await db.videoDeliveryToken.findUnique({
      where: { id: tokenId },
      include: {
        videoLesson: { select: { lessonId: true } },
      },
    });
    if (!token) {
      throw new NotFoundException('Delivery token not found');
    }
    const videoLesson = await this.findOrgVideoLesson(
      token.videoLesson.lessonId,
      organizationId,
    );
    if (!videoLesson) {
      throw new NotFoundException('Delivery token not found');
    }
    await db.videoDeliveryToken.delete({ where: { id: tokenId } });
    await db.videoPlaybackSession.updateMany({
      where: {
        lessonId: token.videoLesson.lessonId,
        accountId: token.accountId,
        sessionId: token.sessionId,
        status: 'ACTIVE',
      },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });
    return { revoked: true };
  }

  // Admin: audit video-related security events for an account (org-scoped
  // through the account's organization).
  async listVideoSecurityEvents(
    accountId: string | undefined,
    organizationId: string,
    options: { limit?: number; offset?: number } = {},
  ) {
    const where: any = {
      eventType: { startsWith: 'VIDEO_' },
    };
    if (accountId) {
      const account = await db.account.findFirst({
        where: { id: accountId, organizationId },
        select: { id: true },
      });
      if (!account) {
        throw new NotFoundException('Account not found');
      }
      where.accountId = accountId;
    }
    const take = Math.min(options.limit ?? 50, 200);
    const skip = Math.max(options.offset ?? 0, 0);
    const [events, total] = await Promise.all([
      db.securityEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      db.securityEvent.count({ where }),
    ]);
    return { events, total };
  }

  private async findOrgVideoLesson(lessonId: string, organizationId: string) {
    const lesson = await db.lesson.findFirst({
      where: {
        id: lessonId,
        unit: { chapter: { course: { organizationId } } },
      },
      select: { id: true },
    });
    if (!lesson) return null;
    return db.videoLesson.findUnique({
      where: { lessonId: lesson.id },
      select: { id: true, lessonId: true },
    });
  }

  // Deduplicated, non-fatal security event recording (accountId, phoneHmac,
  // eventType, outcome, metadata). Failures are swallowed so logging never
  // breaks playback.
  async logSecurityEvent(
    accountId: string | null,
    eventType: string,
    outcome: string,
    metadata?: Record<string, unknown>,
  ) {
    const dedupeKey = `${eventType}:${outcome}:${accountId ?? 'anon'}`;
    const lastLog = this.denyLogCache.get(dedupeKey);
    const now = Date.now();
    if (lastLog !== undefined && now - lastLog < DENY_LOG_DEDUPE_MS) {
      return;
    }
    this.denyLogCache.set(dedupeKey, now);
    if (this.denyLogCache.size > 500) {
      const oldest = this.denyLogCache.keys().next().value;
      if (oldest !== undefined) this.denyLogCache.delete(oldest);
    }

    try {
      await db.securityEvent.create({
        data: {
          accountId,
          eventType,
          outcome,
          metadata: metadata as any,
        },
      });
    } catch {
      // never fail the request because security logging failed
    }
  }

  private getR2Client() {
    if (this.r2Client) return this.r2Client;
    const config = this.getR2Config();
    this.r2Client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    return this.r2Client;
  }

  private getR2Config() {
    const accessKeyId =
      process.env.R2_ACCESS_KEY_ID || process.env.ACCESS_KEY_ID;
    const secretAccessKey =
      process.env.R2_SECRET_ACCESS_KEY || process.env.SECRET_ACCESS_KEY;
    const endpoint = process.env.R2_ENDPOINT;
    const bucket = process.env.R2_BUCKET_NAME || 'bahrawy-videos';
    const region = process.env.R2_REGION || 'auto';

    if (!accessKeyId || !secretAccessKey || !endpoint) {
      throw new ServiceUnavailableException(
        'R2 is not configured on the API server',
      );
    }
    return { accessKeyId, secretAccessKey, endpoint, bucket, region };
  }

  private sanitizeFileName(fileName: string) {
    const sanitized = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
    return sanitized || 'video.mp4';
  }

  private parseYouTubeVideoId(input: string) {
    const value = input.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return value;

    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return null;
    }

    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    let candidate: string | null = null;
    if (host === 'youtu.be') {
      candidate = url.pathname.split('/').filter(Boolean)[0] || null;
    } else if (
      host === 'youtube.com' ||
      host === 'm.youtube.com' ||
      host === 'youtube-nocookie.com'
    ) {
      candidate = url.searchParams.get('v');
      if (!candidate) {
        const parts = url.pathname.split('/').filter(Boolean);
        if (['embed', 'shorts', 'live'].includes(parts[0])) {
          candidate = parts[1] || null;
        }
      }
    }

    return candidate && /^[a-zA-Z0-9_-]{11}$/.test(candidate)
      ? candidate
      : null;
  }
}
