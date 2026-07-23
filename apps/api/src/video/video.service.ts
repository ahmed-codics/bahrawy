import {
  BadRequestException,
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
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { CatalogService } from '../catalog/catalog.service';

const PLAYBACK_URL_TTL_SECONDS = 2 * 60 * 60;
const UPLOAD_URL_TTL_SECONDS = 15 * 60;
const MAX_VIDEO_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;
const VIDEO_PATH_CACHE_MAX = 1000;

export type VideoPlayback = {
  provider: VideoProvider;
  url?: string;
  videoId?: string;
  expiresInSeconds?: number;
};

type StoredVideo = {
  lessonId: string;
  provider: VideoProvider;
  sourceRef: string;
  mimeType: string | null;
};

@Injectable()
export class VideoService {
  private readonly videoPathCache = new Map<
    string,
    { path: string; expiresAt: number }
  >();
  private r2Client: S3Client | null = null;

  constructor(private readonly catalogService: CatalogService) {}

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
  ): Promise<VideoPlayback> {
    await this.catalogService.canAccessLesson(accountId, lessonId, isStaff);
    const video = await db.videoLesson.findUnique({ where: { lessonId } });
    if (!video) {
      throw new NotFoundException('Video lesson not found');
    }
    return this.createPlayback(video);
  }

  async getAdminPlayback(lessonId: string): Promise<VideoPlayback> {
    const video = await db.videoLesson.findUnique({ where: { lessonId } });
    if (!video) {
      throw new NotFoundException('Video lesson not found');
    }
    return this.createPlayback(video);
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

  verifyLessonVideoToken(lessonId: string, token: string, expires: string) {
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
      .update(`${lessonId}:${expiresAt}`)
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
      fileSizeBytes <= 0 ||
      fileSizeBytes > MAX_VIDEO_UPLOAD_BYTES
    ) {
      throw new BadRequestException(
        'Video size must be between 1 byte and 2 GB',
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
    const isCompleted =
      durationSeconds > 0 && watchedSeconds / durationSeconds >= 0.9;
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
        completedAt: isCompleted ? now : null,
        lastHeartbeatAt: now,
      },
      update: {
        watchedSeconds: { set: watchedSeconds },
        durationSeconds: { set: durationSeconds },
        lastHeartbeatAt: now,
        completedAt: isCompleted ? { set: now } : undefined,
      },
    });
    return {
      id: progress.id,
      completed: !!progress.completedAt,
      watchedSeconds: progress.watchedSeconds,
    };
  }

  async getResumePosition(
    accountId: string,
    lessonId: string,
  ): Promise<number> {
    const progress = await db.lessonProgress.findUnique({
      where: {
        accountId_lessonId: { accountId, lessonId },
      },
    });
    return progress?.watchedSeconds || 0;
  }

  private async createPlayback(video: StoredVideo): Promise<VideoPlayback> {
    if (video.provider === VideoProvider.YOUTUBE) {
      return {
        provider: VideoProvider.YOUTUBE,
        videoId: video.sourceRef,
      };
    }

    if (video.provider === VideoProvider.R2) {
      const { bucket } = this.getR2Config();
      const url = await getSignedUrl(
        this.getR2Client(),
        new GetObjectCommand({
          Bucket: bucket,
          Key: video.sourceRef,
          ResponseContentType: video.mimeType || 'video/mp4',
          ResponseContentDisposition: 'inline',
        }),
        { expiresIn: PLAYBACK_URL_TTL_SECONDS },
      );
      return {
        provider: VideoProvider.R2,
        url,
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

    const localToken = createHmac('sha256', secret)
      .update(`${video.lessonId}:${expires}`)
      .digest('base64url');
    return {
      provider: VideoProvider.LOCAL,
      url: `${baseUrl}/video/${video.lessonId}/stream.mp4?token=${localToken}&expires=${expires}`,
      expiresInSeconds: PLAYBACK_URL_TTL_SECONDS,
    };
  }

  private async replaceVideoLesson(
    lessonId: string,
    data: {
      provider: VideoProvider;
      sourceRef: string;
      originalFileName: string | null;
      mimeType: string | null;
    },
  ) {
    const previous = await db.videoLesson.findUnique({ where: { lessonId } });
    const videoLesson = await db.videoLesson.upsert({
      where: { lessonId },
      update: {
        ...data,
        durationSeconds: 0,
        status: 'READY',
      },
      create: {
        lessonId,
        ...data,
        durationSeconds: 0,
        status: 'READY',
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
      await this.getR2Client().send(
        new DeleteObjectCommand({ Bucket: bucket, Key: video.sourceRef }),
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
