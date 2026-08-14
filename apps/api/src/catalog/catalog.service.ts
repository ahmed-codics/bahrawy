import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { db } from '@bahrawy/db';

@Injectable()
export class CatalogService {
  // Public (unauthenticated) catalog endpoints resolve a single primary
  // organization and scope every query to it, so no tenant can ever enumerate
  // or access another tenant's published courses, products, or lesson IDs.
  private async getPrimaryOrganizationId(): Promise<string | null> {
    const org = await db.organization.findFirst({ select: { id: true } });
    return org?.id ?? null;
  }

  async hasEntitlementToProduct(
    accountId: string,
    productId: string,
  ): Promise<boolean> {
    const now = new Date();
    const entitlement = await db.entitlement.findFirst({
      where: {
        accountId,
        productId,
        status: { in: ['ACTIVE', 'PUBLISHED'] },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });
    if (entitlement) return true;
    const freeProduct = await db.product.findFirst({
      where: {
        id: productId,
        status: { in: ['ACTIVE', 'PUBLISHED'] },
        prices: { some: { status: 'ACTIVE', amount: 0 } },
      },
      select: { id: true },
    });
    return !!freeProduct;
  }

  async getOrganizationSettings() {
    const org = await db.organization.findFirst({
      select: {
        name: true,
        currency: true,
        paymentInstapay: true,
        paymentWallet: true,
      },
    });
    return org || {};
  }

  async hasEntitlementToCourse(
    accountId: string,
    courseId: string,
  ): Promise<boolean> {
    const productCourses = await db.productCourse.findMany({
      where: { courseId },
      select: { productId: true },
    });
    const productIds = productCourses.map(
      (pc: { productId: string }) => pc.productId,
    );
    if (productIds.length === 0) {
      return false;
    }
    const now = new Date();
    const activeEntitlement = await db.entitlement.findFirst({
      where: {
        accountId,
        productId: { in: productIds },
        status: 'ACTIVE',
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
    });
    if (activeEntitlement) return true;
    const freeProduct = await db.product.findFirst({
      where: {
        id: { in: productIds },
        status: { in: ['ACTIVE', 'PUBLISHED'] },
        prices: { some: { status: 'ACTIVE', amount: 0 } },
      },
      select: { id: true },
    });
    return !!freeProduct;
  }

  async getUnitAccess(accountId: string, unitId: string, isStaff = false) {
    if (isStaff) {
      return { hasAccess: true, reason: 'STAFF' as const };
    }

    const unit = await db.unit.findUnique({
      where: { id: unitId },
      include: {
        chapter: {
          include: {
            course: { select: { id: true, organizationId: true } },
          },
        },
        prerequisiteAssessment: {
          select: {
            id: true,
            titleAr: true,
            type: true,
            passingScore: true,
          },
        },
      },
    });
    if (!unit) {
      throw new NotFoundException('Unit not found');
    }

    const courseId = unit.chapter.courseId;
    const organizationId = unit.chapter.course.organizationId;

    const now = new Date();
    const entitlement = await db.entitlement.findFirst({
      where: {
        accountId,
        status: 'ACTIVE',
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        product: {
          organizationId,
          OR: [
            {
              type: 'BUNDLE',
              courses: { some: { courseId } },
            },
            {
              type: 'COURSE',
              courses: { some: { courseId } },
            },
            {
              type: 'LESSON',
              unitEntries: { some: { unitId } },
            },
          ],
        },
      },
      include: { product: true },
    });

    if (!entitlement) {
      const freeProduct = await db.product.findFirst({
        where: {
          organizationId,
          status: { in: ['ACTIVE', 'PUBLISHED'] },
          prices: { some: { status: 'ACTIVE', amount: 0 } },
          OR: [
            {
              type: 'BUNDLE',
              courses: { some: { courseId } },
            },
            {
              type: 'COURSE',
              courses: { some: { courseId } },
            },
            { type: 'LESSON', unitEntries: { some: { unitId } } },
          ],
        },
        select: { id: true, type: true },
      });
      if (freeProduct) {
        return {
          hasAccess: true,
          hasEntitlement: true,
          reason:
            freeProduct.type === 'LESSON'
              ? ('LESSON' as const)
              : freeProduct.type === 'COURSE'
                ? ('COURSE' as const)
                : ('BUNDLE' as const),
          productId: freeProduct.id,
        };
      }
      return { hasAccess: false, reason: 'NONE' as const };
    }

    if (unit.prerequisiteAssessment) {
      const submittedAttempt = await db.assessmentAttempt.findFirst({
        where: {
          accountId,
          assessmentId: unit.prerequisiteAssessment.id,
          submittedAt: { not: null },
          score:
            unit.prerequisiteAssessment.passingScore === null
              ? undefined
              : { gte: unit.prerequisiteAssessment.passingScore },
        },
        select: { id: true },
      });
      if (!submittedAttempt) {
        return {
          hasAccess: false,
          hasEntitlement: true,
          reason: 'PREREQUISITE' as const,
          prerequisite: unit.prerequisiteAssessment,
          productId: entitlement.productId,
        };
      }
    }

    return {
      hasAccess: true,
      hasEntitlement: true,
      reason:
        entitlement.product.type === 'LESSON'
          ? ('LESSON' as const)
          : entitlement.product.type === 'COURSE'
            ? ('COURSE' as const)
            : ('BUNDLE' as const),
      productId: entitlement.productId,
    };
  }

  async arePrerequisitesSatisfied(
    accountId: string,
    courseId: string,
  ): Promise<boolean> {
    const prerequisites = await db.coursePrerequisite.findMany({
      where: { courseId },
      select: { prerequisiteCourseId: true },
    });
    if (prerequisites.length === 0) {
      return true;
    }
    for (const prereq of prerequisites) {
      const isCompleted = await this.isCourseCompleted(
        accountId,
        prereq.prerequisiteCourseId,
      );
      if (!isCompleted) {
        return false;
      }
    }
    return true;
  }

  async isCourseCompleted(
    accountId: string,
    courseId: string,
  ): Promise<boolean> {
    const lessons = await db.lesson.findMany({
      where: {
        unit: {
          chapter: {
            courseId,
          },
        },
        status: 'PUBLISHED',
      },
      select: { id: true },
    });
    if (lessons.length === 0) {
      return true;
    }
    const completedCount = await db.lessonProgress.count({
      where: {
        accountId,
        lessonId: { in: lessons.map((l: { id: string }) => l.id) },
        completedAt: { not: null },
      },
    });
    return completedCount === lessons.length;
  }

  async canAccessLesson(
    accountId: string,
    lessonId: string,
    isStaff = false,
  ): Promise<boolean> {
    if (isStaff) {
      return true;
    }
    const lesson = await db.lesson.findUnique({
      where: { id: lessonId },
      include: {
        unit: {
          include: {
            chapter: {
              select: { courseId: true },
            },
          },
        },
      },
    });
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }
    if (lesson.status !== 'PUBLISHED') {
      throw new ForbiddenException('Lesson is not published');
    }
    const courseId = lesson.unit.chapter.courseId;
    const unitAccess = await this.getUnitAccess(accountId, lesson.unitId);
    if (!unitAccess.hasAccess) {
      if (unitAccess.reason === 'PREREQUISITE') {
        throw new ForbiddenException({
          code: 'LESSON_PREREQUISITE_NOT_MET',
          message: 'Complete the required homework or quiz first.',
          prerequisite: unitAccess.prerequisite,
        });
      }
      throw new ForbiddenException({
        code: 'MISSING_ENTITLEMENT',
        message: 'You do not own this course or your subscription has expired.',
      });
    }
    const prereqsSatisfied = await this.arePrerequisitesSatisfied(
      accountId,
      courseId,
    );
    if (!prereqsSatisfied) {
      throw new ForbiddenException({
        code: 'PREREQUISITES_NOT_MET',
        message: 'Course prerequisites have not been met.',
      });
    }
    await this.enforceLessonQuizGates(accountId, lesson, courseId);
    return true;
  }

  private async getCourseOrderedLessons(courseId: string) {
    const chapters = await db.chapter.findMany({
      where: { courseId, status: 'PUBLISHED' },
      orderBy: { sort: 'asc' },
      select: {
        units: {
          where: { status: 'PUBLISHED' },
          orderBy: { sort: 'asc' },
          select: {
            lessons: {
              where: { status: 'PUBLISHED' },
              orderBy: { sort: 'asc' },
              select: {
                id: true,
                unitId: true,
                sort: true,
                titleAr: true,
                requiresPreviousLessonPass: true,
              },
            },
          },
        },
      },
    });
    return chapters.flatMap((chapter: any) =>
      chapter.units.flatMap((unit: any) => unit.lessons),
    );
  }

  private async enforceLessonQuizGates(
    accountId: string,
    lesson: {
      id: string;
      unitId: string;
      sort: number;
      requiresPreviousLessonPass?: boolean;
    },
    courseId: string,
  ): Promise<void> {
    if (!lesson.requiresPreviousLessonPass) return;
    const orderedLessons = await this.getCourseOrderedLessons(courseId);
    const currentIndex = orderedLessons.findIndex(
      (item: any) => item.id === lesson.id,
    );
    if (currentIndex <= 0) return;
    const previousLesson = orderedLessons[currentIndex - 1];
    const gate = await this.findPassableLessonQuiz(previousLesson.id);
    if (!gate) return;
    const passed = await this.isQuizGatePassed(accountId, gate);
    if (!passed) {
      throw new ForbiddenException({
        code: 'LESSON_LOCKED',
        message: 'Pass the previous lesson exam before continuing.',
        requiredAssessmentId: gate.id,
        requiredScore: gate.passingScore,
        lessonId: lesson.id,
      });
    }
  }

  private async findPassableLessonQuiz(lessonId: string) {
    return db.assessment.findFirst({
      where: {
        lessonId,
        status: 'PUBLISHED',
        archivedAt: null,
        passingScore: { not: null },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async computeLessonLocks(accountId: string, courseId: string) {
    const ordered = await this.getCourseOrderedLessons(courseId);
    if (ordered.length === 0) return new Map<string, any>();
    const lessonIds = ordered.map((item: any) => item.id);
    const gates = await db.assessment.findMany({
      where: {
        lessonId: { in: lessonIds },
        status: 'PUBLISHED',
        archivedAt: null,
        passingScore: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, lessonId: true, passingScore: true },
    });
    const gateByLesson = new Map<string, any>();
    for (const gate of gates) {
      if (gate.lessonId) gateByLesson.set(gate.lessonId, gate);
    }
    const gateIds = [...new Set(gates.map((gate: any) => gate.id))];
    const attempts = gateIds.length
      ? await db.assessmentAttempt.findMany({
          where: {
            accountId,
            assessmentId: { in: gateIds },
            submittedAt: { not: null },
          },
          orderBy: { submittedAt: 'desc' },
          select: { assessmentId: true, score: true },
        })
      : [];
    const bestScore = new Map<string, number>();
    for (const attempt of attempts) {
      const score = attempt.score === null ? -1 : Number(attempt.score);
      const current = bestScore.get(attempt.assessmentId) ?? -1;
      if (score > current) bestScore.set(attempt.assessmentId, score);
    }
    const gatePassed = (gate: any) =>
      gate.passingScore === null ||
      (bestScore.get(gate.id) ?? -1) >= Number(gate.passingScore);

    const locks = new Map<string, any>();
    for (let index = 0; index < ordered.length; index += 1) {
      const lesson = ordered[index];
      if (!lesson.requiresPreviousLessonPass || index === 0) {
        locks.set(lesson.id, { locked: false });
        continue;
      }
      const previousGate = gateByLesson.get(ordered[index - 1].id);
      if (!previousGate) {
        locks.set(lesson.id, { locked: false });
        continue;
      }
      if (gatePassed(previousGate)) {
        locks.set(lesson.id, { locked: false });
      } else {
        locks.set(lesson.id, {
          locked: true,
          requiredAssessmentId: previousGate.id,
          requiredScore: previousGate.passingScore,
        });
      }
    }
    return locks;
  }

  private async isQuizGatePassed(
    accountId: string,
    gate: { id: string; passingScore: number | null },
  ): Promise<boolean> {
    if (!gate || gate.passingScore === null) return true;
    const passedAttempt = await db.assessmentAttempt.findFirst({
      where: {
        accountId,
        assessmentId: gate.id,
        submittedAt: { not: null },
        score: { gte: gate.passingScore },
      },
      select: { id: true },
    });
    return Boolean(passedAttempt);
  }

  async getGrades(): Promise<any[]> {
    const organizationId = await this.getPrimaryOrganizationId();
    if (!organizationId) return [];
    return db.grade.findMany({
      where: { organizationId },
      orderBy: { sort: 'asc' },
    });
  }

  async fixDrafts() {
    await db.course.updateMany({ data: { status: 'PUBLISHED' } });
    await db.chapter.updateMany({ data: { status: 'PUBLISHED' } });
    await db.unit.updateMany({ data: { status: 'PUBLISHED' } });
    await db.lesson.updateMany({ data: { status: 'PUBLISHED' } });
    return { status: 'SUCCESS', message: 'All fixed' };
  }

  async getPublicProducts(gradeId?: string): Promise<any[]> {
    const organizationId = await this.getPrimaryOrganizationId();
    if (!organizationId) return [];
    return db.product.findMany({
      where: {
        organizationId,
        status: { in: ['ACTIVE', 'PUBLISHED'] },
        ...(gradeId
          ? {
              OR: [
                { gradeId },
                {
                  gradeId: null,
                  courses: { some: { course: { gradeId } } },
                },
              ],
            }
          : {}),
      },
      include: {
        grade: true,
        prices: { where: { status: 'ACTIVE' } },
        courses: {
          include: {
            course: {
              select: {
                id: true,
                titleAr: true,
                titleEn: true,
                descriptionAr: true,
              },
            },
          },
        },
      },
    });
  }

  async getProductsForAccount(
    accountId: string,
    gradeId?: string,
  ): Promise<any[]> {
    const [products, entitlements] = await Promise.all([
      this.getPublicProducts(gradeId),
      db.entitlement.findMany({
        where: {
          accountId,
          status: 'ACTIVE',
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        include: {
          product: {
            include: {
              prices: { where: { status: 'ACTIVE' } },
              courses: {
                include: {
                  course: {
                    select: {
                      id: true,
                      gradeId: true,
                      titleAr: true,
                      titleEn: true,
                      descriptionAr: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
    ]);
    const productsById = new Map(
      products.map((product) => [
        product.id,
        {
          ...product,
          isEntitled: Number(product.prices?.[0]?.amount) === 0,
        },
      ]),
    );
    for (const entitlement of entitlements) {
      const product = entitlement.product;
      if (
        gradeId &&
        (product.gradeId
          ? product.gradeId !== gradeId
          : !product.courses.some((entry) => entry.course.gradeId === gradeId))
      ) {
        continue;
      }
      productsById.set(product.id, { ...product, isEntitled: true });
    }
    return Array.from(productsById.values());
  }

  async getPublicProduct(id: string): Promise<any> {
    const organizationId = await this.getPrimaryOrganizationId();
    if (!organizationId) {
      throw new NotFoundException('Product not found');
    }
    const product = await db.product.findFirst({
      where: { id, organizationId },
      include: {
        prices: { where: { status: 'ACTIVE' } },
        courses: {
          include: {
            course: {
              select: {
                id: true,
                titleAr: true,
                titleEn: true,
                descriptionAr: true,
              },
            },
          },
        },
      },
    });
    if (!product || !['ACTIVE', 'PUBLISHED'].includes(product.status)) {
      throw new NotFoundException('Product not found');
    }
    return product;
  }

  async getBundlesForGrade(gradeId: string) {
    const organizationId = await this.getPrimaryOrganizationId();
    if (!organizationId) return [];
    const products = await db.product.findMany({
      where: {
        organizationId,
        type: 'BUNDLE',
        status: { in: ['ACTIVE', 'PUBLISHED'] },
        OR: [
          { gradeId },
          { gradeId: null, courses: { some: { course: { gradeId } } } },
        ],
      },
      include: {
        prices: { where: { status: 'ACTIVE' }, take: 1 },
        courses: {
          include: {
            course: {
              include: {
                chapters: {
                  include: {
                    units: {
                      where: { status: 'PUBLISHED' },
                      select: { id: true },
                    },
                  },
                },
              },
            },
          },
        },
        unitEntries: {
          include: { unit: { select: { id: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return products.map((product: any) => {
      const courseUnitIds = product.courses.flatMap((entry: any) =>
        entry.course.chapters.flatMap((chapter: any) =>
          chapter.units.map((unit: any) => unit.id),
        ),
      );
      const explicitUnitIds = product.unitEntries.map(
        (entry: any) => entry.unit.id,
      );
      return {
        ...product,
        lessonCount: new Set([...courseUnitIds, ...explicitUnitIds]).size,
      };
    });
  }

  async getUnitsForGrade(gradeId: string) {
    const organizationId = await this.getPrimaryOrganizationId();
    if (!organizationId) return [];
    const units = await db.unit.findMany({
      where: {
        status: 'PUBLISHED',
        chapter: {
          course: { organizationId, gradeId, status: 'PUBLISHED' },
        },
      },
      include: {
        chapter: { include: { course: true } },
        lessons: {
          where: { status: 'PUBLISHED' },
          orderBy: { sort: 'asc' },
        },
        productEntries: {
          include: {
            product: {
              include: { prices: { where: { status: 'ACTIVE' }, take: 1 } },
            },
          },
        },
        assessments: {
          where: { status: 'PUBLISHED' },
          include: { questions: true },
        },
        prerequisiteAssessment: {
          select: {
            id: true,
            titleAr: true,
            type: true,
            passingScore: true,
          },
        },
      },
      orderBy: [{ chapter: { sort: 'asc' } }, { sort: 'asc' }],
    });

    return units.map((unit: any) => ({
      ...unit,
      lessonProduct:
        unit.productEntries.find(
          (entry: any) => entry.product.type === 'LESSON',
        )?.product ?? null,
    }));
  }

  async getBundleDetail(
    productId: string,
    accountId?: string,
    isStaff = false,
  ) {
    const product = await db.product.findUnique({
      where: { id: productId },
      include: {
        prices: { where: { status: 'ACTIVE' }, take: 1 },
        courses: {
          include: {
            course: {
              include: {
                grade: true,
                chapters: {
                  orderBy: { sort: 'asc' },
                  include: {
                    units: {
                      where: isStaff ? undefined : { status: 'PUBLISHED' },
                      orderBy: { sort: 'asc' },
                      include: {
                        lessons: {
                          where: isStaff ? undefined : { status: 'PUBLISHED' },
                          orderBy: { sort: 'asc' },
                        },
                        assessments: {
                          where: isStaff ? undefined : { status: 'PUBLISHED' },
                          include: {
                            questions: true,
                            attempts: accountId
                              ? {
                                  where: { accountId },
                                  orderBy: { submittedAt: 'desc' },
                                  take: 1,
                                }
                              : false,
                          },
                        },
                        productEntries: {
                          include: {
                            product: {
                              include: {
                                prices: {
                                  where: { status: 'ACTIVE' },
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
              },
            },
          },
        },
        unitEntries: {
          include: {
            unit: {
              include: {
                chapter: { include: { course: { include: { grade: true } } } },
                lessons: {
                  where: isStaff ? undefined : { status: 'PUBLISHED' },
                  orderBy: { sort: 'asc' },
                },
                assessments: {
                  where: isStaff ? undefined : { status: 'PUBLISHED' },
                  include: { questions: true },
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
    if (!product || product.type !== 'BUNDLE') {
      throw new NotFoundException('Bundle not found');
    }

    const courses = (product.courses as any[])
      .map((entry) => entry.course)
      .filter((course) => isStaff || course.status === 'PUBLISHED')
      .map((course) => ({
        ...course,
        unitCount: course.chapters.reduce(
          (total: number, chapter: any) => total + chapter.units.length,
          0,
        ),
      }));

    const unitMap = new Map<string, any>();
    for (const course of courses) {
      for (const chapter of course.chapters) {
        for (const unit of chapter.units) {
          unitMap.set(unit.id, unit);
        }
      }
    }
    for (const entry of product.unitEntries as any[]) {
      unitMap.set(entry.unit.id, entry.unit);
    }

    const units = await Promise.all(
      Array.from(unitMap.values()).map(async (unit: any) => ({
        ...unit,
        access: accountId
          ? await this.getUnitAccess(accountId, unit.id, isStaff)
          : { hasAccess: false, reason: 'NONE' },
      })),
    );

    const hasEntitlement =
      isStaff ||
      (accountId
        ? await this.hasEntitlementToProduct(accountId, product.id)
        : false);

    return { product, courses, units, hasEntitlement };
  }

  async getUnitDetail(unitId: string, accountId: string, isStaff = false) {
    const unit = await db.unit.findUnique({
      where: { id: unitId },
      include: {
        chapter: { include: { course: { include: { grade: true } } } },
        lessons: {
          where: isStaff ? undefined : { status: 'PUBLISHED' },
          orderBy: { sort: 'asc' },
        },
        assessments: {
          where: isStaff ? undefined : { status: 'PUBLISHED' },
          include: {
            questions: true,
            attempts: {
              where: { accountId },
              orderBy: { startedAt: 'desc' },
              take: 1,
            },
          },
        },
        prerequisiteAssessment: {
          select: {
            id: true,
            titleAr: true,
            type: true,
            passingScore: true,
          },
        },
        productEntries: {
          include: {
            product: {
              include: { prices: { where: { status: 'ACTIVE' }, take: 1 } },
            },
          },
        },
      },
    });
    if (!unit) {
      throw new NotFoundException('Unit not found');
    }

    const access = await this.getUnitAccess(accountId, unitId, isStaff);
    const lessonIds = unit.lessons.map((lesson: any) => lesson.id);
    const progress = lessonIds.length
      ? await db.lessonProgress.findMany({
          where: { accountId, lessonId: { in: lessonIds } },
        })
      : [];
    const progressByLesson = new Map<string, any>(
      progress.map((item: any) => [item.lessonId, item]),
    );
    const locks =
      !isStaff && access.hasAccess
        ? await this.computeLessonLocks(accountId, unit.chapter.courseId)
        : new Map<string, any>();
    const lockedLessonIds = new Set<string>();
    for (const lesson of unit.lessons) {
      if (locks.get(lesson.id)?.locked) lockedLessonIds.add(lesson.id);
    }
    const contentItems = [
      ...unit.lessons
        .filter((lesson: any) => lesson.contentType !== 'EXAM')
        .map((lesson: any) => {
          const isLocked = !isStaff && lockedLessonIds.has(lesson.id);
          return {
            type: lesson.contentType,
            lessonId: lesson.id,
            titleAr: lesson.titleAr,
            contentUrl: isLocked ? null : lesson.contentUrl,
            attachedPdfUrl: isLocked ? null : lesson.attachedPdfUrl,
            homeworkPdfUrl: isLocked ? null : lesson.homeworkPdfUrl,
            durationSeconds: lesson.durationSeconds,
            completedAt: progressByLesson.get(lesson.id)?.completedAt ?? null,
            available: access.hasAccess && !isLocked,
            locked: isLocked,
            gate: isLocked ? locks.get(lesson.id) : null,
          };
        }),
      ...unit.assessments.map((assessment: any) => ({
        type: 'ASSESSMENT',
        assessmentId: assessment.id,
        titleAr: assessment.titleAr,
        questionCount: assessment.questions.length,
        attempt: assessment.attempts[0] ?? null,
        available: access.hasAccess,
      })),
    ];

    const lessonProduct =
      unit.productEntries
        .map((entry: any) => entry.product)
        .find(
          (product: any) =>
            product.type === 'LESSON' &&
            ['ACTIVE', 'PUBLISHED'].includes(product.status),
        ) ?? null;

    return {
      unit: { ...unit, productEntries: undefined },
      lessonProduct,
      contentItems,
      hasAccess: access.hasAccess,
      access,
    };
  }

  async getEntitledCourses(accountId: string): Promise<any[]> {
    const now = new Date();
    const [entitlements, freeProducts] = await Promise.all([
      db.entitlement.findMany({
        where: {
          accountId,
          status: 'ACTIVE',
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        include: {
          product: {
            include: {
              courses: {
                include: {
                  course: true,
                },
              },
            },
          },
        },
      }),
      db.product.findMany({
        where: {
          status: { in: ['ACTIVE', 'PUBLISHED'] },
          prices: { some: { status: 'ACTIVE', amount: 0 } },
          courses: { some: { course: { status: 'PUBLISHED' } } },
        },
        include: { courses: { include: { course: true } } },
      }),
    ]);

    const coursesMap = new Map<string, any>();
    for (const ent of entitlements) {
      for (const pc of ent.product.courses) {
        if (!coursesMap.has(pc.course.id)) {
          coursesMap.set(pc.course.id, pc.course);
        }
      }
    }
    for (const product of freeProducts) {
      for (const pc of product.courses) {
        if (!coursesMap.has(pc.course.id))
          coursesMap.set(pc.course.id, pc.course);
      }
    }
    return Array.from(coursesMap.values());
  }

  async getCourseDetail(
    courseId: string,
    accountId?: string,
    isStaff = false,
  ): Promise<any> {
    const course = await db.course.findUnique({
      where: { id: courseId },
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
          where: isStaff ? undefined : { status: 'PUBLISHED' },
          include: {
            units: {
              orderBy: { sort: 'asc' },
              where: isStaff ? undefined : { status: 'PUBLISHED' },
              include: {
                prerequisiteAssessment: {
                  select: {
                    id: true,
                    titleAr: true,
                    type: true,
                    passingScore: true,
                  },
                },
                lessons: {
                  orderBy: { sort: 'asc' },
                  where: isStaff ? undefined : { status: 'PUBLISHED' },
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
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    let hasAccess = isStaff;
    if (!isStaff && accountId) {
      hasAccess = await this.hasEntitlementToCourse(accountId, courseId);
    }

    const prerequisiteAssessments = course.chapters.flatMap((chapter: any) =>
      chapter.units
        .map((unit: any) => unit.prerequisiteAssessment)
        .filter(Boolean),
    );
    const prerequisiteIds = prerequisiteAssessments.map(
      (assessment: any) => assessment.id,
    );
    const prerequisiteById = new Map(
      prerequisiteAssessments.map((assessment: any) => [
        assessment.id,
        assessment,
      ]),
    );
    const submittedPrerequisiteIds =
      !isStaff && accountId && prerequisiteIds.length
        ? new Set(
            (
              await db.assessmentAttempt.findMany({
                where: {
                  accountId,
                  assessmentId: { in: prerequisiteIds },
                  submittedAt: { not: null },
                },
                select: { assessmentId: true, score: true },
              })
            )
              .filter((attempt: any) => {
                const prerequisite = prerequisiteById.get(attempt.assessmentId);
                return (
                  prerequisite?.passingScore === null ||
                  (attempt.score !== null &&
                    Number(attempt.score) >= prerequisite.passingScore)
                );
              })
              .map((attempt: any) => attempt.assessmentId),
          )
        : new Set<string>();

    const purchaseOptions = (course.products as any[])
      .map((entry: any) => entry.product)
      .filter((product: any) =>
        ['ACTIVE', 'PUBLISHED'].includes(product.status),
      );

    const courseUnits = course.chapters.flatMap(
      (chapter: any) => chapter.units,
    );
    const unitAccessById = new Map<string, any>(
      accountId
        ? await Promise.all(
            courseUnits.map(
              async (unit: any) =>
                [
                  unit.id,
                  await this.getUnitAccess(accountId, unit.id, isStaff),
                ] as const,
            ),
          )
        : courseUnits.map((unit: any) => [
            unit.id,
            { hasAccess: false, reason: 'NONE' as const },
          ]),
    );

    const lessonLocks =
      !isStaff && accountId
        ? await this.computeLessonLocks(accountId, courseId)
        : new Map<string, any>();

    return {
      course: {
        ...course,
        products: undefined,
        chapters: course.chapters.map((chapter: any) => ({
          ...chapter,
          units: chapter.units.map((unit: any) => ({
            ...unit,
            purchaseProduct:
              unit.productEntries
                .map((entry: any) => entry.product)
                .find((product: any) =>
                  ['ACTIVE', 'PUBLISHED'].includes(product.status),
                ) ?? null,
            access: unitAccessById.get(unit.id),
            productEntries: undefined,
            available:
              isStaff ||
              !unit.prerequisiteAssessmentId ||
              submittedPrerequisiteIds.has(unit.prerequisiteAssessmentId),
            lessons: (unit.lessons as any[]).map((lesson: any) => {
              const lock = lessonLocks.get(lesson.id);
              const isLocked = !!lock?.locked;
              return isLocked
                ? {
                    ...lesson,
                    contentUrl: null,
                    attachedPdfUrl: null,
                    homeworkPdfUrl: null,
                    locked: true,
                    gate: lock,
                  }
                : { ...lesson, locked: false, gate: null };
            }),
          })),
        })),
      },
      hasAccess,
      purchaseOptions,
    };
  }

  async getLessonDetail(
    lessonId: string,
    accountId: string,
    isStaff = false,
  ): Promise<any> {
    const canAccess = await this.canAccessLesson(accountId, lessonId, isStaff);
    if (!canAccess) {
      throw new ForbiddenException('Access denied');
    }

    const lesson = await db.lesson.findUnique({
      where: { id: lessonId },
      include: { unit: { include: { chapter: true } } },
    });
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    const gate = await db.assessment.findFirst({
      where: {
        lessonId,
        status: 'PUBLISHED',
        archivedAt: null,
        passingScore: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      include: { questions: true },
    });
    const gateConfig = gate
      ? {
          assessmentId: gate.id,
          titleAr: gate.titleAr,
          requiredScore: gate.passingScore,
          questionCount: gate.questions.length,
          published: gate.status === 'PUBLISHED',
        }
      : null;

    const passedGate = gate
      ? await this.isQuizGatePassed(accountId, gate)
      : false;
    const latestAttempt = gate
      ? await db.assessmentAttempt.findFirst({
          where: {
            accountId,
            assessmentId: gate.id,
            submittedAt: { not: null },
          },
          orderBy: { submittedAt: 'desc' },
          select: { score: true, submittedAt: true },
        })
      : null;
    const lastScore =
      latestAttempt?.score === null || latestAttempt?.score === undefined
        ? null
        : Number(latestAttempt.score);

    if (isStaff) {
      return {
        lesson,
        endOfLessonQuiz: gateConfig,
      };
    }

    const safeLesson = this.toStudentLesson(lesson);

    const courseId = lesson.unit.chapter.courseId;
    const orderedLessons = await this.getCourseOrderedLessons(courseId);
    const currentIndex = orderedLessons.findIndex(
      (item: any) => item.id === lessonId,
    );
    const nextLesson =
      currentIndex !== -1 ? (orderedLessons[currentIndex + 1] ?? null) : null;

    let nextLocked = false;
    if (nextLesson) {
      try {
        await this.canAccessLesson(accountId, nextLesson.id, false);
      } catch {
        nextLocked = true;
      }
    }

    return {
      lesson: safeLesson,
      endOfLessonQuiz: {
        ...gateConfig,
        passed: latestAttempt ? passedGate : false,
        lastScore,
      },
      nextLesson: nextLesson
        ? { id: nextLesson.id, titleAr: nextLesson.titleAr, locked: nextLocked }
        : null,
    };
  }

  /**
   * Student-facing projection of a Lesson. Never leaks internal/admin fields
   * (status, publish windows, version, sort, archivedAt, createdAt, updatedAt)
   * or raw content URLs unless the content type genuinely requires them
   * (PDF/TEXT lessons are rendered from `contentUrl`/`content`; VIDEO lessons
   * are delivered through the protected /video flow, so no URL is exposed).
   */
  private toStudentLesson(lesson: any): any {
    const isVideo = lesson.contentType === 'VIDEO';
    return {
      id: lesson.id,
      titleAr: lesson.titleAr,
      titleEn: lesson.titleEn ?? null,
      contentType: lesson.contentType,
      content: lesson.content ?? null,
      durationSeconds: lesson.durationSeconds ?? 0,
      requiresPreviousLessonPass: lesson.requiresPreviousLessonPass ?? false,
      contentUrl: isVideo ? null : (lesson.contentUrl ?? null),
      attachedPdfUrl: isVideo ? null : (lesson.attachedPdfUrl ?? null),
      homeworkPdfUrl: isVideo ? null : (lesson.homeworkPdfUrl ?? null),
      unit: lesson.unit
        ? {
            id: lesson.unit.id,
            titleAr: lesson.unit.titleAr,
            titleEn: lesson.unit.titleEn ?? null,
            chapter: lesson.unit.chapter
              ? {
                  id: lesson.unit.chapter.id,
                  titleAr: lesson.unit.chapter.titleAr,
                  titleEn: lesson.unit.chapter.titleEn ?? null,
                }
              : null,
          }
        : null,
    };
  }
}
