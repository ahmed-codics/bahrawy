import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { db, VideoProvider } from '@bahrawy/db';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { CatalogService } from '../catalog/catalog.service';
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
    lesson: {
      findUnique: jest.fn(),
    },
    lessonProgress: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
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

    it('returns a signed local stream URL', async () => {
      (catalogService.canAccessLesson as jest.Mock).mockResolvedValue(true);
      (db.videoLesson.findUnique as jest.Mock).mockResolvedValue({
        id: 'vid-1',
        lessonId: 'lesson-1',
        provider: VideoProvider.LOCAL,
        sourceRef: '/uploads/lesson-1/video.mp4',
        mimeType: 'video/mp4',
      });

      const playback = await service.getLessonPlayback('acc-1', 'lesson-1');

      expect(playback.provider).toBe(VideoProvider.LOCAL);
      expect(playback.url).toContain('/video/lesson-1/stream.mp4');
      expect(playback.url).toContain('token=');
      expect(playback.url).toContain('expires=');
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
        expiresInSeconds: 28800,
      });
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
  });
});
