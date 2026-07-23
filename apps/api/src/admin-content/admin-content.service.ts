import { Injectable, NotFoundException } from '@nestjs/common';
import { db } from '@bahrawy/db';

@Injectable()
export class AdminContentService {
  private async getDefaultOrganizationId() {
    const organization = await db.organization.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'asc' },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    return organization.id;
  }

  private async ensureCourseForGrade(gradeId: string) {
    const existing = await db.course.findFirst({
      where: { gradeId, status: { not: 'ARCHIVED' } },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) return existing;

    const grade = await db.grade.findUnique({ where: { id: gradeId } });
    if (!grade) throw new NotFoundException('Grade not found');

    return db.course.create({
      data: {
        organizationId: grade.organizationId,
        gradeId,
        code: `grade-${grade.code || gradeId}`,
        titleAr: grade.nameAr,
        titleEn: grade.nameEn,
        status: 'PUBLISHED',
      },
    });
  }

  private async ensureChapterForGrade(gradeId: string, chapterId?: string) {
    if (chapterId) {
      const chapter = await db.chapter.findUnique({ where: { id: chapterId } });
      if (!chapter) throw new NotFoundException('Chapter not found');
      return chapter;
    }

    const course = await this.ensureCourseForGrade(gradeId);
    const existing = await db.chapter.findFirst({
      where: { courseId: course.id, status: { not: 'ARCHIVED' } },
      orderBy: { sort: 'asc' },
    });
    if (existing) return existing;

    return db.chapter.create({
      data: {
        courseId: course.id,
        titleAr: 'الدروس',
        titleEn: 'Lessons',
        status: 'PUBLISHED',
      },
    });
  }

  async listUnits(gradeId: string) {
    return db.unit.findMany({
      where: { chapter: { course: { gradeId } }, status: { not: 'ARCHIVED' } },
      orderBy: [{ chapter: { sort: 'asc' } }, { sort: 'asc' }],
      include: {
        chapter: { include: { course: true } },
        lessons: { orderBy: { sort: 'asc' } },
        assessments: { include: { questions: true } },
        productEntries: {
          include: {
            product: {
              include: { prices: { where: { status: 'ACTIVE' }, take: 1 } },
            },
          },
        },
      },
    });
  }

  async createUnit(
    gradeId: string,
    data: { titleAr: string; titleEn?: string; chapterId?: string },
  ) {
    const chapter = await this.ensureChapterForGrade(gradeId, data.chapterId);
    const sort = await db.unit.count({ where: { chapterId: chapter.id } });
    return db.unit.create({
      data: {
        chapterId: chapter.id,
        titleAr: data.titleAr,
        titleEn: data.titleEn,
        sort,
        status: 'PUBLISHED',
      },
    });
  }

  async updateUnit(unitId: string, data: any) {
    return db.unit.update({
      where: { id: unitId },
      data: {
        titleAr: data.titleAr,
        titleEn: data.titleEn,
        status: data.status,
        sort: data.sort,
      },
    });
  }

  async archiveUnit(unitId: string) {
    return db.unit.update({
      where: { id: unitId },
      data: { status: 'ARCHIVED' },
    });
  }

  async reorderUnits(gradeId: string, order: string[]) {
    await db.$transaction(
      order.map((id, sort) =>
        db.unit.update({
          where: { id },
          data: { sort },
        }),
      ),
    );
    return this.listUnits(gradeId);
  }

  async listLessons(unitId: string) {
    return db.lesson.findMany({
      where: { unitId },
      orderBy: { sort: 'asc' },
      include: { assessments: true },
    });
  }

  async createLesson(unitId: string, data: any) {
    const sort = await db.lesson.count({ where: { unitId } });
    return db.lesson.create({
      data: {
        unitId,
        titleAr: data.titleAr,
        titleEn: data.titleEn,
        contentType: data.contentType ?? 'VIDEO',
        contentUrl: data.contentUrl,
        attachedPdfUrl: data.attachedPdfUrl,
        homeworkPdfUrl: data.homeworkPdfUrl,
        durationSeconds: Number(data.durationSeconds) || 0,
        sort,
        status: data.status ?? 'PUBLISHED',
      },
    });
  }

  async updateLesson(lessonId: string, data: any) {
    return db.lesson.update({
      where: { id: lessonId },
      data: {
        titleAr: data.titleAr,
        titleEn: data.titleEn,
        contentType: data.contentType,
        contentUrl: data.contentUrl ?? data.storedObjectId,
        attachedPdfUrl: data.attachedPdfUrl,
        homeworkPdfUrl: data.homeworkPdfUrl,
        durationSeconds:
          data.durationSeconds === undefined
            ? undefined
            : Number(data.durationSeconds),
        sort: data.sort,
        status: data.status,
      },
    });
  }

  async deleteLesson(lessonId: string) {
    await db.lesson.delete({ where: { id: lessonId } });
    return { id: lessonId };
  }

  async reorderLessons(unitId: string, order: string[]) {
    await db.$transaction(
      order.map((id, sort) =>
        db.lesson.update({
          where: { id },
          data: { sort },
        }),
      ),
    );
    return this.listLessons(unitId);
  }

  async listBundles(gradeId: string) {
    return db.product.findMany({
      where: {
        type: 'BUNDLE',
        courses: { some: { course: { gradeId } } },
        status: { not: 'ARCHIVED' },
      },
      include: {
        prices: { where: { status: 'ACTIVE' }, take: 1 },
        unitEntries: { include: { unit: true } },
        courses: { include: { course: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createBundle(gradeId: string, data: any) {
    const course = await this.ensureCourseForGrade(gradeId);
    const organizationId =
      course.organizationId || (await this.getDefaultOrganizationId());
    const code = data.code ?? `bundle-${gradeId}-${Date.now()}`;
    return db.product.create({
      data: {
        organizationId,
        code,
        type: 'BUNDLE',
        titleAr: data.titleAr,
        titleEn: data.titleEn,
        descriptionAr: data.descriptionAr,
        coverImageUrl: data.coverImageUrl,
        status: data.status ?? 'ACTIVE',
        prices: {
          create: {
            amount: Number(data.priceAmount ?? data.amount ?? 0),
            currency: 'EGP',
            billingPeriod: 'ONCE',
            status: 'ACTIVE',
          },
        },
        courses: { create: { courseId: course.id } },
      },
      include: { prices: true, courses: true, unitEntries: true },
    });
  }

  async updateBundle(productId: string, data: any) {
    const priceAmount = data.priceAmount ?? data.amount;
    const product = await db.product.update({
      where: { id: productId },
      data: {
        titleAr: data.titleAr,
        titleEn: data.titleEn,
        descriptionAr: data.descriptionAr,
        coverImageUrl: data.coverImageUrl,
        status: data.status,
      },
      include: { prices: { where: { status: 'ACTIVE' }, take: 1 } },
    });
    if (priceAmount !== undefined) {
      const activePrice = product.prices[0];
      if (activePrice) {
        await db.price.update({
          where: { id: activePrice.id },
          data: { amount: Number(priceAmount) },
        });
      } else {
        await db.price.create({
          data: {
            productId,
            amount: Number(priceAmount),
            currency: 'EGP',
            billingPeriod: 'ONCE',
            status: 'ACTIVE',
          },
        });
      }
    }
    return db.product.findUnique({
      where: { id: productId },
      include: { prices: true, unitEntries: true },
    });
  }

  async archiveBundle(productId: string) {
    return db.product.update({
      where: { id: productId },
      data: { status: 'ARCHIVED' },
    });
  }

  async listBundleUnits(productId: string) {
    return db.productUnit.findMany({
      where: { productId },
      include: { unit: { include: { lessons: { orderBy: { sort: 'asc' } } } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async addUnitToBundle(productId: string, unitId: string) {
    return db.productUnit.upsert({
      where: { productId_unitId: { productId, unitId } },
      create: { productId, unitId },
      update: {},
      include: { unit: true },
    });
  }

  async removeUnitFromBundle(productId: string, unitId: string) {
    await db.productUnit.delete({
      where: { productId_unitId: { productId, unitId } },
    });
    return { productId, unitId };
  }

  async createOrUpdateLessonProduct(unitId: string, data: any) {
    const unit = await db.unit.findUnique({
      where: { id: unitId },
      include: {
        chapter: { include: { course: true } },
        productEntries: { include: { product: true } },
      },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    const existing = unit.productEntries.find(
      (entry: any) => entry.product.type === 'LESSON',
    )?.product;
    const priceAmount = Number(data.priceAmount ?? data.amount ?? 0);

    if (existing) {
      await this.updateBundle(existing.id, {
        titleAr: data.titleAr ?? unit.titleAr,
        titleEn: data.titleEn ?? unit.titleEn,
        descriptionAr: data.descriptionAr,
        coverImageUrl: data.coverImageUrl,
        status: data.status ?? existing.status,
        priceAmount,
      });
      return db.product.findUnique({
        where: { id: existing.id },
        include: { prices: true, unitEntries: true },
      });
    }

    return db.product.create({
      data: {
        organizationId: unit.chapter.course.organizationId,
        code: data.code ?? `lesson-${unitId}-${Date.now()}`,
        type: 'LESSON',
        titleAr: data.titleAr ?? unit.titleAr,
        titleEn: data.titleEn ?? unit.titleEn,
        descriptionAr: data.descriptionAr,
        coverImageUrl: data.coverImageUrl,
        status: data.status ?? 'ACTIVE',
        prices: {
          create: {
            amount: priceAmount,
            currency: 'EGP',
            billingPeriod: 'ONCE',
            status: 'ACTIVE',
          },
        },
        unitEntries: { create: { unitId } },
      },
      include: { prices: true, unitEntries: true },
    });
  }

  async createOrUpdateCourseProduct(courseId: string, data: any) {
    const course = await db.course.findUnique({
      where: { id: courseId },
      include: {
        products: {
          include: {
            product: { include: { prices: { where: { status: 'ACTIVE' } } } },
          },
        },
      },
    });
    if (!course) throw new NotFoundException('Course not found');
    const existing = course.products.find(
      (entry: any) => entry.product.type === 'COURSE',
    )?.product;
    const priceAmount = Number(data.priceAmount ?? data.amount ?? 0);

    if (existing) {
      await this.updateBundle(existing.id, {
        titleAr: data.titleAr ?? course.titleAr,
        titleEn: data.titleEn ?? course.titleEn,
        descriptionAr: data.descriptionAr ?? course.descriptionAr,
        coverImageUrl: data.coverImageUrl ?? course.coverImageUrl,
        status: data.status ?? existing.status,
        priceAmount,
      });
      return db.product.findUnique({
        where: { id: existing.id },
        include: { prices: true, courses: true },
      });
    }

    return db.product.create({
      data: {
        organizationId: course.organizationId,
        code: data.code ?? `course-${courseId}-${Date.now()}`,
        type: 'COURSE',
        titleAr: data.titleAr ?? course.titleAr,
        titleEn: data.titleEn ?? course.titleEn,
        descriptionAr: data.descriptionAr ?? course.descriptionAr,
        coverImageUrl: data.coverImageUrl ?? course.coverImageUrl,
        status: data.status ?? 'ACTIVE',
        prices: {
          create: {
            amount: priceAmount,
            currency: 'EGP',
            billingPeriod: 'ONCE',
            status: 'ACTIVE',
          },
        },
        courses: { create: { courseId } },
      },
      include: { prices: true, courses: true },
    });
  }

  async getUnitAssessment(unitId: string) {
    return db.assessment.findFirst({
      where: { unitId },
      include: {
        questions: {
          orderBy: { sort: 'asc' },
          include: { question: true },
        },
      },
    });
  }

  async createUnitAssessment(unitId: string, data: any) {
    const unit = await db.unit.findUnique({
      where: { id: unitId },
      include: {
        chapter: true,
        lessons: { orderBy: { sort: 'asc' }, take: 1 },
      },
    });
    if (!unit) throw new NotFoundException('Unit not found');
    return db.assessment.create({
      data: {
        courseId: unit.chapter.courseId,
        unitId,
        lessonId: data.lessonId ?? unit.lessons[0]?.id,
        titleAr: data.titleAr ?? `واجب ${unit.titleAr}`,
        titleEn: data.titleEn,
        durationMinutes:
          data.durationMinutes === undefined
            ? 30
            : Number(data.durationMinutes),
        passingScore:
          data.passingScore === null || data.passingScore === undefined
            ? null
            : Number(data.passingScore),
        maxAttempts:
          data.maxAttempts === null || data.maxAttempts === undefined
            ? null
            : Number(data.maxAttempts),
        status: data.status ?? 'PUBLISHED',
        type: data.type ?? 'HOMEWORK',
        resultReleaseRule: data.resultReleaseRule ?? 'IMMEDIATE',
      },
    });
  }

  async updateAssessment(assessmentId: string, data: any) {
    return db.assessment.update({
      where: { id: assessmentId },
      data: {
        titleAr: data.titleAr,
        titleEn: data.titleEn,
        durationMinutes:
          data.durationMinutes === undefined
            ? undefined
            : Number(data.durationMinutes),
        passingScore:
          data.passingScore === null
            ? null
            : data.passingScore === undefined
              ? undefined
              : Number(data.passingScore),
        maxAttempts:
          data.maxAttempts === null
            ? null
            : data.maxAttempts === undefined
              ? undefined
              : Number(data.maxAttempts),
        status: data.status,
        type: data.type,
        resultReleaseRule: data.resultReleaseRule,
      },
    });
  }

  async addQuestion(assessmentId: string, data: any) {
    const assessment = await db.assessment.findUnique({
      where: { id: assessmentId },
      include: { course: true, questions: true },
    });
    if (!assessment) throw new NotFoundException('Assessment not found');
    const question = await db.question.create({
      data: {
        organizationId: assessment.course.organizationId,
        gradeId: assessment.course.gradeId,
        titleAr: data.titleAr,
        titleEn: data.titleEn,
        passage: data.passage,
        options: data.options ?? data.choices ?? [],
        correctOptionId: data.correctOptionId,
        explanation: data.explanation,
        points: Number(data.points) || 1,
        tags: data.tags ?? [],
      },
    });
    await db.assessmentQuestion.create({
      data: {
        assessmentId,
        questionId: question.id,
        sort: data.sort ?? assessment.questions.length,
      },
    });
    return question;
  }

  async removeQuestion(assessmentId: string, questionId: string) {
    await db.assessmentQuestion.delete({
      where: { assessmentId_questionId: { assessmentId, questionId } },
    });
    return { assessmentId, questionId };
  }
}
