import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { db, VideoAccessGrantDuration } from '@bahrawy/db';

const SESSION_LIVE_GRACE_MS = 0;

/**
 * Central authority for video access grants. Both the student-facing module
 * and the admin review module route grant lookups and mutations through here
 * so playback authorization and expiry/revocation stay consistent.
 */
@Injectable()
export class VideoAccessService {
  /**
   * Returns the currently-valid grant for (accountId, lessonId), or null.
   * Validity rules:
   *  - not revoked
   *  - expiresAt is null (permanent, only via explicit reason) or in the future
   *  - SESSION grants additionally require the bound auth session to still be
   *    live (grant dies with the session it was issued for)
   */
  async findActiveGrant(
    accountId: string,
    lessonId: string,
    sessionId?: string,
  ) {
    const grant = await db.videoAccessGrant.findFirst({
      where: {
        accountId,
        lessonId,
        revokedAt: null,
      },
      orderBy: { grantedAt: 'desc' },
    });
    if (!grant) return null;
    if (!this.isGrantLive(grant)) return null;
    if (grant.durationType === 'SESSION') {
      const boundSession = grant.sessionId ?? sessionId;
      if (!boundSession) return null;
      const live = await this.isSessionLive(boundSession);
      if (!live) return null;
    }
    return grant;
  }

  isGrantLive(grant: {
    expiresAt: Date | null;
    revokedAt: Date | null;
  }): boolean {
    if (grant.revokedAt) return false;
    if (!grant.expiresAt) return true;
    return grant.expiresAt.getTime() > Date.now() + SESSION_LIVE_GRACE_MS;
  }

  /**
   * Assert the student may play this lesson's video, either via normal
   * catalog access or via an active grant. Returns the reason on failure.
   */
  async assertPlaybackAllowed(
    accountId: string,
    lessonId: string,
    sessionId?: string,
  ): Promise<{ allowed: true } | { allowed: false; code: string }> {
    const grant = await this.findActiveGrant(accountId, lessonId, sessionId);
    if (!grant) {
      return { allowed: false, code: 'VIDEO_ACCESS_NOT_GRANTED' };
    }
    return { allowed: true };
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

  async revoke(
    actor: { id: string; organizationId: string; kind: string },
    grantId: string,
    reason: string | null,
  ) {
    const grant = await db.videoAccessGrant.findFirst({
      where: {
        id: grantId,
        organizationId: actor.organizationId,
        revokedAt: null,
      },
    });
    if (!grant) {
      throw new NotFoundException('Active grant not found');
    }
    const updated = await db.videoAccessGrant.update({
      where: { id: grant.id },
      data: {
        revokedAt: new Date(),
        revokedBy: actor.id,
        revokedReason: reason,
      },
    });
    await db.videoAccessRequest.update({
      where: { id: grant.requestId },
      data: { status: 'REVOKED', reviewedAt: new Date() },
    });
    return updated;
  }

  async resolveDuration(
    durationType: VideoAccessGrantDuration,
    customDays: number | null,
  ): Promise<{ expiresAt: Date | null; durationType: VideoAccessGrantDuration }> {
    const now = new Date();
    switch (durationType) {
      case 'SESSION':
        return { expiresAt: null, durationType };
      case 'ONE_DAY':
        return { expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), durationType };
      case 'THREE_DAYS':
        return { expiresAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), durationType };
      case 'SEVEN_DAYS':
        return { expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), durationType };
      case 'CUSTOM': {
        const days = customDays && Number.isFinite(customDays) ? customDays : 1;
        const clamped = Math.min(Math.max(days, 1), 90);
        return { expiresAt: new Date(now.getTime() + clamped * 24 * 60 * 60 * 1000), durationType };
      }
      default:
        return { expiresAt: null, durationType: 'SESSION' as const };
    }
  }
}
