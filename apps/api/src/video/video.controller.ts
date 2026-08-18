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
import { Throttle } from '../throttle/throttle.decorator';
import type { Request, Response } from 'express';
import { streamVideoFile } from './video-stream';

const PLAYBACK_ISSUE_LIMIT = 20;
const PLAYBACK_ISSUE_WINDOW_MS = 60_000;

@Controller('video')
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  @Get(':lessonId/hls')
  @Throttle(PLAYBACK_ISSUE_LIMIT, PLAYBACK_ISSUE_WINDOW_MS)
  @UseGuards(SessionAuthGuard, DeviceGuard)
  async getSignedHlsUrl(
    @Req()
    req: Request & {
      account: any;
      session: any;
      deviceFingerprint?: string;
    },
    @Param('lessonId') lessonId: string,
  ) {
    const isStaff = req.account.kind === 'STAFF';
    const playback = await this.videoService.getLessonPlayback(
      req.account.id,
      lessonId,
      isStaff,
      req.session?.id,
      req.deviceFingerprint,
    );
    return {
      status: 'SUCCESS',
      data: playback,
    };
  }

  @Get(':lessonId/manifest')
  @Throttle(PLAYBACK_ISSUE_LIMIT, PLAYBACK_ISSUE_WINDOW_MS)
  @UseGuards(SessionAuthGuard, DeviceGuard)
  async getManifestUrl(
    @Req()
    req: Request & {
      account: any;
      session: any;
      deviceFingerprint?: string;
    },
    @Param('lessonId') lessonId: string,
  ) {
    const isStaff = req.account.kind === 'STAFF';
    const playback = await this.videoService.getLessonPlayback(
      req.account.id,
      lessonId,
      isStaff,
      req.session?.id,
      req.deviceFingerprint,
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
    @Req() req: Request & { account: any; session: any },
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
    @Query('account') account: string | undefined,
    @Query('session') session: string | undefined,
    @Headers('range') range: string | undefined,
    @Res() res: Response,
  ) {
    const accountId = typeof account === 'string' ? account : '';
    const sessionId = typeof session === 'string' ? session : '';
    const isBound = Boolean(accountId && sessionId);

    if (
      !this.videoService.verifyLessonVideoToken(
        lessonId,
        token,
        expires,
        accountId,
        sessionId,
      )
    ) {
      await this.videoService.logSecurityEvent(
        accountId || null,
        'VIDEO_STREAM_DENIED',
        'FAILED_INVALID_OR_EXPIRED_TOKEN',
        { lessonId },
      );
      throw new UnauthorizedException('Invalid or expired video token');
    }

    // Re-validate entitlement + session liveness at request time so a bound
    // URL cannot be replayed after the student's access is revoked.
    if (isBound) {
      const sessionValid = await this.videoService.isSessionLive(sessionId);
      const stillAllowed =
        await this.videoService.assertEntitlementAtStreamTime(
          accountId,
          lessonId,
          sessionId,
        );
      if (!sessionValid || !stillAllowed) {
        await this.videoService.logSecurityEvent(
          accountId,
          'VIDEO_STREAM_DENIED',
          sessionValid ? 'FAILED_ACCESS_REVOKED' : 'FAILED_SESSION_INVALID',
          { lessonId },
        );
        throw new UnauthorizedException(
          'Access to this video has been revoked',
        );
      }
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
