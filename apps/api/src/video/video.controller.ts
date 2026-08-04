import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Req,
  Res,
  UseGuards,
  NotFoundException,
  UnauthorizedException,
  Query,
  Headers,
} from '@nestjs/common';
import { VideoService } from './video.service';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { DeviceGuard } from '../device-lease/device.guard';
import type { Request, Response } from 'express';
import { streamVideoFile } from './video-stream';

@Controller('video')
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  @Get(':lessonId/hls')
  @UseGuards(SessionAuthGuard, DeviceGuard)
  async getSignedHlsUrl(
    @Req() req: Request & { account: any },
    @Param('lessonId') lessonId: string,
  ) {
    const isStaff = req.account.kind === 'STAFF';
    const playback = await this.videoService.getLessonPlayback(
      req.account.id,
      lessonId,
      isStaff,
    );
    return {
      status: 'SUCCESS',
      data: playback,
      signedUrl: playback.url,
      provider: playback.provider,
      videoId: playback.videoId,
    };
  }

  @Get(':lessonId/manifest')
  @UseGuards(SessionAuthGuard, DeviceGuard)
  async getManifestUrl(
    @Req() req: Request & { account: any },
    @Param('lessonId') lessonId: string,
  ) {
    const isStaff = req.account.kind === 'STAFF';
    const playback = await this.videoService.getLessonPlayback(
      req.account.id,
      lessonId,
      isStaff,
    );
    return {
      status: 'SUCCESS',
      data: {
        ...playback,
        manifestUrl: playback.url,
      },
    };
  }

  @Get(':lessonId/segment/:seg')
  @UseGuards(SessionAuthGuard, DeviceGuard)
  async getSegmentUrl(
    @Req() req: Request & { account: any },
    @Param('lessonId') lessonId: string,
    @Param('seg') seg: string,
    @Res() res: Response,
  ) {
    const isStaff = req.account.kind === 'STAFF';
    const clientIp = req.ip || '127.0.0.1';
    const baseUrl = await this.videoService.signLessonHlsUrl(
      req.account.id,
      lessonId,
      clientIp,
      isStaff,
    );
    const target = new URL(baseUrl);
    target.pathname = target.pathname.replace(/stream\.mp4$/, seg);
    return res.redirect(target.toString());
  }

  @Get(':lessonId/stream.mp4')
  async streamVideo(
    @Param('lessonId') lessonId: string,
    @Query('token') token: string,
    @Query('expires') expires: string,
    @Headers('range') range: string | undefined,
    @Res() res: Response,
  ) {
    if (!this.videoService.verifyLessonVideoToken(lessonId, token, expires)) {
      throw new UnauthorizedException('Invalid or expired video token');
    }

    try {
      const filePath = await this.videoService.getVideoFilePath(lessonId);
      return streamVideoFile(filePath, range, res);
    } catch {
      throw new NotFoundException('Video file missing on disk');
    }
  }

  @Post(':lessonId/progress')
  @UseGuards(SessionAuthGuard)
  async updateProgress(
    @Req() req: any,
    @Param('lessonId') lessonId: string,
    @Body() body: { watchedSeconds: number; durationSeconds: number },
  ) {
    const data = await this.videoService.updateWatchProgress(
      req.account.id,
      lessonId,
      body.watchedSeconds,
      body.durationSeconds,
    );
    return { status: 'SUCCESS', data };
  }

  @Get(':lessonId/resume')
  @UseGuards(SessionAuthGuard)
  async getResumePosition(
    @Req() req: any,
    @Param('lessonId') lessonId: string,
  ) {
    const position = await this.videoService.getResumePosition(
      req.account.id,
      lessonId,
    );
    return { status: 'SUCCESS', data: { position } };
  }
}
