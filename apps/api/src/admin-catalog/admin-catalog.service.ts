import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { db } from '@bahrawy/db';

@Injectable()
export class AdminCatalogService {
  async listCourses(gradeId?: string) {
    const courses = await db.course.findMany({
      where: gradeId ? { gradeId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    return { data: courses };
  }

  async listGrades() {
    const grades = await db.grade.findMany({
      orderBy: { sort: 'asc' },
    });
    return { data: grades };
  }

  async getCourseById(id: string) {
    const course = await db.course.findUnique({
      where: { id },
      include: {
        products: {
          include: {
            product: {
              include: { prices: { where: { status: 'ACTIVE' }, take: 1 } },
            },
          },
        },
        chapters: {
          orderBy: { sort: 'asc' },
          include: {
            units: {
              orderBy: { sort: 'asc' },
              include: {
                prerequisiteAssessment: {
                  select: { id: true, titleAr: true, type: true },
                },
                lessons: {
                  orderBy: { sort: 'asc' },
                },
              },
            },
          },
        },
      },
    });
    if (!course) throw new NotFoundException('Course not found');
    return { data: course };
  }

  async getCourseWithAssessments(id: string) {
    const course = await db.course.findFirst({
      where: { OR: [{ id }, { gradeId: id }] },
      orderBy: { createdAt: 'desc' },
      include: {
        products: {
          include: {
            product: {
              include: { prices: { where: { status: 'ACTIVE' }, take: 1 } },
            },
          },
        },
        chapters: {
          orderBy: { sort: 'asc' },
          include: {
            units: {
              orderBy: { sort: 'asc' },
              include: {
                prerequisiteAssessment: {
                  select: { id: true, titleAr: true, type: true },
                },
                lessons: {
                  orderBy: { sort: 'asc' },
                },
                assessments: {
                  include: {
                    questions: {
                      include: { question: true },
                      orderBy: { sort: 'asc' },
                    },
                  },
                },
                productEntries: {
                  include: {
                    product: {
                      include: {
                        prices: { where: { status: 'ACTIVE' }, take: 1 },
                      },
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
    const videoLessons = lessonIds.length
      ? await db.videoLesson.findMany({
          where: { lessonId: { in: lessonIds } },
        })
      : [];
    const videoByLessonId = new Map(
      videoLessons.map((video: any) => [video.lessonId, video]),
    );

    const assessments = await db.assessment.findMany({
      where: { courseId: course.id },
      include: {
        questions: {
          include: { question: true },
          orderBy: { sort: 'asc' },
        },
      },
    });
    const assessmentByLessonId = Object.fromEntries(
      assessments
        .filter((assessment: any) => assessment.lessonId)
        .map((assessment: any) => [assessment.lessonId, assessment]),
    );

    return {
      data: {
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
              videoLesson: videoByLessonId.get(lesson.id) ?? null,
            })),
          })),
        })),
        assessmentByLessonId,
      },
    };
  }

  async createCourse(data: {
    code: string;
    titleAr: string;
    titleEn?: string;
    descriptionAr?: string;
    gradeId?: string;
  }) {
    // Basic org ID
    const org = await db.organization.findFirst();
    if (!org) throw new Error('No organization found');

    const course = await db.course.create({
      data: {
        organizationId: org.id,
        code: data.code,
        titleAr: data.titleAr,
        titleEn: data.titleEn,
        descriptionAr: data.descriptionAr,
        gradeId: data.gradeId,
        status: 'PUBLISHED',
      },
    });
    return { data: course, message: 'Course created successfully' };
  }

  async updateCourse(
    id: string,
    data: { titleAr?: string; titleEn?: string; descriptionAr?: string },
  ) {
    const course = await db.course.update({
      where: { id },
      data,
    });
    return { data: course, message: 'Course updated successfully' };
  }

  async publishCourse(id: string) {
    const course = await db.course.update({
      where: { id },
      data: { status: 'PUBLISHED' },
    });

    // Recursively publish chapters, units, and lessons
    await db.chapter.updateMany({
      where: { courseId: id },
      data: { status: 'PUBLISHED' },
    });

    const chapters = await db.chapter.findMany({
      where: { courseId: id },
      select: { id: true },
    });
    const chapterIds = chapters.map((c: any) => c.id);

    if (chapterIds.length > 0) {
      await db.unit.updateMany({
        where: { chapterId: { in: chapterIds } },
        data: { status: 'PUBLISHED' },
      });

      const units = await db.unit.findMany({
        where: { chapterId: { in: chapterIds } },
        select: { id: true },
      });
      const unitIds = units.map((u: any) => u.id);

      if (unitIds.length > 0) {
        await db.lesson.updateMany({
          where: { unitId: { in: unitIds } },
          data: { status: 'PUBLISHED' },
        });
      }
    }

    return { data: course, message: 'Course published' };
  }

  async deleteLesson(id: string) {
    await db.lesson.delete({ where: { id } });
    return { message: 'تم الحذف' };
  }

  // --- Products ---
  async listProducts(organizationId: string) {
    const products = await db.product.findMany({
      where: { organizationId },
      include: { prices: true, courses: { include: { course: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return { data: products };
  }

  async createProduct(organizationId: string, data: any) {
    const product = await db.product.create({
      data: {
        organizationId,
        code: data.code,
        titleAr: data.titleAr,
        titleEn: data.titleEn,
        status: data.status || 'ACTIVE',
        prices: {
          create: data.prices || [],
        },
        courses: {
          create: (data.courseIds || []).map((id: string) => ({
            courseId: id,
          })),
        },
      },
      include: { prices: true, courses: true },
    });
    return { data: product, message: 'تم إنشاء المنتج بنجاح' };
  }

  async archiveCourse(id: string) {
    const course = await db.course.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });
    return { data: course, message: 'Course archived' };
  }

  async addChapter(
    courseId: string,
    data: { titleAr: string; titleEn?: string },
  ) {
    const chapter = await db.chapter.create({
      data: {
        courseId,
        titleAr: data.titleAr,
        titleEn: data.titleEn,
        status: 'PUBLISHED',
      },
    });
    return { data: chapter, message: 'Chapter created' };
  }

  async addUnit(
    chapterId: string,
    data: { titleAr: string; titleEn?: string },
  ) {
    const sort = await db.unit.count({ where: { chapterId } });
    const unit = await db.unit.create({
      data: {
        chapterId,
        titleAr: data.titleAr,
        titleEn: data.titleEn,
        sort,
        status: 'PUBLISHED',
      },
    });
    return { data: unit, message: 'Unit created' };
  }

  async updateUnit(id: string, data: any) {
    if (
      data.prerequisiteAssessmentId !== undefined &&
      data.prerequisiteAssessmentId !== null &&
      data.prerequisiteAssessmentId !== ''
    ) {
      const [unit, assessment] = await Promise.all([
        db.unit.findUnique({
          where: { id },
          include: { chapter: { select: { courseId: true } } },
        }),
        db.assessment.findUnique({
          where: { id: data.prerequisiteAssessmentId },
          include: {
            unit: { include: { chapter: { select: { courseId: true } } } },
            lesson: {
              include: {
                unit: { include: { chapter: { select: { courseId: true } } } },
              },
            },
          },
        }),
      ]);
      if (!unit) throw new NotFoundException('Lesson not found');
      if (!assessment) {
        throw new BadRequestException('Prerequisite assessment not found');
      }

      const assessmentUnit = assessment.unit ?? assessment.lesson?.unit;
      if (
        !assessmentUnit ||
        assessmentUnit.chapter.courseId !== unit.chapter.courseId
      ) {
        throw new BadRequestException(
          'The prerequisite must belong to the same course',
        );
      }

      const chapters = await db.chapter.findMany({
        where: { courseId: unit.chapter.courseId },
        orderBy: { sort: 'asc' },
        include: {
          units: {
            orderBy: { sort: 'asc' },
            select: { id: true },
          },
        },
      });
      const orderedUnitIds = chapters.flatMap((chapter: any) =>
        chapter.units.map((courseUnit: any) => courseUnit.id),
      );
      if (
        orderedUnitIds.indexOf(assessmentUnit.id) < 0 ||
        orderedUnitIds.indexOf(assessmentUnit.id) >= orderedUnitIds.indexOf(id)
      ) {
        throw new BadRequestException(
          'The prerequisite must be an assessment from an earlier lesson',
        );
      }
    }

    const unit = await db.unit.update({
      where: { id },
      data: {
        titleAr: data.titleAr,
        titleEn: data.titleEn,
        status: data.status,
        sort: data.sort,
        prerequisiteAssessmentId:
          data.prerequisiteAssessmentId === ''
            ? null
            : data.prerequisiteAssessmentId,
      },
      include: {
        prerequisiteAssessment: {
          select: { id: true, titleAr: true, type: true },
        },
      },
    });
    return { status: 'SUCCESS', data: unit };
  }

  async addLesson(
    unitId: string,
    data: { titleAr: string; titleEn?: string; contentType: string },
  ) {
    const lesson = await db.lesson.create({
      data: {
        unitId,
        titleAr: data.titleAr,
        titleEn: data.titleEn,
        contentType: data.contentType,
        status: 'PUBLISHED',
      },
    });
    return { data: lesson, message: 'Lesson created' };
  }
}
