import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { db } from '@bahrawy/db';
import { VideoAccessService } from './video-access.grants.service';

jest.mock('@bahrawy/db', () => {
  const mockDbClient: any = {
    videoAccessGrant: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    videoAccessRequest: {
      update: jest.fn(),
    },
    authSession: {
      findUnique: jest.fn(),
    },
  };
  return { db: mockDbClient };
});

describe('VideoAccessService (grants)', () => {
  let service: VideoAccessService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [VideoAccessService],
    }).compile();
    service = module.get<VideoAccessService>(VideoAccessService);
  });

  describe('isGrantLive', () => {
    it('returns false for a revoked grant', () => {
      expect(
        service.isGrantLive({ revokedAt: new Date(), expiresAt: null }),
      ).toBe(false);
    });

    it('returns true for a permanent (never-expiring) grant', () => {
      expect(
        service.isGrantLive({ revokedAt: null, expiresAt: null }),
      ).toBe(true);
    });

    it('returns true when the grant expires in the future', () => {
      const future = new Date(Date.now() + 60 * 60 * 1000);
      expect(
        service.isGrantLive({ revokedAt: null, expiresAt: future }),
      ).toBe(true);
    });

    it('returns false when the grant already expired', () => {
      const past = new Date(Date.now() - 1000);
      expect(
        service.isGrantLive({ revokedAt: null, expiresAt: past }),
      ).toBe(false);
    });
  });

  describe('resolveDuration', () => {
    it('maps SESSION to a non-expiring grant', async () => {
      const r = await service.resolveDuration('SESSION', null);
      expect(r.expiresAt).toBeNull();
      expect(r.durationType).toBe('SESSION');
    });

    it('maps ONE_DAY to ~24h from now', async () => {
      const before = Date.now();
      const r = await service.resolveDuration('ONE_DAY', null);
      const delta = r.expiresAt!.getTime() - before;
      expect(delta).toBeGreaterThanOrEqual(24 * 60 * 60 * 1000 - 1000);
      expect(delta).toBeLessThanOrEqual(24 * 60 * 60 * 1000 + 1000);
    });

    it('clamps CUSTOM days to [1, 90] and defaults to 1', async () => {
      expect((await service.resolveDuration('CUSTOM', null)).expiresAt).toBeTruthy();
      expect((await service.resolveDuration('CUSTOM', 0)).expiresAt).toBeTruthy();
      const huge = await service.resolveDuration('CUSTOM', 5000);
      const delta = huge.expiresAt!.getTime() - Date.now();
      expect(delta).toBeLessThanOrEqual(90 * 24 * 60 * 60 * 1000 + 1000);
    });

    it('falls back to SESSION for unknown duration types', async () => {
      const r = await service.resolveDuration('NOPE' as any, null);
      expect(r.durationType).toBe('SESSION');
      expect(r.expiresAt).toBeNull();
    });
  });

  describe('findActiveGrant', () => {
    const baseGrant = {
      id: 'grant-1',
      accountId: 'acc-1',
      lessonId: 'lesson-1',
      durationType: 'ONE_DAY',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      sessionId: null,
      grantedAt: new Date(),
    };

    it('returns null when no grant exists', async () => {
      (db.videoAccessGrant.findFirst as jest.Mock).mockResolvedValue(null);
      const grant = await service.findActiveGrant('acc-1', 'lesson-1');
      expect(grant).toBeNull();
    });

    it('returns null when the grant is not live (expired)', async () => {
      (db.videoAccessGrant.findFirst as jest.Mock).mockResolvedValue({
        ...baseGrant,
        expiresAt: new Date(Date.now() - 1000),
      });
      const grant = await service.findActiveGrant('acc-1', 'lesson-1');
      expect(grant).toBeNull();
    });

    it('returns the grant for a live fixed-duration grant', async () => {
      (db.videoAccessGrant.findFirst as jest.Mock).mockResolvedValue(baseGrant);
      const grant = await service.findActiveGrant('acc-1', 'lesson-1');
      expect(grant?.id).toBe('grant-1');
    });

    it('returns null for a SESSION grant whose bound session is dead', async () => {
      (db.videoAccessGrant.findFirst as jest.Mock).mockResolvedValue({
        ...baseGrant,
        durationType: 'SESSION',
        sessionId: 'session-1',
      });
      (db.authSession.findUnique as jest.Mock).mockResolvedValue({
        id: 'session-1',
        revokedAt: new Date(),
      });
      const grant = await service.findActiveGrant(
        'acc-1',
        'lesson-1',
        'session-1',
      );
      expect(grant).toBeNull();
    });

    it('returns null for a SESSION grant with no session at all', async () => {
      (db.videoAccessGrant.findFirst as jest.Mock).mockResolvedValue({
        ...baseGrant,
        durationType: 'SESSION',
        sessionId: null,
      });
      const grant = await service.findActiveGrant('acc-1', 'lesson-1');
      expect(grant).toBeNull();
    });

    it('returns the grant when the SESSION bound session is live', async () => {
      (db.videoAccessGrant.findFirst as jest.Mock).mockResolvedValue({
        ...baseGrant,
        durationType: 'SESSION',
        sessionId: 'session-1',
      });
      (db.authSession.findUnique as jest.Mock).mockResolvedValue({
        id: 'session-1',
        revokedAt: null,
        absoluteExpiresAt: new Date(Date.now() + 60_000),
        idleExpiresAt: new Date(Date.now() + 60_000),
        account: { id: 'acc-1', status: 'ACTIVE' },
      });
      const grant = await service.findActiveGrant(
        'acc-1',
        'lesson-1',
        'session-1',
      );
      expect(grant?.id).toBe('grant-1');
    });
  });

  describe('assertPlaybackAllowed', () => {
    it('returns allowed true when an active grant exists', async () => {
      jest.spyOn(service, 'findActiveGrant').mockResolvedValue({
        id: 'grant-1',
      } as any);
      const r = await service.assertPlaybackAllowed('acc-1', 'lesson-1');
      expect(r).toEqual({ allowed: true });
    });

    it('returns VIDEO_ACCESS_NOT_GRANTED when no active grant exists', async () => {
      jest.spyOn(service, 'findActiveGrant').mockResolvedValue(null);
      const r = await service.assertPlaybackAllowed('acc-1', 'lesson-1');
      expect(r).toEqual({ allowed: false, code: 'VIDEO_ACCESS_NOT_GRANTED' });
    });
  });

  describe('revoke', () => {
    it('throws NotFoundException when no active grant matches', async () => {
      (db.videoAccessGrant.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(
        service.revoke(
          { id: 'admin-1', organizationId: 'org-1', kind: 'STAFF' },
          'missing',
          null,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('revokes the grant and marks its request REVOKED', async () => {
      const grant = { id: 'grant-1', requestId: 'req-1' };
      (db.videoAccessGrant.findFirst as jest.Mock).mockResolvedValue(grant);
      (db.videoAccessGrant.update as jest.Mock).mockResolvedValue({
        ...grant,
        revokedAt: new Date(),
      });
      await service.revoke(
        { id: 'admin-1', organizationId: 'org-1', kind: 'STAFF' },
        'grant-1',
        'policy',
      );
      expect(db.videoAccessGrant.update).toHaveBeenCalledWith({
        where: { id: 'grant-1' },
        data: expect.objectContaining({
          revokedAt: expect.any(Date),
          revokedBy: 'admin-1',
          revokedReason: 'policy',
        }),
      });
      expect(db.videoAccessRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: { status: 'REVOKED', reviewedAt: expect.any(Date) },
      });
    });
  });
});