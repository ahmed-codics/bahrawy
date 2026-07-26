import { db } from '../src/index';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';

const rawEncKey = process.env.ENCRYPTION_KEY || 'local_dev_encryption_secret_key_32_chars';
const rawHmacKey = process.env.HMAC_KEY || 'local_dev_hmac_secret_key_32_chars_long';

let encryptionKey: Buffer;
if (rawEncKey.length === 64 && /^[0-9a-fA-F]+$/.test(rawEncKey)) {
  encryptionKey = Buffer.from(rawEncKey, 'hex');
} else {
  throw new Error(
    'FATAL: ENCRYPTION_KEY must be exactly 64 hex characters (no fallback to weak key)',
  );
}

let hmacKey: Buffer;
if (rawHmacKey.length === 64 && /^[0-9a-fA-F]+$/.test(rawHmacKey)) {
  hmacKey = Buffer.from(rawHmacKey, 'hex');
} else {
  throw new Error('FATAL: HMAC_KEY must be exactly 64 hex characters (no fallback to weak key)');
}

function normalizePhone(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  if (clean.startsWith('01') && clean.length === 11) return `+20${clean.substring(1)}`;
  if (clean.startsWith('201') && clean.length === 12) return `+${clean}`;
  if (clean.startsWith('1') && clean.length === 10) return `+20${clean}`;
  if (!phone.startsWith('+')) return `+${clean}`;
  return `+${clean}`;
}

function generatePhoneHmac(phone: string): string {
  const normalized = normalizePhone(phone);
  return crypto.createHmac('sha256', hmacKey).update(normalized).digest('hex');
}

function generateEmailHmac(email: string): string {
  return crypto.createHmac('sha256', hmacKey).update(email.trim().toLowerCase()).digest('hex');
}

function encrypt(text: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 1,
  });
}

function seedCredential(name: string, developmentFallback: string): string {
  const value = process.env[name];
  if (process.env.NODE_ENV === 'production') {
    if (!value || value.length < 12) {
      throw new Error(`${name} must contain at least 12 characters in production`);
    }
    return value;
  }
  return value || developmentFallback;
}

async function main() {
  console.log('Seeding development/test data for Bahrawy Academy...');
  const staffEmail = (process.env.SEED_STAFF_EMAIL || 'admin@bahrawy.test').trim().toLowerCase();
  const staffPassword = seedCredential('SEED_STAFF_PASSWORD', 'owner_secret');
  const studentPassword = seedCredential('SEED_STUDENT_PASSWORD', 'student_secret');
  const guardianPassword = seedCredential('SEED_GUARDIAN_PASSWORD', 'guardian_secret');

  // 1. Organization & Hierarchy
  const org = await db.organization.upsert({
    where: { slug: 'bahrawy-academy-dev' },
    update: { name: '[DEV ONLY] Bahrawy Academy', status: 'ACTIVE' },
    create: {
      name: '[DEV ONLY] Bahrawy Academy',
      slug: 'bahrawy-academy-dev',
      timezone: 'Africa/Cairo',
      currency: 'EGP',
      status: 'ACTIVE',
    },
  });

  const branch = await db.branch.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'main-branch' } },
    update: { status: 'ACTIVE' },
    create: {
      organizationId: org.id,
      code: 'main-branch',
      nameAr: '[DEV ONLY] الفرع الرئيسي',
      nameEn: '[DEV ONLY] Main Branch',
      status: 'ACTIVE',
    },
  });

  const academicYear = await db.academicYear.upsert({
    where: { organizationId_label: { organizationId: org.id, label: '2026/27' } },
    update: { status: 'ACTIVE' },
    create: {
      organizationId: org.id,
      label: '2026/27',
      startsOn: new Date('2026-09-01T00:00:00Z'),
      endsOn: new Date('2027-06-30T23:59:59Z'),
      status: 'ACTIVE',
    },
  });

  const grades = [
    { code: 'g3-prep', nameAr: 'الصف الثالث الإعدادي', nameEn: 'Third Preparatory', sort: 1 },
    { code: 'g1-sec', nameAr: 'الصف الأول الثانوي', nameEn: 'First Secondary', sort: 2 },
    { code: 'g2-sec', nameAr: 'الصف الثاني الثانوي', nameEn: 'Second Secondary', sort: 3 },
    { code: 'g3-sec', nameAr: 'الصف الثالث الثانوي', nameEn: 'Third Secondary', sort: 4 },
  ];

  let mainGradeId = '';
  for (const g of grades) {
    const grade = await db.grade.upsert({
      where: { organizationId_code: { organizationId: org.id, code: g.code } },
      update: { status: 'ACTIVE' },
      create: {
        organizationId: org.id,
        code: g.code,
        nameAr: g.nameAr,
        nameEn: g.nameEn,
        sort: g.sort,
        status: 'ACTIVE',
      },
    });
    if (g.code === 'g3-sec') mainGradeId = grade.id;
  }

  const subject = await db.subject.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'english' } },
    update: { status: 'ACTIVE' },
    create: {
      organizationId: org.id,
      code: 'english',
      nameAr: '[DEV ONLY] لغة إنجليزية',
      nameEn: '[DEV ONLY] English',
      status: 'ACTIVE',
    },
  });

  const cohort = await db.cohort.upsert({
    where: {
      organizationId_academicYearId_gradeId: {
        organizationId: org.id,
        academicYearId: academicYear.id,
        gradeId: mainGradeId,
      },
    },
    update: { status: 'ACTIVE' },
    create: {
      organizationId: org.id,
      academicYearId: academicYear.id,
      gradeId: mainGradeId,
      startsAt: new Date('2026-09-01T00:00:00Z'),
      expiresAt: new Date('2027-06-30T23:59:59Z'),
      status: 'ACTIVE',
    },
  });

  const term = await db.term.upsert({
    where: { cohortId_code: { cohortId: cohort.id, code: 'term-1' } },
    update: { status: 'ACTIVE' },
    create: {
      cohortId: cohort.id,
      code: 'term-1',
      titleAr: '[DEV ONLY] الفصل الدراسي الأول',
      titleEn: '[DEV ONLY] Term 1',
      startsAt: new Date('2026-09-01T00:00:00Z'),
      endsAt: new Date('2027-01-31T23:59:59Z'),
      sort: 1,
      status: 'ACTIVE',
    },
  });

  // 2. Roles & Permissions
  const ownerRole = await db.role.upsert({
    where: { code: 'OWNER' },
    update: {},
    create: { code: 'OWNER', description: 'System Owner' },
  });

  const permissions = [
    'CATALOG_MANAGE',
    'PRODUCT_MANAGE',
    'STUDENT_MANAGE',
    'PAYMENT_MANAGE',
    'SUPPORT_MANAGE',
    'STAFF_MANAGE',
    'ASSESSMENT_MANAGE',
  ];

  for (const p of permissions) {
    const perm = await db.permission.upsert({
      where: { code: p },
      update: {},
      create: { code: p, description: p },
    });

    await db.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: ownerRole.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: ownerRole.id,
        permissionId: perm.id,
      },
    });
  }

  // 3. Test Identities
  const studentPhone = '+201000000001';
  const guardianPhone = '+201000000002';
  const unactivatedPhone = '+201000000003';

  // Owner/Staff Account
  const staffEmailHmac = generateEmailHmac(staffEmail);
  const existingStaffAccount = await db.account.findFirst({
    where: {
      organizationId: org.id,
      kind: 'STAFF',
      OR: [{ emailHmac: staffEmailHmac }, { phoneHmac: generatePhoneHmac('+201000000000') }],
    },
  });
  const staffAccount = existingStaffAccount
    ? await db.account.update({
        where: { id: existingStaffAccount.id },
        data: {
          emailEncrypted: encrypt(staffEmail),
          emailHmac: staffEmailHmac,
          phoneEncrypted: null,
          phoneHmac: null,
        },
      })
    : await db.account.create({
        data: {
          organizationId: org.id,
          kind: 'STAFF',
          emailEncrypted: encrypt(staffEmail),
          emailHmac: staffEmailHmac,
          passwordHash: await hashPassword(staffPassword),
          status: 'ACTIVE',
          accountRoles: {
            create: {
              roleId: ownerRole.id,
            },
          },
          staffProfile: {
            create: {
              displayName: '[DEV] Admin Staff',
            },
          },
        },
      });

  const existingOwnerAssignment = await db.accountRole.findFirst({
    where: {
      accountId: staffAccount.id,
      roleId: ownerRole.id,
      branchScopeId: null,
    },
  });
  if (!existingOwnerAssignment) {
    await db.accountRole.create({
      data: {
        accountId: staffAccount.id,
        roleId: ownerRole.id,
      },
    });
  }

  // Student Account
  const studentAccount = await db.account.upsert({
    where: {
      organizationId_phoneHmac: {
        organizationId: org.id,
        phoneHmac: generatePhoneHmac(studentPhone),
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      kind: 'STUDENT',
      phoneEncrypted: encrypt(studentPhone),
      phoneHmac: generatePhoneHmac(studentPhone),
      passwordHash: await hashPassword(studentPassword),
      status: 'ACTIVE',
      studentProfile: {
        create: {
          displayName: '[DEV] Test Student',
        },
      },
    },
  });

  const studentProfile = await db.studentProfile.findUnique({
    where: { accountId: studentAccount.id },
  });

  // Guardian Account linked to student
  const guardianAccount = await db.account.upsert({
    where: {
      organizationId_phoneHmac: {
        organizationId: org.id,
        phoneHmac: generatePhoneHmac(guardianPhone),
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      kind: 'GUARDIAN',
      phoneEncrypted: encrypt(guardianPhone),
      phoneHmac: generatePhoneHmac(guardianPhone),
      passwordHash: await hashPassword(guardianPassword),
      status: 'ACTIVE',
      guardianProfile: {
        create: {
          displayName: '[DEV] Test Guardian',
        },
      },
    },
  });

  const guardianProfile = await db.guardianProfile.findUnique({
    where: { accountId: guardianAccount.id },
  });

  // Link Student and Guardian
  if (studentProfile && guardianProfile) {
    const existingLink = await db.studentGuardian.findUnique({
      where: {
        studentProfileId_guardianProfileId: {
          studentProfileId: studentProfile.id,
          guardianProfileId: guardianProfile.id,
        },
      },
    });
    if (!existingLink) {
      await db.studentGuardian.create({
        data: {
          studentProfileId: studentProfile.id,
          guardianProfileId: guardianProfile.id,
          relationshipType: 'PRIMARY',
        },
      });
    }
  }

  // One-use Activation Account
  const activationAccount = await db.account.upsert({
    where: {
      organizationId_phoneHmac: {
        organizationId: org.id,
        phoneHmac: generatePhoneHmac(unactivatedPhone),
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      kind: 'STUDENT',
      phoneEncrypted: encrypt(unactivatedPhone),
      phoneHmac: generatePhoneHmac(unactivatedPhone),
      passwordHash: '',
      status: 'PENDING_ACTIVATION',
      studentProfile: {
        create: {
          displayName: '[DEV] Unactivated Student',
        },
      },
      activation: {
        create: {
          source: 'ROSTER',
          credentialHash: await hashPassword('123456'), // Hashed PIN
          expiresAt: new Date('2027-01-01T00:00:00Z'),
        },
      },
    },
  });

  // 4. Sample Catalog (Course/Chapter/Unit/Lesson/Product)
  const course = await db.course.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'eng-g3-t1' } },
    update: {},
    create: {
      organizationId: org.id,
      gradeId: mainGradeId,
      code: 'eng-g3-t1',
      titleAr: '[DEV] لغة إنجليزية - ترم أول',
      titleEn: '[DEV] English G3 T1',
      status: 'PUBLISHED',
    },
  });

  const chapter =
    (await db.chapter.findFirst({ where: { courseId: course.id } })) ||
    (await db.chapter.create({
      data: {
        courseId: course.id,
        titleAr: '[DEV] الوحدة الأولى',
        titleEn: '[DEV] Chapter 1',
        status: 'PUBLISHED',
      },
    }));

  const unit =
    (await db.unit.findFirst({ where: { chapterId: chapter.id } })) ||
    (await db.unit.create({
      data: {
        chapterId: chapter.id,
        titleAr: '[DEV] الدرس الأول',
        titleEn: '[DEV] Unit 1',
        status: 'PUBLISHED',
      },
    }));

  const lesson =
    (await db.lesson.findFirst({ where: { unitId: unit.id } })) ||
    (await db.lesson.create({
      data: {
        unitId: unit.id,
        titleAr: '[DEV] فيديو الشرح',
        titleEn: '[DEV] Explanation Video',
        contentType: 'VIDEO',
        status: 'PUBLISHED',
      },
    }));

  const product = await db.product.upsert({
    where: { organizationId_code: { organizationId: org.id, code: 'prod-eng-g3-t1' } },
    update: { gradeId: mainGradeId, type: 'BUNDLE' },
    create: {
      organizationId: org.id,
      gradeId: mainGradeId,
      code: 'prod-eng-g3-t1',
      type: 'BUNDLE',
      titleAr: '[DEV] كورس الإنجليزي كامل',
      status: 'ACTIVE',
      prices: {
        create: {
          amount: 500.0,
          currency: 'EGP',
          billingPeriod: 'ONCE',
        },
      },
      courses: {
        create: {
          courseId: course.id,
        },
      },
    },
  });

  // 5. Sample Entitlement
  const entitlement =
    (await db.entitlement.findFirst({
      where: { accountId: studentAccount.id, productId: product.id },
    })) ||
    (await db.entitlement.create({
      data: {
        accountId: studentAccount.id,
        productId: product.id,
        status: 'ACTIVE',
      },
    }));

  // 6. Pending Payment
  const price = await db.price.findFirst({ where: { productId: product.id } });
  if (price) {
    const paymentOrder = await db.paymentOrder.upsert({
      where: { idempotencyKey: 'dev_payment_order_1' },
      update: {},
      create: {
        organizationId: org.id,
        accountId: studentAccount.id,
        productId: product.id,
        priceId: price.id,
        amountRequested: price.amount,
        status: 'PENDING_REVIEW',
        idempotencyKey: 'dev_payment_order_1',
      },
    });
  }

  // 7. Sample MCQ Assessment
  const assessment =
    (await db.assessment.findFirst({ where: { courseId: course.id } })) ||
    (await db.assessment.create({
      data: {
        courseId: course.id,
        titleAr: '[DEV] امتحان الوحدة الأولى',
        durationMinutes: 30,
        status: 'PUBLISHED',
      },
    }));

  const question =
    (await db.question.findFirst({ where: { organizationId: org.id } })) ||
    (await db.question.create({
      data: {
        organizationId: org.id,
        titleAr: 'ما هي عاصمة مصر؟',
        options: [
          { id: 'a', text: 'القاهرة' },
          { id: 'b', text: 'الأسكندرية' },
        ],
        correctOptionId: 'a',
        points: 1,
      },
    }));

  const assessmentQuestion = await db.assessmentQuestion.findUnique({
    where: { assessmentId_questionId: { assessmentId: assessment.id, questionId: question.id } },
  });
  if (!assessmentQuestion) {
    await db.assessmentQuestion.create({
      data: { assessmentId: assessment.id, questionId: question.id },
    });
  }

  // 8. Notifications and Support Ticket
  const ticket =
    (await db.supportTicket.findFirst({ where: { accountId: studentAccount.id } })) ||
    (await db.supportTicket.create({
      data: {
        organizationId: org.id,
        accountId: studentAccount.id,
        subject: 'مشكلة في تشغيل الفيديو',
        description: 'الفيديو لا يعمل معي',
        status: 'OPEN',
      },
    }));

  const notification =
    (await db.inAppNotification.findFirst({ where: { accountId: studentAccount.id } })) ||
    (await db.inAppNotification.create({
      data: {
        accountId: studentAccount.id,
        title: 'تم تفعيل حسابك',
        content: 'أهلاً بك في أكاديمية بحراوي',
      },
    }));

  console.log('Seed completed successfully. Test identities created.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
