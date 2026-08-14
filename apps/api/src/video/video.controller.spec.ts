import { VideoController } from './video.controller';
import { VideoService } from './video.service';

describe('VideoController getSignedHlsUrl', () => {
  let serviceMock: { getLessonPlayback: jest.Mock };
  let controller: VideoController;

  beforeEach(() => {
    serviceMock = {
      getLessonPlayback: jest.fn(),
    };
    controller = new VideoController(serviceMock as unknown as VideoService);
    jest.clearAllMocks();
  });

  it('returns the playback only inside data (no duplicated top-level videoId)', async () => {
    serviceMock.getLessonPlayback.mockResolvedValue({
      provider: 'YOUTUBE',
      videoId: 'iMZ1skkbUWI',
      watermark: 'B123456·ABCDEF',
    });

    const result = await controller.getSignedHlsUrl(
      {
        account: { id: 'acc-1', kind: 'STUDENT' },
        session: { id: 'sess-1' },
        deviceFingerprint: 'fp-1',
      } as any,
      'lesson-1',
    );

    expect(result).toEqual({
      status: 'SUCCESS',
      data: {
        provider: 'YOUTUBE',
        videoId: 'iMZ1skkbUWI',
        watermark: 'B123456·ABCDEF',
      },
    });
    expect(result).not.toHaveProperty('signedUrl');
    expect(result).not.toHaveProperty('videoId');
    expect(result).not.toHaveProperty('provider');
    expect(serviceMock.getLessonPlayback).toHaveBeenCalledWith(
      'acc-1',
      'lesson-1',
      false,
      'sess-1',
      'fp-1',
    );
  });

  it('passes staff flag through so the service enforces staff authz', async () => {
    serviceMock.getLessonPlayback.mockResolvedValue({
      provider: 'YOUTUBE',
      videoId: 'abc123',
    });

    await controller.getSignedHlsUrl(
      {
        account: { id: 'staff-1', kind: 'STAFF' },
        session: { id: 'sess-1' },
        deviceFingerprint: undefined,
      } as any,
      'lesson-1',
    );

    expect(serviceMock.getLessonPlayback).toHaveBeenCalledWith(
      'staff-1',
      'lesson-1',
      true,
      'sess-1',
      undefined,
    );
  });
});
