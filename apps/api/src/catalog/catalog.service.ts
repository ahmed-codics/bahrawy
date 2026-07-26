import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { db } from '@bahrawy/db';

@Injectable()
export class CatalogService {
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
    return !!entitlement;
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
    return !!activeEntitlement;
  }

  async getUnitAccess(accountId: string, unitId: string, isStaff = false) {
    if (isStaff) {
      return { hasAccess: true, reason: 'STAFF' as const };
    }

    const unit = await db.unit.findUnique({
      where: { id: unitId },
      include: {
        chapter: true,
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

    const now = new Date();
    const entitlement = await db.entitlement.findFirst({
      where: {
        accountId,
        status: 'ACTIVE',
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        product: {
          OR: [
            {
              type: 'BUNDLE',
              courses: { some: { courseId: unit.chapter.courseId } },
            },
            {
              type: 'COURSE',
              courses: { some: { courseId: unit.chapter.courseId } },
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
    return true;
  }

  async getGrades(): Promise<any[]> {
    return db.grade.findMany({
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
    return db.product.findMany({
      where: {
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
        { ...product, isEntitled: false },
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
    const product = await db.product.findUnique({
      where: { id },
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
    const products = await db.product.findMany({
      where: {
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
    const units = await db.unit.findMany({
      where: {
        status: 'PUBLISHED',
        chapter: { course: { gradeId, status: 'PUBLISHED' } },
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

    const unitMap = new Map<string, any>();
    for (const entry of product.courses as any[]) {
      for (const chapter of entry.course.chapters) {
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

    return { product, units, hasEntitlement };
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
    const contentItems = [
      ...unit.lessons.map((lesson: any) => ({
        type: lesson.contentType,
        lessonId: lesson.id,
        titleAr: lesson.titleAr,
        contentUrl: lesson.contentUrl,
        attachedPdfUrl: lesson.attachedPdfUrl,
        homeworkPdfUrl: lesson.homeworkPdfUrl,
        durationSeconds: lesson.durationSeconds,
        completedAt: progressByLesson.get(lesson.id)?.completedAt ?? null,
        available: access.hasAccess,
      })),
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
    const entitlements = await db.entitlement.findMany({
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
    });

    const coursesMap = new Map<string, any>();
    for (const ent of entitlements) {
      for (const pc of ent.product.courses) {
        if (!coursesMap.has(pc.course.id)) {
          coursesMap.set(pc.course.id, pc.course);
        }
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
                const prerequisite = prerequisiteById.get(
                  attempt.assessmentId,
                ) as any;
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
    });
    if (!lesson) {
      throw new NotFoundException('Lesson not found');
    }

    return { lesson };
  }
}
