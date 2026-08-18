import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { createHmac } from 'crypto';
import { db, VideoProvider } from '@bahrawy/db';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { CatalogService } from '../catalog/catalog.service';
import { VideoAccessService } from '../video-access/video-access.grants.service';
import { VideoService } from './video.service';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

jest.mock('@bahrawy/db', () => {
  const mockDbClient: any = {
    videoLesson: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    videoDeliveryToken: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
      delete: jest.fn(),
    },
    authSession: {
      findUnique: jest.fn(),
    },
    securityEvent: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    account: {
      findFirst: jest.fn(),
    },
    lesson: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    lessonProgress: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    assessment: {
      findFirst: jest.fn(),
    },
    assessmentAttempt: {
      findFirst: jest.fn(),
    },
  };
  return {
    db: mockDbClient,
    VideoProvider: {
      LOCAL: 'LOCAL',
      YOUTUBE: 'YOUTUBE',
      R2: 'R2',
    },
  };
});

describe('VideoService', () => {
  let service: VideoService;
  let catalogService: CatalogService;

  beforeEach(async () => {
    process.env.R2_ACCESS_KEY_ID = 'test-access-key';
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret-key';
    process.env.R2_ENDPOINT =
      'https://example-account.r2.cloudflarestorage.com';
    process.env.R2_BUCKET_NAME = 'test-videos';

    const mockCatalogService = {
      canAccessLesson: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VideoService,
        { provide: CatalogService, useValue: mockCatalogService },
        { provide: VideoAccessService, useValue: { findActiveGrant: jest.fn() } },
      ],
    }).compile();
    service = module.get<VideoService>(VideoService);
    catalogService = module.get<CatalogService>(CatalogService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('getLessonPlayback', () => {
    it('throws when the video lesson does not exist', async () => {
      (catalogService.canAccessLesson as jest.Mock).mockResolvedValue(true);
      (db.videoLesson.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getLessonPlayback('acc-1', 'lesson-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns a signed local stream URL bound to account + session', async () => {
      (catalogService.canAccessLesson as jest.Mock).mockResolvedValue(true);
      (db.videoLesson.findUnique as jest.Mock).mockResolvedValue({
        id: 'vid-1',
        lessonId: 'lesson-1',
        provider: VideoProvider.LOCAL,
        sourceRef: '/uploads/lesson-1/video.mp4',
        mimeType: 'video/mp4',
      });
      (db.videoDeliveryToken.create as jest.Mock).mockResolvedValue({});

      const playback = await service.getLessonPlayback(
        'acc-1',
        'lesson-1',
        false,
        'sess-1',
        'dev-fp-1',
      );

      expect(playback.provider).toBe(VideoProvider.LOCAL);
      expect(playback.url).toContain('/video/lesson-1/stream.mp4');
      expect(playback.url).toContain('token=');
      expect(playback.url).toContain('expires=');
      expect(playback.url).toContain('account=acc-1');
      expect(playback.url).toContain('session=sess-1');
      expect(playback.expiresInSeconds).toBe(900);
      expect(db.videoDeliveryToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accountId: 'acc-1',
            sessionId: 'sess-1',
            videoLessonId: 'vid-1',
          }),
        }),
      );
    });

    it('returns only the YouTube video ID for YouTube playback', async () => {
      (catalogService.canAccessLesson as jest.Mock).mockResolvedValue(true);
      (db.videoLesson.findUnique as jest.Mock).mockResolvedValue({
        id: 'vid-1',
        lessonId: 'lesson-1',
        provider: VideoProvider.YOUTUBE,
        sourceRef: 'M7lc1UVf-VE',
        mimeType: null,
      });

      await expect(
        service.getLessonPlayback('acc-1', 'lesson-1'),
      ).resolves.toEqual({
        provider: VideoProvider.YOUTUBE,
        videoId: 'M7lc1UVf-VE',
      });
    });

    it('returns a short-lived R2 URL', async () => {
      (catalogService.canAccessLesson as jest.Mock).mockResolvedValue(true);
      (db.videoLesson.findUnique as jest.Mock).mockResolvedValue({
        id: 'vid-1',
        lessonId: 'lesson-1',
        provider: VideoProvider.R2,
        sourceRef: 'lessons/lesson-1/video.mp4',
        mimeType: 'video/mp4',
      });
      (getSignedUrl as jest.Mock).mockResolvedValue(
        'https://signed-r2.example/video',
      );

      await expect(
        service.getLessonPlayback('acc-1', 'lesson-1'),
      ).resolves.toEqual({
        provider: VideoProvider.R2,
        url: 'https://signed-r2.example/video',
        expiresInSeconds: 900,
      });
    });

    it('logs a VIDEO_PLAYBACK_ISSUED security event', async () => {
      (catalogService.canAccessLesson as jest.Mock).mockResolvedValue(true);
      (db.videoLesson.findUnique as jest.Mock).mockResolvedValue({
        id: 'vid-1',
        lessonId: 'lesson-1',
        provider: VideoProvider.YOUTUBE,
        sourceRef: 'M7lc1UVf-VE',
        mimeType: null,
      });

      await service.getLessonPlayback('acc-1', 'lesson-1');

      expect(db.securityEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            accountId: 'acc-1',
            eventType: 'VIDEO_PLAYBACK_ISSUED',
            outcome: 'SUCCESS',
          }),
        }),
      );
    });
  });

  describe('verifyLessonVideoToken', () => {
    const buildToken = (
      accountId: string,
      sessionId: string,
      lessonId: string,
      expires: number,
    ) => {
      return createHmac('sha256', 'dev_video_secret_key_123')
        .update(`${accountId}:${sessionId}:${lessonId}:${expires}`)
        .digest('base64url');
    };

    it('rejects a token bound to a different account', () => {
      const token = buildToken('acc-1', 'sess-1', 'lesson-1', 9999999999);
      expect(
        service.verifyLessonVideoToken(
          'lesson-1',
          token,
          '9999999999',
          'acc-2',
          'sess-1',
        ),
      ).toBe(false);
    });

    it('accepts a correctly bound token', () => {
      const token = buildToken('acc-1', 'sess-1', 'lesson-1', 9999999999);
      expect(
        service.verifyLessonVideoToken(
          'lesson-1',
          token,
          '9999999999',
          'acc-1',
          'sess-1',
        ),
      ).toBe(true);
    });
  });

  describe('isSessionLive', () => {
    it('returns false for a revoked or expired session', async () => {
      (db.authSession.findUnique as jest.Mock).mockResolvedValue({
        id: 'sess-1',
        revokedAt: new Date(),
        absoluteExpiresAt: new Date(Date.now() + 3600000),
        idleExpiresAt: new Date(Date.now() + 3600000),
        account: { status: 'ACTIVE' },
      });
      await expect(service.isSessionLive('sess-1')).resolves.toBe(false);
    });

    it('returns false when the account is not active', async () => {
      (db.authSession.findUnique as jest.Mock).mockResolvedValue({
        id: 'sess-1',
        revokedAt: null,
        absoluteExpiresAt: new Date(Date.now() + 3600000),
        idleExpiresAt: new Date(Date.now() + 3600000),
        account: { status: 'SUSPENDED' },
      });
      await expect(service.isSessionLive('sess-1')).resolves.toBe(false);
    });

    it('returns true for a live session on an active account', async () => {
      (db.authSession.findUnique as jest.Mock).mockResolvedValue({
        id: 'sess-1',
        revokedAt: null,
        absoluteExpiresAt: new Date(Date.now() + 3600000),
        idleExpiresAt: new Date(Date.now() + 3600000),
        account: { status: 'ACTIVE' },
      });
      await expect(service.isSessionLive('sess-1')).resolves.toBe(true);
    });
  });

  describe('assertEntitlementAtStreamTime', () => {
    it('returns true when access is still allowed', async () => {
      (catalogService.canAccessLesson as jest.Mock).mockResolvedValue(true);
      await expect(
        service.assertEntitlementAtStreamTime('acc-1', 'lesson-1'),
      ).resolves.toBe(true);
    });

    it('returns false when access was revoked', async () => {
      (catalogService.canAccessLesson as jest.Mock).mockRejectedValue(
        new Error('MISSING_ENTITLEMENT'),
      );
      await expect(
        service.assertEntitlementAtStreamTime('acc-1', 'lesson-1'),
      ).resolves.toBe(false);
    });
  });

  describe('delivery token admin controls', () => {
    it('lists active delivery tokens for an org-scoped lesson', async () => {
      (db.lesson.findFirst as jest.Mock).mockResolvedValue({ id: 'lesson-1' });
      (db.videoLesson.findUnique as jest.Mock).mockResolvedValue({
        id: 'vid-1',
        lessonId: 'lesson-1',
      });
      (db.videoDeliveryToken.findMany as jest.Mock).mockResolvedValue([
        { id: 'tok-1', accountId: 'acc-1' },
      ]);
      (db.videoDeliveryToken.count as jest.Mock).mockResolvedValue(1);

      const result = await service.listDeliveryTokens('lesson-1', 'org-1');
      expect(result.total).toBe(1);
      expect(result.tokens[0].id).toBe('tok-1');
    });

    it('revokes all delivery tokens for a lesson', async () => {
      (db.lesson.findFirst as jest.Mock).mockResolvedValue({ id: 'lesson-1' });
      (db.videoLesson.findUnique as jest.Mock).mockResolvedValue({
        id: 'vid-1',
        lessonId: 'lesson-1',
      });
      (db.videoDeliveryToken.deleteMany as jest.Mock).mockResolvedValue({
        count: 3,
      });

      const result = await service.revokeLessonDeliveryTokens(
        'lesson-1',
        'org-1',
      );
      expect(result.revoked).toBe(3);
    });
  });

  describe('setYouTubeVideo', () => {
    it('extracts the ID and stores a YouTube provider record', async () => {
      (db.lesson.findUnique as jest.Mock).mockResolvedValue({ id: 'lesson-1' });
      (db.videoLesson.findUnique as jest.Mock).mockResolvedValue(null);
      (db.videoLesson.upsert as jest.Mock).mockResolvedValue({
        id: 'video-1',
      });

      await service.setYouTubeVideo(
        'lesson-1',
        'https://www.youtube.com/watch?v=M7lc1UVf-VE',
      );

      expect(db.videoLesson.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            provider: VideoProvider.YOUTUBE,
            sourceRef: 'M7lc1UVf-VE',
          }),
        }),
      );
    });

    it('rejects non-YouTube URLs', async () => {
      (db.lesson.findUnique as jest.Mock).mockResolvedValue({ id: 'lesson-1' });

      await expect(
        service.setYouTubeVideo('lesson-1', 'https://example.com/not-a-video'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateWatchProgress', () => {
    it('sets completed status when progress is at least 90%', async () => {
      (db.lessonProgress.upsert as jest.Mock).mockResolvedValue({
        id: 'prog-1',
        watchedSeconds: 90,
        completedAt: new Date(),
      });
      const result = await service.updateWatchProgress(
        'acc-1',
        'lesson-1',
        90,
        100,
      );
      expect(result.completed).toBe(true);
    });

    it('does not complete progress below 90%', async () => {
      (db.lessonProgress.upsert as jest.Mock).mockResolvedValue({
        id: 'prog-1',
        watchedSeconds: 50,
        completedAt: null,
      });
      const result = await service.updateWatchProgress(
        'acc-1',
        'lesson-1',
        50,
        100,
      );
      expect(result.completed).toBe(false);
    });

    it('does not auto-complete at 90% when the lesson gate quiz is not passed', async () => {
      (db.assessment.findFirst as jest.Mock).mockResolvedValue({
        id: 'gate-1',
        passingScore: 60,
      });
      (db.assessmentAttempt.findFirst as jest.Mock).mockResolvedValue(null);
      (db.lessonProgress.upsert as jest.Mock).mockImplementation((args: any) =>
        Promise.resolve({
          id: 'prog-1',
          watchedSeconds: 90,
          completedAt: args.update?.completedAt
            ? (args.update.completedAt as { set: Date }).set
            : null,
        }),
      );

      const result = await service.updateWatchProgress(
        'acc-1',
        'lesson-1',
        90,
        100,
      );
      expect(result.completed).toBe(false);
    });

    it('completes at 90% when the lesson gate quiz was passed', async () => {
      (db.assessment.findFirst as jest.Mock).mockResolvedValue({
        id: 'gate-1',
        passingScore: 60,
      });
      (db.assessmentAttempt.findFirst as jest.Mock).mockResolvedValue({
        score: 80,
      });
      (db.lessonProgress.upsert as jest.Mock).mockResolvedValue({
        id: 'prog-1',
        watchedSeconds: 90,
        completedAt: new Date(),
      });

      const result = await service.updateWatchProgress(
        'acc-1',
        'lesson-1',
        90,
        100,
      );
      expect(result.completed).toBe(true);
    });

    it('completes at 90% when a passing gate attempt exists even if a later attempt failed', async () => {
      (db.assessment.findFirst as jest.Mock).mockResolvedValue({
        id: 'gate-1',
        passingScore: 60,
      });
      (db.assessmentAttempt.findFirst as jest.Mock).mockResolvedValue({
        id: 'passed-attempt',
      });
      (db.lessonProgress.upsert as jest.Mock).mockImplementation((args: any) =>
        Promise.resolve({
          id: 'prog-1',
          watchedSeconds: 90,
          completedAt: args.update?.completedAt
            ? (args.update.completedAt as { set: Date }).set
            : new Date(),
        }),
      );

      const result = await service.updateWatchProgress(
        'acc-1',
        'lesson-1',
        90,
        100,
      );
      expect(result.completed).toBe(true);
      expect(db.assessmentAttempt.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            accountId: 'acc-1',
            assessmentId: 'gate-1',
            score: { gte: 60 },
          }),
        }),
      );
    });

    it('auto-completes at 90% when the lesson has no gate quiz', async () => {
      (db.assessment.findFirst as jest.Mock).mockResolvedValue(null);
      (db.lessonProgress.upsert as jest.Mock).mockResolvedValue({
        id: 'prog-1',
        watchedSeconds: 90,
        completedAt: new Date(),
      });

      const result = await service.updateWatchProgress(
        'acc-1',
        'lesson-1',
        90,
        100,
      );
      expect(result.completed).toBe(true);
    });
  });
});
