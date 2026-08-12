import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { db } from '@bahrawy/db';
import type { ExamSession, Prisma } from '@bahrawy/db';

export const EXAM_LOCK_REASONS = [
  'FULLSCREEN_EXIT',
  'TAB_SWITCH',
  'WINDOW_BLUR',
] as const;
export type ExamLockReason = (typeof EXAM_LOCK_REASONS)[number];

const LOCK_MESSAGES: Record<string, string> = {
  FULLSCREEN_EXIT: 'تم إيقاف الامتحان بسبب الخروج من وضع ملء الشاشة.',
  TAB_SWITCH:
    'تم إيقاف الامتحان بسبب التنقل بين الألسنة أو النوافذ أثناء الامتحان.',
  WINDOW_BLUR: 'تم إيقاف الامتحان بسبب مغادرة نافذة الامتحان.',
};

export const EXAM_LOCKED_MESSAGE =
  'تم إيقاف الامتحان بسبب مخالفة قواعد الامتحان. تواصل مع إدارة الأكاديمية لإعادة فتحه.';
export const EXAM_EXPIRED_MESSAGE = 'انتهى الوقت المحدد للامتحان.';

export function lockMessage(reason: string | null): string {
  return (reason && LOCK_MESSAGES[reason]) || EXAM_LOCKED_MESSAGE;
}

export function examSessionSummary(session: ExamSession) {
  return {
    id: session.id,
    assessmentId: session.assessmentId,
    startedAt: session.startedAt,
    expiresAt: session.expiresAt,
    lastActivityAt: session.lastActivityAt,
    endedAt: session.endedAt,
    status: session.status,
    attemptCount: session.attemptCount,
    openCount: session.openCount,
    violationCount: session.violationCount,
    lockedAt: session.lockedAt,
    lockReason: session.lockReason,
    reopenedAt: session.reopenedAt,
  };
}

export type ExamViolationReport = {
  sessionId: string;
  status: string;
  lockedAt: Date | null;
  lockReason: string | null;
  violationCount: number;
};

type Actor = { id: string; organizationId: string; kind: string };

@Injectable()
export class ExamSessionService {
  async latest(accountId: string, assessmentId: string) {
    return db.examSession.findFirst({
      where: { accountId, assessmentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async latestSummary(accountId: string, assessmentId: string) {
    const session = await this.latest(accountId, assessmentId);
    return session ? examSessionSummary(session) : null;
  }

  expiredAt(session: ExamSession, now: Date): boolean {
    return (
      session.expiresAt !== null && session.expiresAt.getTime() <= now.getTime()
    );
  }

  /**
   * Called when the student is about to start/continue an exam.
   * - A LOCKED session blocks any new attempt until an admin reopens it.
   * - An EXPIRED session (timer elapsed) blocks any new attempt until an
   *   admin reopens it. This closes the previous bypass where an expired
   *   sitting silently created a brand-new session (openCount++).
   * - An ACTIVE session whose timer has elapsed is lazily expired and blocks.
   * - SUBMITTED means the previous sitting is over: the caller may open a
   *   fresh session (a new legitimate sitting).
   */
  async prepareStart(
    accountId: string,
    assessmentId: string,
  ): Promise<ExamSession | null> {
    const session = await this.latest(accountId, assessmentId);
    if (!session) return null;

    if (session.status === 'LOCKED') {
      throw new ForbiddenException({
        code: 'EXAM_SESSION_LOCKED',
        message: lockMessage(session.lockReason),
        reason: session.lockReason,
      });
    }

    if (session.status === 'EXPIRED') {
      throw new ConflictException({
        code: 'EXAM_SESSION_EXPIRED',
        message: EXAM_EXPIRED_MESSAGE,
      });
    }

    if (session.status === 'ACTIVE') {
      if (this.expiredAt(session, new Date())) {
        await this.markExpired(session);
        throw new ConflictException({
          code: 'EXAM_SESSION_EXPIRED',
          message: EXAM_EXPIRED_MESSAGE,
        });
      }
      return session;
    }

    // SUBMITTED -> caller creates a fresh sitting.
    return null;
  }

  async create(
    accountId: string,
    assessmentId: string,
    durationMinutes: number,
  ): Promise<ExamSession> {
    const now = new Date();
    const previousSittings = await db.examSession.count({
      where: { accountId, assessmentId },
    });
    const session = await db.examSession.create({
      data: {
        assessmentId,
        accountId,
        startedAt: now,
        expiresAt:
          durationMinutes > 0
            ? new Date(now.getTime() + durationMinutes * 60 * 1000)
            : null,
        lastActivityAt: now,
        attemptCount: 1,
        openCount: previousSittings + 1,
        violationCount: 0,
        status: 'ACTIVE',
      },
    });
    await this.recordEvent(session, 'EXAM_STARTED', {});
    return session;
  }

  async attachAttempt(
    accountId: string,
    assessmentId: string,
    sessionId: string,
  ): Promise<ExamSession> {
    const now = new Date();
    const session = await db.examSession.findUnique({
      where: { id: sessionId },
    });
    if (
      !session ||
      session.accountId !== accountId ||
      session.assessmentId !== assessmentId
    ) {
      throw new NotFoundException('Exam session not found');
    }
    if (session.status === 'LOCKED') {
      throw new ForbiddenException({
        code: 'EXAM_SESSION_LOCKED',
        message: lockMessage(session.lockReason),
        reason: session.lockReason,
      });
    }
    if (session.status !== 'ACTIVE') {
      if (session.status === 'EXPIRED') {
        throw new ConflictException({
          code: 'EXAM_SESSION_EXPIRED',
          message: EXAM_EXPIRED_MESSAGE,
        });
      }
      throw new ConflictException({
        code: 'EXAM_SESSION_ENDED',
        message: 'المحاولة الحالية انتهت. ابدأ امتحاناً جديداً.',
      });
    }
    const updated = await db.examSession.update({
      where: { id: session.id },
      data: { attemptCount: { increment: 1 }, lastActivityAt: now },
    });
    await this.recordEvent(session, 'EXAM_STARTED', {
      attemptCount: updated.attemptCount,
    });
    return updated;
  }

  /**
   * Verifies the session tied to an attempt is still continuable.
   * Throws for LOCKED / EXPIRED sessions; otherwise refreshes activity.
   * Returns the session (or null when the attempt has no session, e.g. an
   * untimed assessment or a legacy attempt).
   */
  async enforceForAttempt(
    accountId: string,
    attempt: {
      id: string;
      assessmentId: string;
      accountId: string;
      examSessionId: string | null;
    },
  ): Promise<ExamSession | null> {
    if (!attempt.examSessionId) return null;
    const session = await db.examSession.findUnique({
      where: { id: attempt.examSessionId },
    });
    if (
      !session ||
      session.accountId !== accountId ||
      session.assessmentId !== attempt.assessmentId
    ) {
      throw new NotFoundException('Exam session not found');
    }

    if (session.status === 'LOCKED') {
      throw new ForbiddenException({
        code: 'EXAM_SESSION_LOCKED',
        message: lockMessage(session.lockReason),
        reason: session.lockReason,
      });
    }
    if (session.status === 'EXPIRED') {
      throw new ConflictException({
        code: 'EXAM_SESSION_EXPIRED',
        message: EXAM_EXPIRED_MESSAGE,
      });
    }
    if (session.status !== 'ACTIVE') {
      throw new ConflictException({
        code: 'EXAM_SESSION_ENDED',
        message: 'المحاولة الحالية انتهت. ابدأ امتحاناً جديداً.',
      });
    }

    const now = new Date();
    if (this.expiredAt(session, now)) {
      await this.markExpired(session);
      throw new ConflictException({
        code: 'EXAM_SESSION_EXPIRED',
        message: EXAM_EXPIRED_MESSAGE,
      });
    }

    await db.examSession.update({
      where: { id: session.id },
      data: { lastActivityAt: now },
    });
    return session;
  }

  async sessionByAttempt(accountId: string, attemptId: string) {
    const attempt = await db.assessmentAttempt.findUnique({
      where: { id: attemptId },
      select: { id: true, accountId: true, examSessionId: true },
    });
    if (!attempt || attempt.accountId !== accountId) {
      throw new NotFoundException('Attempt not found');
    }
    if (!attempt.examSessionId) return null;
    const session = await db.examSession.findUnique({
      where: { id: attempt.examSessionId },
    });
    if (!session) return null;
    return examSessionSummary(session);
  }

  /**
   * Verifies a session can still accept a submission attempt.
   * A LOCKED session (an admin-blocked violation) and an EXPIRED session
   * (timer elapsed) both block submission until an authorized admin reopens
   * the exam.
   */
  async enforceForSubmit(
    accountId: string,
    attempt: {
      id: string;
      assessmentId: string;
      accountId: string;
      examSessionId: string | null;
    },
  ): Promise<ExamSession | null> {
    if (!attempt.examSessionId) return null;
    const session = await db.examSession.findUnique({
      where: { id: attempt.examSessionId },
    });
    if (
      !session ||
      session.accountId !== accountId ||
      session.assessmentId !== attempt.assessmentId
    ) {
      throw new NotFoundException('Exam session not found');
    }
    if (session.status === 'LOCKED') {
      throw new ForbiddenException({
        code: 'EXAM_SESSION_LOCKED',
        message: lockMessage(session.lockReason),
        reason: session.lockReason,
      });
    }
    if (session.status === 'EXPIRED') {
      throw new ConflictException({
        code: 'EXAM_SESSION_EXPIRED',
        message: EXAM_EXPIRED_MESSAGE,
      });
    }
    if (session.status === 'ACTIVE' && this.expiredAt(session, new Date())) {
      await this.markExpired(session);
      throw new ConflictException({
        code: 'EXAM_SESSION_EXPIRED',
        message: EXAM_EXPIRED_MESSAGE,
      });
    }
    return session;
  }

  async reportViolationForAttempt(
    accountId: string,
    attemptId: string,
    reason: string,
  ): Promise<ExamViolationReport> {
    const LOCK_REASONS = new Set<string>(EXAM_LOCK_REASONS);
    if (!LOCK_REASONS.has(reason)) {
      throw new BadRequestException({
        code: 'INVALID_VIOLATION_REASON',
        message: 'سبب مخالفة غير معروف.',
      });
    }
    const attempt = await db.assessmentAttempt.findUnique({
      where: { id: attemptId },
      select: { id: true, accountId: true, examSessionId: true },
    });
    if (!attempt || attempt.accountId !== accountId) {
      throw new NotFoundException('Attempt not found');
    }
    if (!attempt.examSessionId) {
      return {
        sessionId: '',
        status: 'ACTIVE',
        lockedAt: null,
        lockReason: null,
        violationCount: 0,
      };
    }
    const session = await db.examSession.findUnique({
      where: { id: attempt.examSessionId },
    });
    if (
      !session ||
      session.accountId !== accountId ||
      session.status !== 'ACTIVE'
    ) {
      return {
        sessionId: session?.id ?? '',
        status: session?.status ?? 'ACTIVE',
        lockedAt: session?.lockedAt ?? null,
        lockReason: session?.lockReason ?? null,
        violationCount: session?.violationCount ?? 0,
      };
    }
    const now = new Date();
    const updated = await db.examSession.update({
      where: { id: session.id },
      data: {
        status: 'LOCKED',
        lockedAt: now,
        lockReason: reason,
        violationCount: { increment: 1 },
        lastActivityAt: now,
      },
    });
    await this.recordEvent(session, reason, { attemptId });
    await this.recordEvent(session, 'EXAM_LOCKED', { reason });
    return {
      sessionId: updated.id,
      status: updated.status,
      lockedAt: updated.lockedAt,
      lockReason: updated.lockReason,
      violationCount: updated.violationCount,
    };
  }

  async markSubmitted(sessionId: string): Promise<void> {
    const session = await db.examSession.findUnique({
      where: { id: sessionId },
    });
    if (
      !session ||
      (session.status !== 'ACTIVE' && session.status !== 'EXPIRED')
    ) {
      return;
    }
    const now = new Date();
    await db.examSession.update({
      where: { id: sessionId },
      data: { status: 'SUBMITTED', endedAt: now, lastActivityAt: now },
    });
    await this.recordEvent(session, 'EXAM_SUBMITTED', {});
  }

  async markExpired(session: ExamSession): Promise<void> {
    if (session.status !== 'ACTIVE') return;
    const now = new Date();
    await db.examSession.update({
      where: { id: session.id },
      data: { status: 'EXPIRED', endedAt: now, lastActivityAt: now },
    });
    await this.recordEvent(session, 'EXAM_EXPIRED', {});
  }

  async reopen(actor: Actor, sessionId: string): Promise<ExamSession> {
    const session = await db.examSession.findUnique({
      where: { id: sessionId },
      include: { account: { select: { organizationId: true } } },
    });
    if (!session || session.account.organizationId !== actor.organizationId) {
      throw new NotFoundException('Exam session not found');
    }
    if (session.status !== 'LOCKED' && session.status !== 'EXPIRED') {
      throw new ConflictException({
        code: 'EXAM_SESSION_NOT_LOCKED',
        message: 'لا يمكن إعادة فتح امتحان غير موقوف أو منتهي الوقت.',
      });
    }
    const now = new Date();
    // A reopen must always produce a usable ACTIVE session:
    // - If the timer has already elapsed (session was EXPIRED, or a LOCKED
    //   session whose window ran out while suspended), grant a fresh full
    //   duration window so the student can actually resume after unlock.
    // - Otherwise (LOCKED with time still remaining, or untimed) keep the
    //   remaining window so the student continues the same attempt.
    const timeElapsed =
      session.expiresAt !== null &&
      session.expiresAt.getTime() <= now.getTime();
    const needsFreshWindow = session.status === 'EXPIRED' || timeElapsed;
    let expiresAt = session.expiresAt;
    if (needsFreshWindow) {
      const assessment = await db.assessment.findUnique({
        where: { id: session.assessmentId },
        select: { durationMinutes: true },
      });
      const durationMinutes = assessment?.durationMinutes ?? 0;
      expiresAt =
        durationMinutes > 0
          ? new Date(now.getTime() + durationMinutes * 60 * 1000)
          : null;
    }
    const attempt = await db.assessmentAttempt.findFirst({
      where: { examSessionId: session.id },
      orderBy: { startedAt: 'desc' },
      select: { id: true },
    });
    const updated = await db.examSession.update({
      where: { id: session.id },
      data: {
        status: 'ACTIVE',
        lockedAt: null,
        lockReason: null,
        lastActivityAt: now,
        reopenedAt: now,
        reopenedBy: actor.id,
        expiresAt,
      },
    });
    await this.recordEvent(
      session,
      'EXAM_REOPENED',
      {
        reason: session.lockReason,
        wasStatus: session.status,
        attemptId: attempt?.id ?? null,
        organizationId: actor.organizationId,
      },
      actor.id,
    );
    return updated;
  }

  /**
   * One-time "extra attempt" grant issued by an admin (the "فتح الامتحان
   * للطالب" flow for FAILED quiz cases). Consumed on the next new attempt
   * start. The previous FAILED attempt is left untouched in history.
   */
  async createGrant(
    actor: Actor,
    accountId: string,
    assessmentId: string,
    reason = 'ADMIN_UNLOCK',
  ): Promise<{ id: string; accountId: string; assessmentId: string }> {
    const grant = await db.examGrant.create({
      data: {
        accountId,
        assessmentId,
        createdBy: actor.id,
        reason,
      },
      select: { id: true, accountId: true, assessmentId: true },
    });
    return grant;
  }

  /**
   * Count of still-unused grants for (student, assessment). A grant reserves
   * exactly one fresh attempt beyond the configured maxAttempts.
   */
  async availableGrants(accountId: string, assessmentId: string) {
    return db.examGrant.count({
      where: {
        accountId,
        assessmentId,
        usedAt: null,
        usedAttemptId: null,
      },
    });
  }

  /**
   * Marks one grant as consumed, binding it to the fresh attempt created by
   * the student after the admin unlock. Throws when no grant is available.
   */
  async consumeGrant(
    accountId: string,
    assessmentId: string,
    attemptId: string,
  ): Promise<void> {
    const grant = await db.examGrant.findFirst({
      where: {
        accountId,
        assessmentId,
        usedAt: null,
        usedAttemptId: null,
      },
      orderBy: { createdAt: 'asc' },
    });
    if (!grant) {
      throw new ConflictException({
        code: 'NO_EXAM_GRANT',
        message: 'لا يوجد فتح امتحان نشط لهذا الطالب.',
      });
    }
    const now = new Date();
    await db.examGrant.update({
      where: { id: grant.id },
      data: { usedAt: now, usedAttemptId: attemptId },
    });
  }

  async listEvents(organizationId: string, sessionId: string) {
    const session = await db.examSession.findUnique({
      where: { id: sessionId },
      include: { account: { select: { organizationId: true } } },
    });
    if (!session || session.account.organizationId !== organizationId) {
      throw new NotFoundException('Exam session not found');
    }
    return db.examSessionEvent.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'asc' },
      select: {
        id: true,
        eventType: true,
        timestamp: true,
        actor: true,
        metadata: true,
      },
    });
  }

  private async recordEvent(
    session: ExamSession,
    eventType: string,
    metadata: Prisma.InputJsonValue | undefined,
    actor?: string,
  ): Promise<void> {
    await db.examSessionEvent.create({
      data: {
        sessionId: session.id,
        accountId: session.accountId,
        assessmentId: session.assessmentId,
        eventType,
        metadata: metadata ?? {},
        actor: actor ?? null,
      },
    });
  }
}
