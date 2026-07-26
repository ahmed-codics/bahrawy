import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { db } from '@bahrawy/db';
import {
  CreateContentNodeDto,
  CreateCourseDto,
  UpdateContentNodeDto,
  UpdateCourseDto,
} from './courses.dto';

@Injectable()
export class AdminV1CoursesService {
  async list(organizationId: string, gradeId?: string, status?: string) {
    const courses = await db.course.findMany({
      where: {
        organizationId,
        ...(gradeId ? { gradeId } : {}),
        ...(status ? { status: status as never } : {}),
      },
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
    });
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

    return courses.map((course: any) => {
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
      chapters: course.chapters.map((chapter: any) => ({
        ...chapter,
        units: chapter.units.map((unit: any) => ({
          ...unit,
          lessons: unit.lessons.map((lesson: any) => ({
            ...lesson,
            videoLesson: videoByLesson.get(lesson.id) ?? null,
          })),
        })),
      })),
    };
  }

  async create(organizationId: string, input: CreateCourseDto) {
    await this.validateReferences(organizationId, input);
    return db.course.create({
      data: { organizationId, ...input, status: 'DRAFT' },
    });
  }

  async update(organizationId: string, id: string, input: UpdateCourseDto) {
    const existing = await db.course.findFirst({
      where: { id, organizationId },
    });
    if (!existing) throw new NotFoundException('Course not found');
    if (existing.version !== input.version) this.versionConflict();
    await this.validateReferences(organizationId, input);
    const { version, publishAt, unpublishAt, ...data } = input;
    return db.course.update({
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
  }

  async createNode(
    organizationId: string,
    parentType: 'course' | 'chapter' | 'unit',
    parentId: string,
    input: CreateContentNodeDto,
  ) {
    if (parentType === 'course') {
      await this.assertCourse(organizationId, parentId);
      const sort = await db.chapter.count({ where: { courseId: parentId } });
      return db.chapter.create({
        data: { courseId: parentId, ...input, sort, status: 'DRAFT' },
      });
    }
    if (parentType === 'chapter') {
      await this.assertChapter(organizationId, parentId);
      const sort = await db.unit.count({ where: { chapterId: parentId } });
      return db.unit.create({
        data: {
          chapterId: parentId,
          titleAr: input.titleAr,
          titleEn: input.titleEn,
          sort,
          status: 'DRAFT',
        },
      });
    }
    await this.assertUnit(organizationId, parentId);
    const sort = await db.lesson.count({ where: { unitId: parentId } });
    return db.lesson.create({
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

  async updateNode(
    organizationId: string,
    nodeType: 'chapter' | 'unit' | 'lesson',
    id: string,
    input: UpdateContentNodeDto,
  ) {
    const existing =
      nodeType === 'chapter'
        ? await this.assertChapter(organizationId, id)
        : nodeType === 'unit'
          ? await this.assertUnit(organizationId, id)
          : await this.assertLesson(organizationId, id);
    if (existing.version !== input.version) this.versionConflict();
    if (
      nodeType === 'unit' &&
      input.prerequisiteAssessmentId !== undefined &&
      input.prerequisiteAssessmentId !== null &&
      input.prerequisiteAssessmentId !== ''
    ) {
      const assessment = await db.assessment.findFirst({
        where: {
          id: input.prerequisiteAssessmentId,
          course: { organizationId },
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
    if (nodeType === 'chapter') {
      return db.chapter.update({
        where: { id },
        data: { ...data, ...lifecycle },
      });
    }
    if (nodeType === 'unit') {
      return db.unit.update({
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
    }
    return db.lesson.update({
      where: { id },
      data: { ...data, ...lifecycle },
    });
  }

  async reorder(
    organizationId: string,
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
              course: { organizationId },
            },
          })
        : nodeType === 'unit'
          ? await db.unit.findMany({
              where: {
                chapterId: parentId,
                id: { in: ids },
                chapter: { course: { organizationId } },
              },
            })
          : await db.lesson.findMany({
              where: {
                unitId: parentId,
                id: { in: ids },
                unit: { chapter: { course: { organizationId } } },
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
    return { ids };
  }

  async updateLessonLifecycle(
    organizationId: string,
    unitId: string,
    status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED',
    version: number,
  ) {
    const unit = await db.unit.findFirst({
      where: { id: unitId, chapter: { course: { organizationId } } },
      include: { chapter: true },
    });
    if (!unit) throw new NotFoundException('Lesson not found');
    if (unit.version !== version) this.versionConflict();

    const archivedAt = status === 'ARCHIVED' ? new Date() : null;
    return db.$transaction(async (tx: any) => {
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

  private versionConflict(): never {
    throw new ConflictException({
      code: 'VERSION_CONFLICT',
      message: 'This record was changed by another staff member',
    });
  }
}
