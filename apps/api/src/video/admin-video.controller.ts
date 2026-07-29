import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Res,
  Headers,
  Body,
  Req,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import type { Request, Response } from 'express';
import { mkdirSync } from 'fs';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { VideoService } from './video.service';
import { streamVideoFile } from './video-stream';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermission } from '../rbac/permissions.decorator';
import {
  ConfirmR2UploadDto,
  CreateR2UploadDto,
  YouTubeVideoDto,
} from './video.dto';
import { StaffPermission } from '@bahrawy/types';
import { db } from '@bahrawy/db';

const MAX_VIDEO_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;

type AdminRequest = Request & {
  account: { id: string; organizationId: string };
};

@Controller('admin/v1/video')
@UseGuards(SessionAuthGuard, PermissionsGuard)
@RequirePermission(StaffPermission.CATALOG_MANAGE)
export class AdminVideoController {
  constructor(private readonly videoService: VideoService) {}

  @Post(':lessonId/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, callback) => {
          const uploadDir = join(process.cwd(), '.uploads', 'tmp-videos');
          mkdirSync(uploadDir, { recursive: true });
          callback(null, uploadDir);
        },
        filename: (_req, file, callback) => {
          callback(
            null,
            `${Date.now()}_${randomUUID()}${extname(file.originalname)}`,
          );
        },
      }),
      limits: {
        fileSize: MAX_VIDEO_UPLOAD_BYTES,
      },
      fileFilter: (_req, file, callback) => {
        if (!file.mimetype.startsWith('video/')) {
          callback(
            new BadRequestException('Only video files are allowed'),
            false,
          );
          return;
        }
        callback(null, true);
      },
    }),
  )
  async uploadVideo(
    @Req() request: AdminRequest,
    @Param('lessonId') lessonId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    await this.assertLessonAccess(request.account.organizationId, lessonId);
    const result = await this.videoService.processUpload(lessonId, file);
    return { status: 'SUCCESS', data: result };
  }

  @Post(':lessonId/r2/upload-url')
  async createR2UploadUrl(
    @Req() request: AdminRequest,
    @Param('lessonId') lessonId: string,
    @Body() body: CreateR2UploadDto,
  ) {
    await this.assertLessonAccess(request.account.organizationId, lessonId);
    const data = await this.videoService.createR2UploadUrl(
      lessonId,
      body.originalFileName,
      body.mimeType,
      body.fileSizeBytes,
    );
    return { status: 'SUCCESS', data };
  }

  @Post(':lessonId/r2/complete')
  async completeR2Upload(
    @Req() request: AdminRequest,
    @Param('lessonId') lessonId: string,
    @Body() body: ConfirmR2UploadDto,
  ) {
    await this.assertLessonAccess(request.account.organizationId, lessonId);
    const data = await this.videoService.confirmR2Upload(
      lessonId,
      body.objectKey,
      body.originalFileName,
      body.mimeType,
    );
    return { status: 'SUCCESS', data };
  }

  @Post(':lessonId/youtube')
  async setYouTubeVideo(
    @Req() request: AdminRequest,
    @Param('lessonId') lessonId: string,
    @Body() body: YouTubeVideoDto,
  ) {
    await this.assertLessonAccess(request.account.organizationId, lessonId);
    const data = await this.videoService.setYouTubeVideo(
      lessonId,
      body.youtubeUrl,
    );
    return { status: 'SUCCESS', data };
  }

  @Get(':lessonId/preview')
  async previewVideoForAdmin(
    @Req() request: AdminRequest,
    @Param('lessonId') lessonId: string,
    @Headers('range') range: string | undefined,
    @Res() res: Response,
  ) {
    await this.assertLessonAccess(request.account.organizationId, lessonId);
    const playback = await this.videoService.getAdminPlayback(lessonId);
    if (playback.provider === 'YOUTUBE' && playback.videoId) {
      return res.redirect(
        `https://www.youtube.com/watch?v=${playback.videoId}`,
      );
    }
    if (playback.provider === 'R2' && playback.url) {
      return res.redirect(playback.url);
    }
    const filePath = await this.videoService.getVideoFilePath(lessonId);
    return streamVideoFile(filePath, range, res);
  }

  private async assertLessonAccess(organizationId: string, lessonId: string) {
    const lesson = await db.lesson.findFirst({
      where: {
        id: lessonId,
        unit: { chapter: { course: { organizationId } } },
      },
      select: { id: true },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
  }
}
