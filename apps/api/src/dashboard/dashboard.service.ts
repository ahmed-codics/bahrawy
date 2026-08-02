import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { db } from '@bahrawy/db';
import { SecurityService } from '../security/security.service';

@Injectable()
export class DashboardService {
  constructor(private readonly securityService: SecurityService) {}

  async getStudentProfile(accountId: string): Promise<any> {
    const student = await db.studentProfile.findUnique({
      where: { accountId },
      select: {
        studentNumber: true,
        displayName: true,
        gradeId: true,
        schoolName: true,
        city: true,
        gender: true,
        updatedAt: true,
        account: {
          select: {
            phoneEncrypted: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });
    if (!student) {
      throw new NotFoundException('Student profile not found');
    }

    let phoneMasked = '';
    if (student.account.phoneEncrypted) {
      try {
        const phone = this.securityService.decrypt(
          student.account.phoneEncrypted,
        );
        const digits = phone.replace(/\D/g, '');
        phoneMasked = digits.length >= 4 ? `•••• ${digits.slice(-4)}` : '••••';
      } catch {
        phoneMasked = 'غير متاح';
      }
    }

    return {
      profile: {
        studentNumber: student.studentNumber,
        displayName: student.displayName,
        gradeId: student.gradeId,
        schoolName: student.schoolName,
        city: student.city,
        gender: student.gender,
        phoneMasked,
        status: student.account.status,
        createdAt: student.account.createdAt,
        updatedAt: student.updatedAt,
      },
    };
  }

  async getStudentDashboard(accountId: string): Promise<any> {
    const student = await db.studentProfile.findUnique({
      where: { accountId },
    });
    if (!student) {
      throw new NotFoundException('Student profile not found');
    }
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
                course: {
                  include: {
                    chapters: {
                      include: {
                        units: {
                          include: { lessons: true },
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
                    chapter: {
                      include: {
                        course: {
                          include: {
                            chapters: {
                              include: {
                                units: {
                                  include: { lessons: true },
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
      },
    });

    const coursesMap = new Map();
    for (const ent of entitlements) {
      for (const pc of ent.product.courses) {
        if (!coursesMap.has(pc.course.id)) {
          coursesMap.set(pc.course.id, pc.course);
        }
      }
      for (const pu of ent.product.unitEntries) {
        const course = pu.unit?.chapter?.course;
        if (course && !coursesMap.has(course.id)) {
          coursesMap.set(course.id, course);
        }
      }
    }

    const coursesList = [];
    for (const course of coursesMap.values()) {
      let totalLessons = 0;
      const lessonIds = [];
      for (const chap of course.chapters) {
        for (const u of chap.units) {
          for (const les of u.lessons) {
            if (les.status === 'PUBLISHED') {
              totalLessons++;
              lessonIds.push(les.id);
            }
          }
        }
      }
      const completedLessons = await db.lessonProgress.count({
        where: {
          accountId,
          lessonId: { in: lessonIds },
          completedAt: { not: null },
        },
      });
      coursesList.push({
        id: course.id,
        titleAr: course.titleAr,
        coverImageUrl: course.coverImageUrl,
        totalLessons,
        completedLessons,
        progressPercentage:
          totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0,
      });
    }
    const notifications = await db.inAppNotification.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const rawOrders = await db.paymentOrder.findMany({
      where: {
        accountId,
        status: { in: ['PENDING_REVIEW', 'REJECTED'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const recentOrders = await Promise.all(
      rawOrders.map(async (order) => {
        const product = await db.product.findUnique({
          where: { id: order.productId },
          select: { titleAr: true },
        });
        return {
          ...order,
          product,
        };
      }),
    );
    const rawActiveAssessments = await db.assessmentAttempt.findMany({
      where: {
        accountId,
        submittedAt: null,
      },
      include: {
        assessment: {
          select: {
            titleAr: true,
            passingScore: true,
          },
        },
      },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });

    const activeAssessments = [];
    const seenAssessmentIds = new Set<string>();
    for (const attempt of rawActiveAssessments) {
      if (!seenAssessmentIds.has(attempt.assessmentId)) {
        activeAssessments.push(attempt);
        seenAssessmentIds.add(attempt.assessmentId);
        if (activeAssessments.length === 5) break;
      }
    }

    return {
      profile: {
        displayName: student.displayName,
        gradeId: student.gradeId,
      },
      enrolledCourses: coursesList,
      recentNotifications: notifications,
      recentOrders,
      activeAssessments,
    };
  }

  async getGuardianDashboard(accountId: string): Promise<any> {
    const guardian = await db.guardianProfile.findUnique({
      where: { accountId },
    });
    if (!guardian) {
      throw new NotFoundException('Guardian profile not found');
    }
    const links = await db.studentGuardian.findMany({
      where: { guardianProfileId: guardian.id },
      include: {
        student: {
          include: {
            account: true,
          },
        },
      },
    });
    const studentsProgress = [];
    for (const link of links) {
      const studentAccId = link.student.accountId;
      const studentDashboard = await this.getStudentDashboard(studentAccId);
      studentsProgress.push({
        studentId: link.student.id,
        displayName: link.student.displayName,
        courses: studentDashboard.enrolledCourses,
      });
    }
    return {
      profile: {
        displayName: guardian.displayName,
      },
      linkedStudents: studentsProgress,
    };
  }

  async getStaffDashboard(): Promise<any> {
    const activeStudents = await db.account.count({
      where: { kind: 'STUDENT', status: 'ACTIVE' },
    });
    const pendingPayments = await db.paymentOrder.count({
      where: { status: 'PENDING_REVIEW' },
    });
    const openTickets = await db.supportTicket.count({
      where: { status: 'OPEN' },
    });
    return {
      metrics: {
        activeStudents,
        pendingPayments,
        openTickets,
      },
    };
  }

  async getStaffStudents(gradeId?: string): Promise<any> {
    const students = await db.studentProfile.findMany({
      where: gradeId ? { gradeId } : undefined,
      include: {
        account: true,
      },
      orderBy: { accountId: 'desc' },
    });
    return students.map((s: any) => ({
      id: s.id,
      accountId: s.accountId,
      displayName: s.displayName,
      phone: 'HIDDEN', // We don't expose raw phones directly in dashboard unless needed, or we can just return a placeholder. Actually, let's return phoneHmac or mask it. For now just placeholder to avoid decrypting in bulk.
      status: s.account.status,
    }));
  }

  async createStaffStudent(body: {
    phone: string;
    displayName: string;
  }): Promise<any> {
    const phoneHmac = this.securityService.generatePhoneHmac(body.phone);
    const existing = await db.account.findFirst({
      where: { phoneHmac, deletedAt: null },
    });
    if (existing) {
      throw new BadRequestException('Phone number is already registered');
    }

    // Default password for new student created by staff
    const initialPassword = 'student_secret';
    const passwordHash =
      await this.securityService.hashPassword(initialPassword);

    // We need an organization ID. Assuming there's only one organization right now for Lean V1.
    const org = await db.organization.findFirst();
    if (!org) {
      throw new BadRequestException(
        'System not initialized. No organization found.',
      );
    }

    const account = await db.account.create({
      data: {
        organizationId: org.id,
        kind: 'STUDENT',
        phoneHmac,
        phoneEncrypted: this.securityService.encrypt(body.phone),
        passwordHash,
        status: 'ACTIVE',
        mustChangePassword: true, // Force them to change password on first login
        studentProfile: {
          create: {
            displayName: body.displayName,
          },
        },
      },
      include: { studentProfile: true },
    });

    return {
      accountId: account.id,
      displayName: account.studentProfile?.displayName,
      message:
        'Student created with default password "student_secret". Please ask them to change it after login.',
    };
  }

  async getStaffStudent(id: string): Promise<any> {
    const student = await db.studentProfile.findUnique({
      where: { id },
      include: {
        account: true,
      },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // We can decrypt the phone number if needed here
    let rawPhone = '';
    if (student.account.phoneEncrypted) {
      try {
        rawPhone = this.securityService.decrypt(student.account.phoneEncrypted);
      } catch {
        rawPhone = 'DECRYPT_ERROR';
      }
    }

    return {
      id: student.id,
      accountId: student.accountId,
      displayName: student.displayName,
      phone: rawPhone,
      status: student.account.status,
      createdAt: student.createdAt,
    };
  }
  async updateStudentProfile(
    accountId: string,
    input: {
      gradeId: string;
      schoolName?: string | null;
      city?: string | null;
      gender?: 'MALE' | 'FEMALE' | null;
    },
  ): Promise<any> {
    const current = await db.studentProfile.findUnique({
      where: { accountId },
      select: { account: { select: { organizationId: true } } },
    });
    if (!current) {
      throw new NotFoundException('Student profile not found');
    }

    const gradeId = input.gradeId?.trim();
    if (!gradeId) {
      throw new BadRequestException('Grade is required');
    }
    const grade = await db.grade.findFirst({
      where: {
        id: gradeId,
        organizationId: current.account.organizationId,
        status: 'ACTIVE',
        archivedAt: null,
      },
      select: { id: true },
    });
    if (!grade) {
      throw new BadRequestException('Invalid grade');
    }

    const schoolName = input.schoolName?.trim() || null;
    const city = input.city?.trim() || null;
    if (schoolName && schoolName.length > 120) {
      throw new BadRequestException('School name is too long');
    }
    if (city && city.length > 80) {
      throw new BadRequestException('City is too long');
    }
    if (input.gender && !['MALE', 'FEMALE'].includes(input.gender)) {
      throw new BadRequestException('Invalid gender');
    }

    await db.studentProfile.update({
      where: { accountId },
      data: {
        gradeId,
        schoolName,
        city,
        gender: input.gender || null,
      },
    });
    return this.getStudentProfile(accountId);
  }
}
