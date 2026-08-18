import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { db, Prisma } from '@bahrawy/db';
import { SecurityService } from '../security/security.service';
import { NotificationService } from '../notification/notification.service';
import { VideoAccessService } from './video-access.grants.service';
import { VideoAccessMailerService } from './video-access.mailer';
import { CatalogService } from '../catalog/catalog.service';
import { CreateVideoAccessRequestDto } from './video-access.dto';

const REQUEST_EMAIL_MAX = 254;

/**
 * Student-facing video access requests. A student who is otherwise locked out
 * of a video lesson (missing entitlement) can file a request that admins
 * review. All identity (accountId, organizationId, email) is derived from the
 * authenticated session — never from the request body.
 */
@Injectable()
export class StudentVideoAccessRequestService {
  constructor(
    private readonly securityService: SecurityService,
    private readonly notificationService: NotificationService,
    private readonly grants: VideoAccessService,
    private readonly mailer: VideoAccessMailerService,
    private readonly catalogService: CatalogService,
  ) {}

  /**
   * Create a new video access request for the current student.
   * Server-side invariants:
   *  - account is a STUDENT (SessionAuthGuard already guarantees ACTIVE)
   *  - lesson exists, is PUBLISHED, belongs to the student's org
   *  - lesson has a video attached (video ∈ lesson)
   *  - the student does not already have access (entitlement)
   *  - the lock is an entitlement lock, not a quiz/prerequisite gate
   *  - no duplicate PENDING request already exists
   *  - no active grant already exists
   */
  async create(
    account: { id: string; organizationId: string; kind: string },
    sessionId: string | undefined,
    dto: CreateVideoAccessRequestDto,
  ): Promise<any> {
    if (account.kind !== 'STUDENT') {
      throw new ForbiddenException('Only students can request video access');
    }

    const lesson = await db.lesson.findFirst({
      where: { id: dto.lessonId },
      include: {
        unit: { include: { chapter: { include: { course: true } } } },
      },
    });
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }
    if (lesson.unit.chapter.course.organizationId !== account.organizationId) {
      throw new NotFoundException('Lesson not found');
    }
    if (lesson.status !== 'PUBLISHED') {
      throw new ForbiddenException('Lesson is not published');
    }

    const video = await db.videoLesson.findUnique({
      where: { lessonId: lesson.id },
      select: { id: true, sourceRef: true, provider: true, status: true },
    });
    if (!video) {
      throw new BadRequestException('This lesson has no video attached');
    }

    // Only entitlement locks are requestable. Quiz/prerequisite gates must be
    // passed — an admin grant is not a bypass for exam gating.
    try {
      await this.catalogService.canAccessLesson(account.id, lesson.id);
      throw new ConflictException(
        'You already have access to this lesson — no request is needed',
      );
    } catch (error: any) {
      const code = (error.getResponse?.() as any)?.code;
      if (error instanceof ConflictException) throw error;
      if (
        error instanceof ForbiddenException &&
        code !== 'MISSING_ENTITLEMENT'
      ) {
        throw new ForbiddenException({
          code: 'LESSON_NOT_REQUESTABLE',
          message: 'Complete the required lesson requirements first.',
        });
      }
      if (error instanceof NotFoundException) throw error;
      if (error instanceof BadRequestException) throw error;
      // otherwise: MISSING_ENTITLEMENT (or another forbidden reason) → requestable
    }

    const existingGrant = await this.grants.findActiveGrant(
      account.id,
      lesson.id,
    );
    if (existingGrant) {
      throw new ConflictException(
        'You already have an approved grant for this video',
      );
    }

    const existingPending = await db.videoAccessRequest.findFirst({
      where: {
        accountId: account.id,
        lessonId: lesson.id,
        status: 'PENDING',
      },
      select: { id: true, requestedAt: true },
    });
    if (existingPending) {
      throw new ConflictException(
        'You already have a pending request for this video',
      );
    }

    const email = await this.resolveRequestEmail(account, dto.requestedEmail);

    const request = await db.videoAccessRequest.create({
      data: {
        organizationId: account.organizationId,
        accountId: account.id,
        courseId: lesson.unit.chapter.courseId,
        lessonId: lesson.id,
        videoId: video.sourceRef || video.id,
        requestedEmail: email,
        sessionId: sessionId ?? null,
        status: 'PENDING',
      },
    });

    await this.notifyAdminsAndStudent(account, request, lesson, video);

    return {
      id: request.id,
      status: request.status,
      requestedAt: request.requestedAt,
    };
  }

  private async resolveRequestEmail(
    account: { id: string },
    provided: string | undefined,
  ): Promise<string> {
    if (provided) return provided.slice(0, REQUEST_EMAIL_MAX);
    const record = await db.account.findUnique({
      where: { id: account.id },
      select: { emailEncrypted: true, phoneEncrypted: true },
    });
    if (record?.emailEncrypted) {
      try {
        return this.securityService.decrypt(record.emailEncrypted);
      } catch {
        /* fall through */
      }
    }
    if (record?.phoneEncrypted) {
      try {
        return this.securityService.decrypt(record.phoneEncrypted);
      } catch {
        /* ignore */
      }
    }
    return '';
  }

  private async notifyAdminsAndStudent(
    account: { id: string },
    request: any,
    lesson: any,
    video: any,
  ) {
    const student = await db.studentProfile.findUnique({
      where: { accountId: account.id },
      select: { displayName: true, studentNumber: true },
    });
    const studentName = student?.displayName || 'طالب';
    const title = `طلب فتح فيديو جديد: ${lesson.titleAr}`;
    const content = `${studentName} طلب فتح فيديو الدرس «${lesson.titleAr}»`;
    await this.notificationService
      .createForStaff(
        request.organizationId,
        title,
        content,
        {
          kind: 'VIDEO_ACCESS_REQUEST',
          requestId: request.id,
          lessonId: request.lessonId,
          accountId: request.accountId,
        },
      )
      .catch(() => undefined);
    await this.mailer
      .notifyAdminsOfNewRequest({
        studentName,
        studentNumber: student?.studentNumber ?? null,
        requestedEmail: request.requestedEmail,
        courseTitle: lesson.unit.chapter.course?.titleAr ?? '—',
        lessonTitle: lesson.titleAr,
        requestedAt: request.requestedAt,
      })
      .catch(() => undefined);
  }

  async myRequests(accountId: string): Promise<any[]> {
    return db.videoAccessRequest.findMany({
      where: { accountId },
      orderBy: { requestedAt: 'desc' },
      take: 100,
      include: {
        grant: {
          select: {
            durationType: true,
            expiresAt: true,
            revokedAt: true,
          },
        },
      },
    });
  }

  async statusForLesson(
    account: { id: string; organizationId: string; kind: string },
    lessonId: string,
  ): Promise<any> {
    const lesson = await db.lesson.findFirst({
      where: { id: lessonId },
      include: {
        unit: { include: { chapter: { include: { course: true } } } },
      },
    });
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }
    if (lesson.unit.chapter.course.organizationId !== account.organizationId) {
      throw new NotFoundException('Lesson not found');
    }
    const video = await db.videoLesson.findUnique({
      where: { lessonId: lesson.id },
      select: { id: true, sourceRef: true, provider: true, status: true },
    });
    const hasVideo = Boolean(video);

    let canPlay = false;
    try {
      await this.catalogService.canAccessLesson(account.id, lesson.id);
      canPlay = true;
    } catch (error: any) {
      if (error instanceof ForbiddenException) {
        const code = (error.getResponse() as any)?.code;
        if (code === 'LESSON_LOCKED' || code === 'LESSON_PREREQUISITE_NOT_MET') {
          return {
            lessonId,
            hasVideo,
            requestable: false,
            canPlay: false,
            reason: code,
            request: null,
            grant: null,
          };
        }
      }
      const grant = await this.grants.findActiveGrant(account.id, lesson.id);
      canPlay = Boolean(grant);
    }

    const request = await db.videoAccessRequest.findFirst({
      where: { accountId: account.id, lessonId: lesson.id },
      orderBy: { requestedAt: 'desc' },
      take: 1,
    });

    return {
      lessonId,
      hasVideo,
      requestable: hasVideo && !canPlay,
      canPlay,
      reason: canPlay ? null : 'MISSING_ENTITLEMENT',
      request: request
        ? {
            id: request.id,
            status: request.status,
            requestedAt: request.requestedAt,
            rejectionReason: request.rejectionReason,
            grantExpiresAt: request.grantExpiresAt,
          }
        : null,
    };
  }
}
