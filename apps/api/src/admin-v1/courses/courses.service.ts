import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { db } from '@bahrawy/db';
import type { AdminDeletionImpact } from '@bahrawy/types';
import { AdminAuditService } from '../common/services/audit.service';
import {
  LifecycleMutationDto,
  PermanentDeleteDto,
} from '../common/dto/lifecycle.dto';
import {
  CreateContentNodeDto,
  CreateCourseDto,
  UpdateContentNodeDto,
  UpdateCourseDto,
} from './courses.dto';

@Injectable()
export class AdminV1CoursesService {
  constructor(private readonly audit: AdminAuditService) {}

  async list(
    organizationId: string,
    gradeId?: string,
    status?: string,
    search?: string,
    subjectId?: string,
    termId?: string,
    page = 1,
    pageSize = 24,
  ) {
    const take = Math.min(Math.max(pageSize, 1), 100);
    const currentPage = Math.max(page, 1);
    const skip = (currentPage - 1) * take;
    const normalizedSearch = search?.trim();
    const where = {
      organizationId,
      ...(gradeId ? { gradeId } : {}),
      ...(subjectId ? { subjectId } : {}),
      ...(termId ? { termId } : {}),
      ...(status ? { status: status as never } : {}),
      ...(normalizedSearch
        ? {
            OR: [
              {
                titleAr: {
                  contains: normalizedSearch,
                  mode: 'insensitive' as const,
                },
              },
              {
                titleEn: {
                  contains: normalizedSearch,
                  mode: 'insensitive' as const,
                },
              },
              {
                code: {
                  contains: normalizedSearch,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };
    const [courses, total] = await Promise.all([
      db.course.findMany({
        where,
        skip,
        take,
        orderBy: { updatedAt: 'desc' },
        include: {
          grade: true,
          subject: true,
          term: true,
          _count: { select: { chapters: true, products: true } },
          chapters: {
            select: {
              units: {
                select: {
                  lessons: {
                    select: {
                      id: true,
                      attachedPdfUrl: true,
                      assessments: { select: { id: true } },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      db.course.count({ where }),
    ]);
    const lessonIds = courses.flatMap((course: any) =>
      course.chapters.flatMap((chapter: any) =>
        chapter.units.flatMap((unit: any) =>
          unit.lessons.map((lesson: any) => lesson.id),
        ),
      ),
    );
    const videos = lessonIds.length
      ? await db.videoLesson.findMany({
          where: { lessonId: { in: lessonIds } },
          select: { lessonId: true, provider: true, status: true },
        })
      : [];
    const videoByLesson = new Map(
      videos.map((video: any) => [video.lessonId, video]),
    );

    const items = courses.map((course: any) => {
      const lessons = course.chapters.flatMap((chapter: any) =>
        chapter.units.flatMap((unit: any) => unit.lessons),
      );
      return {
        ...course,
        chapters: undefined,
        readiness: {
          lessons: lessons.length,
          videos: lessons.filter((lesson: any) => videoByLesson.has(lesson.id))
            .length,
          pdfs: lessons.filter((lesson: any) => Boolean(lesson.attachedPdfUrl))
            .length,
          assessments: lessons.filter(
            (lesson: any) => lesson.assessments.length > 0,
          ).length,
        },
      };
    });
    return {
      items,
      meta: {
        page: currentPage,
        pageSize: take,
        total,
        pageCount: Math.max(1, Math.ceil(total / take)),
      },
    };
  }

  async detail(organizationId: string, id: string) {
    const course = await db.course.findFirst({
      where: { id, organizationId },
      include: {
        grade: true,
        subject: true,
        term: true,
        chapters: {
          orderBy: { sort: 'asc' },
          include: {
            units: {
              orderBy: { sort: 'asc' },
              include: {
                prerequisiteAssessment: true,
                assessments: {
                  include: { questions: { include: { question: true } } },
                },
                lessons: {
                  orderBy: { sort: 'asc' },
                  include: {
                    assessments: {
                      include: { questions: { include: { question: true } } },
                    },
                  },
                },
                productEntries: {
                  include: {
                    product: {
                      include: {
                        prices: {
                          where: { status: 'ACTIVE' },
                          orderBy: { createdAt: 'desc' },
                          take: 1,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        products: {
          include: {
            product: {
              include: {
                prices: {
                  where: { status: 'ACTIVE' },
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });
    if (!course) throw new NotFoundException('Course not found');
    const lessonIds = course.chapters.flatMap((chapter: any) =>
      chapter.units.flatMap((unit: any) =>
        unit.lessons.map((lesson: any) => lesson.id),
      ),
    );
    const videos = lessonIds.length
      ? await db.videoLesson.findMany({
          where: { lessonId: { in: lessonIds } },
        })
      : [];
    const videoByLesson = new Map(
      videos.map((video: any) => [video.lessonId, video]),
    );
    return {
      ...course,
      courseProduct:
        course.products
          .map((entry: any) => entry.product)
          .find((product: any) => product.type === 'COURSE') ?? null,
      products: undefined,
      chapters: course.chapters.map((chapter: any) => ({
        ...chapter,
        units: chapter.units.map((unit: any) => ({
          ...unit,
          lessonProduct:
            unit.productEntries
              .map((entry: any) => entry.product)
              .find((product: any) => product.type === 'LESSON') ?? null,
          productEntries: undefined,
          lessons: unit.lessons.map((lesson: any) => ({
            ...lesson,
            videoLesson: videoByLesson.get(lesson.id) ?? null,
          })),
        })),
      })),
    };
  }

  async unitDetail(organizationId: string, id: string) {
    const unit = await db.unit.findFirst({
      where: { id, chapter: { course: { organizationId } } },
      include: {
        chapter: { include: { course: true } },
        prerequisiteAssessment: true,
        lessons: {
          orderBy: { sort: 'asc' },
          include: {
            assessments: {
              include: { questions: { include: { question: true } } },
            },
          },
        },
        assessments: {
          include: { questions: { include: { question: true } } },
        },
        productEntries: {
          include: {
            product: {
              include: {
                prices: {
                  where: { status: 'ACTIVE' },
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    const lessonIds = unit.lessons.map((lesson: any) => lesson.id);
    const videos = lessonIds.length
      ? await db.videoLesson.findMany({
          where: { lessonId: { in: lessonIds } },
        })
      : [];
    const videoByLesson = new Map(
      videos.map((video: any) => [video.lessonId, video]),
    );
    return {
      ...unit,
      lessonProduct:
        unit.productEntries
          .map((entry: any) => entry.product)
          .find((product: any) => product.type === 'LESSON') ?? null,
      productEntries: undefined,
      lessons: unit.lessons.map((lesson: any) => ({
        ...lesson,
        videoLesson: videoByLesson.get(lesson.id) ?? null,
      })),
    };
  }

  async lessonDetail(organizationId: string, id: string) {
    const lesson = await db.lesson.findFirst({
      where: { id, unit: { chapter: { course: { organizationId } } } },
      include: {
        unit: { include: { chapter: { include: { course: true } } } },
        assessments: {
          include: { questions: { include: { question: true } } },
        },
      },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
    const videoLesson = await db.videoLesson.findUnique({
      where: { lessonId: id },
    });
    return { ...lesson, videoLesson };
  }

  async create(
    actor: { id: string; organizationId: string },
    input: CreateCourseDto,
  ) {
    await this.validateReferences(actor.organizationId, input);
    const created = await db.course.create({
      data: { organizationId: actor.organizationId, ...input, status: 'DRAFT' },
    });
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: 'COURSE_CREATED',
      targetType: 'COURSE',
      targetId: created.id,
      after: created,
    });
    return created;
  }

  async update(
    actor: { id: string; organizationId: string },
    id: string,
    input: UpdateCourseDto,
  ) {
    const existing = await db.course.findFirst({
      where: { id, organizationId: actor.organizationId },
    });
    if (!existing) throw new NotFoundException('Course not found');
    if (existing.version !== input.version)
      this.versionConflict(existing.version);
    await this.validateReferences(actor.organizationId, input);
    const { version, publishAt, unpublishAt, ...data } = input;
    void version;
    const updated = await db.course.update({
      where: { id },
      data: {
        ...data,
        publishAt: publishAt
          ? new Date(publishAt)
          : publishAt === '' || publishAt === null
            ? null
            : undefined,
        unpublishAt: unpublishAt
          ? new Date(unpublishAt)
          : unpublishAt === '' || unpublishAt === null
            ? null
            : undefined,
        archivedAt:
          input.status === 'ARCHIVED'
            ? new Date()
            : input.status
              ? null
              : undefined,
        version: { increment: 1 },
      },
    });
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: 'COURSE_UPDATED',
      targetType: 'COURSE',
      targetId: id,
      before: existing,
      after: updated,
    });
    return updated;
  }

  async createNode(
    actor: { id: string; organizationId: string },
    parentType: 'course' | 'chapter' | 'unit',
    parentId: string,
    input: CreateContentNodeDto,
  ) {
    let created: unknown;
    if (parentType === 'course') {
      await this.assertCourse(actor.organizationId, parentId);
      const sort = await db.chapter.count({ where: { courseId: parentId } });
      created = await db.chapter.create({
        data: { courseId: parentId, ...input, sort, status: 'DRAFT' },
      });
    } else if (parentType === 'chapter') {
      await this.assertChapter(actor.organizationId, parentId);
      const sort = await db.unit.count({ where: { chapterId: parentId } });
      created = await db.unit.create({
        data: {
          chapterId: parentId,
          titleAr: input.titleAr,
          titleEn: input.titleEn,
          sort,
          status: 'DRAFT',
        },
      });
    } else {
      await this.assertUnit(actor.organizationId, parentId);
      const sort = await db.lesson.count({ where: { unitId: parentId } });
      created = await db.lesson.create({
        data: {
          unitId: parentId,
          titleAr: input.titleAr,
          titleEn: input.titleEn,
          contentType: input.contentType ?? 'VIDEO',
          sort,
          status: 'DRAFT',
        },
      });
    }
    const record = created as { id: string };
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: `${parentType.toUpperCase()}_CHILD_CREATED`,
      targetType:
        parentType === 'course'
          ? 'CHAPTER'
          : parentType === 'chapter'
            ? 'UNIT'
            : 'LESSON',
      targetId: record.id,
      after: created,
    });
    return created;
  }

  async updateNode(
    actor: { id: string; organizationId: string },
    nodeType: 'chapter' | 'unit' | 'lesson',
    id: string,
    input: UpdateContentNodeDto,
  ) {
    const existing =
      nodeType === 'chapter'
        ? await this.assertChapter(actor.organizationId, id)
        : nodeType === 'unit'
          ? await this.assertUnit(actor.organizationId, id)
          : await this.assertLesson(actor.organizationId, id);
    if (existing.version !== input.version)
      this.versionConflict(existing.version);
    if (
      nodeType === 'unit' &&
      input.prerequisiteAssessmentId !== undefined &&
      input.prerequisiteAssessmentId !== null &&
      input.prerequisiteAssessmentId !== ''
    ) {
      const assessment = await db.assessment.findFirst({
        where: {
          id: input.prerequisiteAssessmentId,
          course: { organizationId: actor.organizationId },
        },
        include: {
          unit: { include: { chapter: true } },
          lesson: { include: { unit: { include: { chapter: true } } } },
        },
      });
      const sourceUnit = assessment?.unit ?? assessment?.lesson?.unit;
      const targetUnit = await db.unit.findUnique({
        where: { id },
        include: { chapter: true },
      });
      if (
        !assessment ||
        !sourceUnit ||
        !targetUnit ||
        sourceUnit.chapter.courseId !== targetUnit.chapter.courseId
      ) {
        throw new BadRequestException(
          'Prerequisite assessment must belong to the same course',
        );
      }
    }
    const { version, publishAt, unpublishAt, ...data } = input;
    void version;
    const lifecycle = {
      publishAt: publishAt
        ? new Date(publishAt)
        : publishAt === '' || publishAt === null
          ? null
          : undefined,
      unpublishAt: unpublishAt
        ? new Date(unpublishAt)
        : unpublishAt === '' || unpublishAt === null
          ? null
          : undefined,
      archivedAt:
        input.status === 'ARCHIVED'
          ? new Date()
          : input.status
            ? null
            : undefined,
      version: { increment: 1 },
    };
    let updated: unknown;
    if (nodeType === 'chapter') {
      updated = await db.chapter.update({
        where: { id },
        data: { ...data, ...lifecycle },
      });
    } else if (nodeType === 'unit') {
      updated = await db.unit.update({
        where: { id },
        data: {
          ...data,
          ...lifecycle,
          prerequisiteAssessmentId:
            input.prerequisiteAssessmentId === ''
              ? null
              : input.prerequisiteAssessmentId,
        },
      });
    } else {
      updated = await db.lesson.update({
        where: { id },
        data: { ...data, ...lifecycle },
      });
    }
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: `${nodeType.toUpperCase()}_UPDATED`,
      targetType: nodeType.toUpperCase(),
      targetId: id,
      before: existing,
      after: updated,
    });
    return updated;
  }

  async reorder(
    actor: { id: string; organizationId: string },
    nodeType: 'chapter' | 'unit' | 'lesson',
    parentId: string,
    ids: string[],
  ) {
    const records =
      nodeType === 'chapter'
        ? await db.chapter.findMany({
            where: {
              courseId: parentId,
              id: { in: ids },
              course: { organizationId: actor.organizationId },
            },
          })
        : nodeType === 'unit'
          ? await db.unit.findMany({
              where: {
                chapterId: parentId,
                id: { in: ids },
                chapter: { course: { organizationId: actor.organizationId } },
              },
            })
          : await db.lesson.findMany({
              where: {
                unitId: parentId,
                id: { in: ids },
                unit: {
                  chapter: { course: { organizationId: actor.organizationId } },
                },
              },
            });
    if (records.length !== ids.length) {
      throw new BadRequestException('Invalid content ordering');
    }
    await db.$transaction(
      ids.map((id, sort) => {
        const data = { sort, version: { increment: 1 } };
        if (nodeType === 'chapter') {
          return db.chapter.update({ where: { id }, data });
        }
        if (nodeType === 'unit') {
          return db.unit.update({ where: { id }, data });
        }
        return db.lesson.update({ where: { id }, data });
      }),
    );
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: `${nodeType.toUpperCase()}_REORDERED`,
      targetType: nodeType.toUpperCase(),
      targetId: parentId,
      after: { ids },
    });
    return { ids };
  }

  async updateLessonLifecycle(
    actor: { id: string; organizationId: string },
    unitId: string,
    status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
    version: number,
  ) {
    const unit = await db.unit.findFirst({
      where: {
        id: unitId,
        chapter: { course: { organizationId: actor.organizationId } },
      },
      include: { chapter: true },
    });
    if (!unit) throw new NotFoundException('Lesson not found');
    if (unit.version !== version) this.versionConflict(unit.version);

    const archivedAt = status === 'ARCHIVED' ? new Date() : null;
    const updated = await db.$transaction(async (tx: any) => {
      if (status === 'PUBLISHED' && unit.chapter.status !== 'PUBLISHED') {
        await tx.chapter.update({
          where: { id: unit.chapterId },
          data: {
            status: 'PUBLISHED',
            archivedAt: null,
            version: { increment: 1 },
          },
        });
      }
      await tx.lesson.updateMany({
        where: { unitId },
        data: { status, archivedAt, version: { increment: 1 } },
      });
      return tx.unit.update({
        where: { id: unitId },
        data: {
          status,
          archivedAt,
          version: { increment: 1 },
        },
      });
    });
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: `UNIT_${status}`,
      targetType: 'UNIT',
      targetId: unitId,
      before: unit,
      after: updated,
    });
    return updated;
  }

  async deletionImpact(
    organizationId: string,
    id: string,
  ): Promise<AdminDeletionImpact> {
    const course = await db.course.findFirst({
      where: { id, organizationId },
      include: {
        chapters: {
          include: {
            units: { include: { lessons: { select: { id: true } } } },
          },
        },
        products: { select: { productId: true } },
        _count: {
          select: {
            assessments: true,
            prerequisites: true,
            prerequisiteFor: true,
          },
        },
      },
    });
    if (!course) throw new NotFoundException('Course not found');
    const lessonIds = course.chapters.flatMap((chapter: any) =>
      chapter.units.flatMap((unit: any) =>
        unit.lessons.map((lesson: any) => lesson.id),
      ),
    );
    const productIds = course.products.map((entry: any) => entry.productId);
    const [attempts, progress, entitlements, payments] = await Promise.all([
      db.assessmentAttempt.count({
        where: { assessment: { courseId: id } },
      }),
      lessonIds.length
        ? db.lessonProgress.count({ where: { lessonId: { in: lessonIds } } })
        : 0,
      productIds.length
        ? db.entitlement.count({ where: { productId: { in: productIds } } })
        : 0,
      productIds.length
        ? db.paymentOrder.count({ where: { productId: { in: productIds } } })
        : 0,
    ]);
    const blockers = [
      {
        code: 'ASSESSMENT_ATTEMPTS',
        label: 'محاولات اختبارات محفوظة',
        count: attempts,
      },
      { code: 'LESSON_PROGRESS', label: 'تقدم طلاب محفوظ', count: progress },
      {
        code: 'ENTITLEMENTS',
        label: 'صلاحيات وصول للطلاب',
        count: entitlements,
      },
      { code: 'PAYMENTS', label: 'طلبات دفع مرتبطة', count: payments },
      {
        code: 'PREREQUISITES',
        label: 'متطلبات أكاديمية مرتبطة',
        count: course._count.prerequisites + course._count.prerequisiteFor,
      },
      {
        code: 'PRODUCT_MEMBERSHIPS',
        label: 'منتجات أو باقات مرتبطة بالكورس',
        count: productIds.length,
      },
    ].filter((item) => item.count > 0);
    const canPermanentlyDelete = blockers.length === 0;
    const chapterCount = course.chapters.length;
    const unitCount = course.chapters.reduce(
      (total: number, chapter: any) => total + chapter.units.length,
      0,
    );
    return {
      id: course.id,
      resource: 'course',
      label: course.titleAr,
      currentStatus: course.status,
      actions: [
        course.status === 'ARCHIVED' ? 'RESTORE' : 'ARCHIVE',
        ...(canPermanentlyDelete ? (['PERMANENT_DELETE'] as const) : []),
      ],
      blockers,
      affectedChildren: [
        { type: 'chapter', label: 'فصول', count: chapterCount },
        { type: 'unit', label: 'وحدات', count: unitCount },
        { type: 'lesson', label: 'دروس', count: lessonIds.length },
        {
          type: 'assessment',
          label: 'اختبارات',
          count: course._count.assessments,
        },
      ].filter((item) => item.count > 0),
      requiresReason: true,
      requiresTypedConfirmation: canPermanentlyDelete,
    };
  }

  async setArchived(
    actor: { id: string; organizationId: string },
    id: string,
    archived: boolean,
    input: LifecycleMutationDto,
  ) {
    const course = await this.assertCourse(actor.organizationId, id);
    if (course.version !== input.version) this.versionConflict(course.version);
    const updated = await db.course.update({
      where: { id },
      data: {
        status: archived ? 'ARCHIVED' : 'DRAFT',
        archivedAt: archived ? new Date() : null,
        version: { increment: 1 },
      },
    });
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: archived ? 'COURSE_ARCHIVED' : 'COURSE_RESTORED',
      targetType: 'COURSE',
      targetId: id,
      before: course,
      after: updated,
      reason: input.reason,
    });
    return updated;
  }

  async permanentlyDelete(
    actor: { id: string; organizationId: string },
    id: string,
    input: PermanentDeleteDto,
  ) {
    const course = await this.assertCourse(actor.organizationId, id);
    if (course.version !== input.version) this.versionConflict(course.version);
    if (![course.titleAr, course.code].includes(input.confirmation.trim())) {
      throw new BadRequestException('Confirmation does not match the course');
    }
    const impact = await this.deletionImpact(actor.organizationId, id);
    if (!impact.actions.includes('PERMANENT_DELETE')) {
      throw new ForbiddenException({
        code: 'DELETE_BLOCKED',
        message: 'This course has historical or dependent records',
        blockers: impact.blockers,
      });
    }
    await db.course.delete({ where: { id } });
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: 'COURSE_PERMANENTLY_DELETED',
      targetType: 'COURSE',
      targetId: id,
      before: course,
      reason: input.reason,
    });
    return { id };
  }

  private async validateReferences(
    organizationId: string,
    input: Partial<CreateCourseDto>,
  ) {
    if (input.gradeId) {
      const grade = await db.grade.findFirst({
        where: { id: input.gradeId, organizationId },
      });
      if (!grade) throw new BadRequestException('Grade is invalid');
    }
    if (input.subjectId) {
      const subject = await db.subject.findFirst({
        where: { id: input.subjectId, organizationId },
      });
      if (!subject) throw new BadRequestException('Subject is invalid');
    }
    if (input.termId) {
      const term = await db.term.findFirst({
        where: { id: input.termId, cohort: { organizationId } },
        include: { cohort: true },
      });
      if (!term || (input.gradeId && term.cohort.gradeId !== input.gradeId)) {
        throw new BadRequestException('Term is invalid for this grade');
      }
    }
  }

  private async assertCourse(organizationId: string, id: string) {
    const record = await db.course.findFirst({ where: { id, organizationId } });
    if (!record) throw new NotFoundException('Course not found');
    return record;
  }

  private async assertChapter(organizationId: string, id: string) {
    const record = await db.chapter.findFirst({
      where: { id, course: { organizationId } },
    });
    if (!record) throw new NotFoundException('Chapter not found');
    return record;
  }

  private async assertUnit(organizationId: string, id: string) {
    const record = await db.unit.findFirst({
      where: { id, chapter: { course: { organizationId } } },
    });
    if (!record) throw new NotFoundException('Unit not found');
    return record;
  }

  private async assertLesson(organizationId: string, id: string) {
    const record = await db.lesson.findFirst({
      where: { id, unit: { chapter: { course: { organizationId } } } },
    });
    if (!record) throw new NotFoundException('Lesson not found');
    return record;
  }

  private versionConflict(currentVersion: number): never {
    throw new ConflictException({
      code: 'VERSION_CONFLICT',
      message: 'This record was changed by another staff member',
      conflict: { currentVersion },
    });
  }
}
