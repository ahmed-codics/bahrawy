import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { db, Prisma } from '@bahrawy/db';
import { AdminAuditService } from '../common/services/audit.service';
import { VideoAccessService } from '../../video-access/video-access.grants.service';
import { NotificationService } from '../../notification/notification.service';
import { SecurityService } from '../../security/security.service';
import { VideoAccessMailerService } from '../../video-access/video-access.mailer';
import {
  ApproveVideoAccessRequestDto,
  RejectVideoAccessRequestDto,
  VideoAccessRequestListQueryDto,
} from './video-access.dto';

type Actor = { id: string; organizationId: string; kind: string };

const MAX_PAGE_SIZE = 100;
const MAX_SEARCH_LENGTH = 100;
const MAX_FETCH_ROWS = 2000;

const VALID_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'REVOKED'];

@Injectable()
export class AdminV1VideoAccessService {
  constructor(
    private readonly audit: AdminAuditService,
    private readonly grants: VideoAccessService,
    private readonly notifications: NotificationService,
    private readonly mailer: VideoAccessMailerService,
    private readonly security: SecurityService,
  ) {}

  async list(organizationId: string, query: VideoAccessRequestListQueryDto) {
    const page = Math.max(query.page ?? 1, 1);
    const pageSize = Math.min(Math.max(query.pageSize ?? 25, 1), MAX_PAGE_SIZE);
    const search = (query.search ?? '').trim().slice(0, MAX_SEARCH_LENGTH);
    const status = query.status;

    const where: Prisma.VideoAccessRequestWhereInput = {
      organizationId,
      ...(status ? { status: status as any } : {}),
      ...(query.courseId ? { courseId: query.courseId } : {}),
      ...(query.from || query.to
        ? {
            requestedAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { requestedEmail: { contains: search, mode: 'insensitive' } },
              {
                account: {
                  studentProfile: {
                    displayName: { contains: search, mode: 'insensitive' },
                  },
                },
              },
              {
                account: {
                  studentProfile: { studentNumber: { equals: this.toInt(search) ?? -1 } },
                },
              },
            ],
          }
        : {}),
    };

    const [requests, grades] = await Promise.all([
      db.videoAccessRequest.findMany({
        where,
        orderBy: { requestedAt: 'desc' },
        take: MAX_FETCH_ROWS,
        include: {
          account: {
            select: {
              id: true,
              studentProfile: {
                select: {
                  displayName: true,
                  studentNumber: true,
                  gradeId: true,
                },
              },
            },
          },
        },
      }),
      db.grade.findMany({
        where: { organizationId, archivedAt: null },
        select: { id: true, nameAr: true },
        orderBy: { nameAr: 'asc' },
      }),
    ]);

    const gradeNameById = new Map(grades.map((g) => [g.id, g.nameAr]));

    const items = requests
      .filter((request) => {
        if (query.gradeId) {
          return request.account.studentProfile?.gradeId === query.gradeId;
        }
        return true;
      })
      .map((request) => ({
        id: request.id,
        status: request.status,
        requestedAt: request.requestedAt,
        reviewedAt: request.reviewedAt,
        reviewedBy: request.reviewedBy,
        rejectionReason: request.rejectionReason,
        grantExpiresAt: request.grantExpiresAt,
        requestedEmail: request.requestedEmail,
        accountId: request.accountId,
        courseId: request.courseId,
        lessonId: request.lessonId,
        videoId: request.videoId,
        student: {
          displayName: request.account.studentProfile?.displayName ?? null,
          studentNumber: request.account.studentProfile?.studentNumber ?? null,
          gradeId: request.account.studentProfile?.gradeId ?? null,
          gradeName: request.account.studentProfile?.gradeId
            ? (gradeNameById.get(request.account.studentProfile.gradeId) ?? null)
            : null,
        },
      }));

    const total = items.length;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const paged = items.slice((page - 1) * pageSize, page * pageSize);

    return {
      items: paged,
      meta: { page, pageSize, total, pageCount },
      grades,
    };
  }

  async stats(organizationId: string) {
    const [pending, approved, rejected] = await Promise.all([
      db.videoAccessRequest.count({
        where: { organizationId, status: 'PENDING' },
      }),
      db.videoAccessRequest.count({
        where: { organizationId, status: 'APPROVED' },
      }),
      db.videoAccessRequest.count({
        where: { organizationId, status: 'REJECTED' },
      }),
    ]);
    return { pending, approved, rejected };
  }

  async approve(
    actor: Actor,
    requestId: string,
    dto: ApproveVideoAccessRequestDto,
  ) {
    const request = await this.loadRequest(actor.organizationId, requestId);
    if (request.status !== 'PENDING') {
      throw new ConflictException(
        `Cannot approve a request in "${request.status}" status`,
      );
    }

    const durationType = dto.durationType ?? 'SESSION';
    const { expiresAt } = await this.grants.resolveDuration(
      durationType,
      dto.customDays ?? null,
    );

    const now = new Date();
    const result = await db.$transaction(async (tx: any) => {
      const grant = await tx.videoAccessGrant.create({
        data: {
          organizationId: actor.organizationId,
          accountId: request.accountId,
          courseId: request.courseId,
          lessonId: request.lessonId,
          videoId: request.videoId,
          requestId: request.id,
          sessionId: request.sessionId ?? null,
          durationType,
          grantedBy: actor.id,
          grantedAt: now,
          expiresAt,
        },
      });
      await tx.videoAccessRequest.update({
        where: { id: request.id },
        data: {
          status: 'APPROVED',
          reviewedAt: now,
          reviewedBy: actor.id,
          grantExpiresAt: expiresAt,
        },
      });
      return grant;
    });

    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: 'ADMIN_VIDEO_ACCESS_APPROVE',
      targetType: 'VIDEO_ACCESS_REQUEST',
      targetId: request.id,
      before: { status: 'PENDING' },
      after: {
        status: 'APPROVED',
        durationType,
        expiresAt: expiresAt?.toISOString() ?? null,
      },
      reason: 'الموافقة على طلب فتح الفيديو',
    });

    await this.notifyStudent(request, {
      title: 'تم فتح الفيديو لك',
      content: `تمت الموافقة على طلبك لفتح الفيديو. يمكنك الآن مشاهدة الفيديو${expiresAt ? ` حتى ${expiresAt.toLocaleDateString('ar-EG')}` : ''}.`,
      requestId: request.id,
      approved: true,
      expiresAt,
      durationLabel: this.durationLabel(durationType),
    });

    return {
      id: request.id,
      status: 'APPROVED',
      durationType,
      expiresAt: expiresAt?.toISOString() ?? null,
      grantId: result.id,
    };
  }

  async reject(
    actor: Actor,
    requestId: string,
    dto: RejectVideoAccessRequestDto,
  ) {
    const request = await this.loadRequest(actor.organizationId, requestId);
    if (request.status !== 'PENDING') {
      throw new ConflictException(
        `Cannot reject a request in "${request.status}" status`,
      );
    }
    const now = new Date();
    const reason = (dto.reason ?? '').trim().slice(0, 500);

    await db.videoAccessRequest.update({
      where: { id: request.id },
      data: {
        status: 'REJECTED',
        reviewedAt: now,
        reviewedBy: actor.id,
        rejectionReason: reason || null,
      },
    });

    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: 'ADMIN_VIDEO_ACCESS_REJECT',
      targetType: 'VIDEO_ACCESS_REQUEST',
      targetId: request.id,
      before: { status: 'PENDING' },
      after: { status: 'REJECTED', rejectionReason: reason || null },
      reason: 'رفض طلب فتح الفيديو',
    });

    await this.notifyStudent(request, {
      title: 'تم رفض طلب فتح الفيديو',
      content: reason
        ? `لم تتم الموافقة على طلبك لفتح الفيديو. السبب: ${reason}`
        : 'لم تتم الموافقة على طلبك لفتح الفيديو.',
      requestId: request.id,
      rejected: true,
      rejectionReason: reason || null,
    });

    return { id: request.id, status: 'REJECTED' };
  }

  async revoke(actor: Actor, grantId: string, reason: string | null) {
    const grant = await this.grants.revoke(actor, grantId, reason);
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: 'ADMIN_VIDEO_ACCESS_REVOKE',
      targetType: 'VIDEO_ACCESS_GRANT',
      targetId: grant.id,
      before: { revokedAt: null },
      after: { revokedAt: grant.revokedAt?.toISOString() ?? null },
      reason: 'إلغاء الوصول الممنوح للفيديو',
    });
    return { id: grant.id, status: 'REVOKED' };
  }

  private async notifyStudent(
    request: any,
    payload: {
      title: string;
      content: string;
      requestId: string;
      approved?: boolean;
      rejected?: boolean;
      expiresAt?: Date | null;
      durationLabel?: string;
      rejectionReason?: string | null;
    },
  ) {
    await this.notifications.create(
      request.accountId,
      payload.title,
      payload.content,
      {
        kind: 'VIDEO_ACCESS_REVIEW',
        requestId: payload.requestId,
        lessonId: request.lessonId,
      },
    );

    if (payload.approved) {
      const [student, lesson] = await Promise.all([
        db.studentProfile.findUnique({
          where: { accountId: request.accountId },
          select: { displayName: true },
        }),
        db.lesson.findUnique({
          where: { id: request.lessonId },
          select: { titleAr: true },
        }),
      ]);
      await this.mailer.notifyStudentOfApproval({
        to: request.requestedEmail,
        studentName: student?.displayName || 'طالب',
        lessonTitle: lesson?.titleAr || request.lessonId,
        expiresAt: payload.expiresAt ?? null,
        durationLabel: payload.durationLabel ?? 'حسب الموافقة',
      });
    } else if (payload.rejected) {
      const [student, lesson] = await Promise.all([
        db.studentProfile.findUnique({
          where: { accountId: request.accountId },
          select: { displayName: true },
        }),
        db.lesson.findUnique({
          where: { id: request.lessonId },
          select: { titleAr: true },
        }),
      ]);
      await this.mailer.notifyStudentOfRejection({
        to: request.requestedEmail,
        studentName: student?.displayName || 'طالب',
        lessonTitle: lesson?.titleAr || request.lessonId,
        reason: payload.rejectionReason ?? null,
      });
    }
  }

  private durationLabel(durationType: string): string {
    switch (durationType) {
      case 'SESSION':
        return 'جلسة واحدة (حتى انتهاء الجلسة)';
      case 'ONE_DAY':
        return '24 ساعة';
      case 'THREE_DAYS':
        return '3 أيام';
      case 'SEVEN_DAYS':
        return '7 أيام';
      case 'CUSTOM':
        return 'مدة مخصصة';
      default:
        return durationType;
    }
  }

  private async loadRequest(organizationId: string, requestId: string) {
    const request = await db.videoAccessRequest.findFirst({
      where: { id: requestId, organizationId },
    });
    if (!request) {
      throw new NotFoundException('Video access request not found');
    }
    return request;
  }

  private toInt(value: string): number | null {
    if (!/^\d+$/.test(value)) return null;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
}
