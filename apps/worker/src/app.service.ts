import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { db } from '@bahrawy/db';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { spawn } from 'node:child_process';

type ProbeResult = {
  streams?: Array<{ codec_type?: string; width?: number; height?: number }>;
  format?: { duration?: string };
};

type RenditionProfile = {
  quality: '480p' | '720p';
  height: number;
  videoBitrateKbps: number;
  audioBitrateKbps: number;
  crf: number;
};

const PROFILES: RenditionProfile[] = [
  {
    quality: '480p',
    height: 480,
    videoBitrateKbps: 950,
    audioBitrateKbps: 96,
    crf: 23,
  },
  {
    quality: '720p',
    height: 720,
    videoBitrateKbps: 2200,
    audioBitrateKbps: 128,
    crf: 22,
  },
];

@Injectable()
export class AppService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AppService.name);
  private readonly r2 = this.createR2Client();
  private readonly bucket = process.env.R2_BUCKET_NAME || 'bahrawy-videos';
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopping = false;
  private processing = false;

  getHello() {
    return 'Bahrawy video worker';
  }

  async onModuleInit() {
    await db.videoLesson.updateMany({
      where: {
        provider: 'R2',
        status: 'PROCESSING',
      },
      data: { status: 'QUEUED' },
    });
    this.schedule(0);
  }

  onModuleDestroy() {
    this.stopping = true;
    if (this.timer) clearTimeout(this.timer);
  }

  private schedule(delayMs = 10_000) {
    if (this.stopping) return;
    this.timer = setTimeout(() => void this.tick(), delayMs);
  }

  private async tick() {
    if (this.processing || this.stopping) return this.schedule();
    this.processing = true;
    try {
      const job = await this.claimNextVideo();
      if (job) await this.processVideo(job);
    } catch (error) {
      this.logger.error(
        `Video worker cycle failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      this.processing = false;
      this.schedule();
    }
  }

  private async claimNextVideo() {
    const candidate = await db.videoLesson.findFirst({
      where: { provider: 'R2', status: 'QUEUED' },
      orderBy: { updatedAt: 'asc' },
    });
    if (!candidate) return null;

    const claimed = await db.videoLesson.updateMany({
      where: { id: candidate.id, status: 'QUEUED' },
      data: { status: 'PROCESSING' },
    });
    return claimed.count === 1 ? candidate : null;
  }

  private async processVideo(video: {
    id: string;
    lessonId: string;
    sourceRef: string;
  }) {
    const workDir = await mkdtemp(join(tmpdir(), 'bahrawy-video-'));
    const inputPath = join(workDir, 'source.mp4');
    this.logger.log(`Processing lesson ${video.lessonId}`);

    try {
      const response = await this.r2.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: video.sourceRef }),
      );
      if (!response.Body) throw new Error('R2 source object has no body');
      await pipeline(response.Body as Readable, createWriteStream(inputPath));

      const probe = await this.probe(inputPath);
      const sourceVideo = probe.streams?.find(
        (stream) => stream.codec_type === 'video',
      );
      const sourceHeight = sourceVideo?.height || 0;
      const durationSeconds = Math.max(
        0,
        Math.round(Number.parseFloat(probe.format?.duration || '0')),
      );
      if (!sourceHeight)
        throw new Error('Unable to detect source video dimensions');

      const profiles = PROFILES.filter(
        (profile) =>
          profile.quality === '480p' || sourceHeight >= profile.height,
      );
      const created: Array<{
        quality: string;
        objectKey: string;
        width: number;
        height: number;
        bitrateKbps: number;
        fileSizeBytes: bigint;
        mimeType: string;
      }> = [];

      for (const profile of profiles) {
        const outputPath = join(workDir, `${profile.quality}.mp4`);
        await this.transcode(inputPath, outputPath, profile);
        const outputProbe = await this.probe(outputPath);
        const outputVideo = outputProbe.streams?.find(
          (stream) => stream.codec_type === 'video',
        );
        const outputStat = await stat(outputPath);
        const objectKey = `lessons/${video.lessonId}/renditions/${video.id}-${profile.quality}.mp4`;

        await this.r2.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: objectKey,
            Body: createReadStream(outputPath),
            ContentLength: outputStat.size,
            ContentType: 'video/mp4',
            CacheControl: 'private, max-age=3600',
          }),
        );
        created.push({
          quality: profile.quality,
          objectKey,
          width: outputVideo?.width || 0,
          height: outputVideo?.height || profile.height,
          bitrateKbps: profile.videoBitrateKbps + profile.audioBitrateKbps,
          fileSizeBytes: BigInt(outputStat.size),
          mimeType: 'video/mp4',
        });
      }

      const defaultRendition =
        created.find((rendition) => rendition.quality === '480p') ?? created[0];
      if (!defaultRendition)
        throw new Error('No video renditions were generated');

      await db.$transaction(async (tx) => {
        const current = await tx.videoLesson.findUnique({
          where: { id: video.id },
          select: { sourceRef: true, status: true },
        });
        if (
          current?.sourceRef !== video.sourceRef ||
          current.status !== 'PROCESSING'
        ) {
          throw new Error('Video job was superseded by a newer upload');
        }
        await tx.videoRendition.deleteMany({
          where: { videoLessonId: video.id },
        });
        await tx.videoRendition.createMany({
          data: created.map((rendition) => ({
            videoLessonId: video.id,
            ...rendition,
          })),
        });
        await tx.videoLesson.update({
          where: { id: video.id },
          data: {
            sourceRef: defaultRendition.objectKey,
            mimeType: 'video/mp4',
            durationSeconds,
            status: 'READY',
          },
        });
      });

      if (video.sourceRef !== defaultRendition.objectKey) {
        await this.r2
          .send(
            new DeleteObjectCommand({
              Bucket: this.bucket,
              Key: video.sourceRef,
            }),
          )
          .catch((error: unknown) =>
            this.logger.warn(
              `Could not delete original ${video.sourceRef}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            ),
          );
      }
      this.logger.log(`Lesson ${video.lessonId} is ready in 480p/720p`);
    } catch (error) {
      await db.videoLesson.updateMany({
        where: { id: video.id, status: 'PROCESSING' },
        data: { status: 'FAILED' },
      });
      this.logger.error(
        `Lesson ${video.lessonId} failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }

  private async probe(filePath: string): Promise<ProbeResult> {
    const output = await this.run('ffprobe', [
      '-v',
      'error',
      '-show_streams',
      '-show_format',
      '-of',
      'json',
      filePath,
    ]);
    return JSON.parse(output) as ProbeResult;
  }

  private async transcode(
    inputPath: string,
    outputPath: string,
    profile: RenditionProfile,
  ) {
    await this.run('ffmpeg', [
      '-y',
      '-i',
      inputPath,
      '-map',
      '0:v:0',
      '-map',
      '0:a?',
      '-vf',
      `scale=-2:min(${profile.height}\\,ih)`,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      String(profile.crf),
      '-maxrate',
      `${profile.videoBitrateKbps}k`,
      '-bufsize',
      `${profile.videoBitrateKbps * 2}k`,
      '-pix_fmt',
      'yuv420p',
      '-threads',
      '2',
      '-c:a',
      'aac',
      '-b:a',
      `${profile.audioBitrateKbps}k`,
      '-ac',
      '2',
      '-movflags',
      '+faststart',
      outputPath,
    ]);
  }

  private run(command: string, args: string[]) {
    return new Promise<string>((resolve, reject) => {
      const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderrTail = '';
      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderrTail = `${stderrTail}${chunk.toString()}`.slice(-8_000);
      });
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) resolve(stdout);
        else reject(new Error(`${command} exited with ${code}: ${stderrTail}`));
      });
    });
  }

  private createR2Client() {
    const accessKeyId =
      process.env.R2_ACCESS_KEY_ID || process.env.ACCESS_KEY_ID;
    const secretAccessKey =
      process.env.R2_SECRET_ACCESS_KEY || process.env.SECRET_ACCESS_KEY;
    const endpoint = process.env.R2_ENDPOINT;
    if (!accessKeyId || !secretAccessKey || !endpoint) {
      throw new Error('R2 worker configuration is incomplete');
    }
    return new S3Client({
      region: process.env.R2_REGION || 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
}
