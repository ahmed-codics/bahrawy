import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { AppModule } from './../src/app.module';
import { db } from '@bahrawy/db';
import { SecurityService } from './../src/security/security.service';

const SUFFIX = Date.now().toString(36);
const PASSWORD = 'E2eOffline!2026';
const DEVICE = `e2e-offline-device-${SUFFIX}`;

describe('Offline Access Codes - E2E', () => {
  let app: INestApplication<App>;
  let staffCookie: string;
  let studentCookie: string;
  let gradeId: string;
  let courseId: string;
  let generated: { id: string; code: string };
  let batchId: string;

  const security = new SecurityService();

  async function csrf(cookie: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .get('/auth/csrf-token')
      .set('Cookie', cookie)
      .expect(200);
    return (res.body.data ?? res.body).csrfToken as string;
  }

  async function staffLogin(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/staff-login')
      .send({ email: 'admin@bahrawy.test', password: 'owner_secret' });
    expect([200, 201]).toContain(res.status);
    return (res.headers['set-cookie']?.[0] ?? '').split(';')[0];
  }

  async function studentLogin(device: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .set('x-device-fingerprint', device)
      .set('user-agent', 'E2E-Offline-Agent')
      .send({ phone: `+20${SUFFIX}1`, password: PASSWORD });
    expect([200, 201]).toContain(res.status);
    return (res.headers['set-cookie']?.[0] ?? '').split(';')[0];
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    staffCookie = await staffLogin();

    const organization = await db.organization.findFirst({
      where: { slug: 'bahrawy-academy-dev' },
      select: { id: true },
    });
    expect(organization).toBeDefined();
    const orgId = organization!.id;

    const grade = await db.grade.findFirst({
      where: { organizationId: orgId, status: 'ACTIVE' },
      select: { id: true },
    });
    expect(grade).toBeDefined();
    gradeId = grade!.id;

    const course = await db.course.create({
      data: {
        organizationId: orgId,
        gradeId,
        code: `offline-e2e-${SUFFIX}`,
        titleAr: `كورس أوفلاين E2E ${SUFFIX}`,
        status: 'PUBLISHED',
      },
    });
    courseId = course.id;

    const phone = `+20${SUFFIX}1`;
    const passwordHash = await security.hashPassword(PASSWORD);
    const student = await db.account.create({
      data: {
        organizationId: orgId,
        kind: 'STUDENT',
        status: 'ACTIVE',
        phoneEncrypted: security.encrypt(phone),
        phoneHmac: security.generatePhoneHmac(phone),
        emailEncrypted: security.encrypt(`offline-${SUFFIX}@bahrawy.test`),
        emailHmac: security.generateEmailHmac(`offline-${SUFFIX}@bahrawy.test`),
        passwordHash,
        mustChangePassword: false,
        studentProfile: {
          create: {
            gradeId,
            displayName: `Offline E2E ${SUFFIX}`,
            firstName: 'Offline',
            secondName: 'E2E',
            thirdName: 'Test',
            lastName: SUFFIX,
          },
        },
      },
    });
    await db.studentDevice.create({
      data: {
        accountId: student.id,
        deviceFingerprint: DEVICE,
        isPrimary: true,
        label: 'E2E Primary',
      },
    });

    studentCookie = await studentLogin(DEVICE);
  });

  afterAll(async () => {
    if (courseId) {
      await db.offlineAccessCode.deleteMany({ where: { courseId } });
      await db.offlineAccessCodeBatch.deleteMany({ where: { courseId } });
      const products = await db.product.findMany({
        where: {
          organizationId: (await db.organization.findFirst({
            where: { slug: 'bahrawy-academy-dev' },
          }))!.id,
          code: `course-${courseId}`,
        },
        select: { id: true },
      });
      await db.entitlement.deleteMany({
        where: { productId: { in: products.map((p) => p.id) } },
      });
      await db.productCourse.deleteMany({
        where: { courseId, productId: { in: products.map((p) => p.id) } },
      });
      await db.product.deleteMany({
        where: { id: { in: products.map((p) => p.id) } },
      });
      await db.course.delete({ where: { id: courseId } });
    }
    const student = await db.account.findFirst({
      where: {
        emailHmac: security.generateEmailHmac(`offline-${SUFFIX}@bahrawy.test`),
      },
    });
    if (student) {
      await db.entitlement.deleteMany({ where: { accountId: student.id } });
      await db.offlineAccessCode.deleteMany({
        where: { accountId: student.id },
      });
      await db.authSession.deleteMany({ where: { accountId: student.id } });
      await db.studentDevice.deleteMany({ where: { accountId: student.id } });
      await db.securityEvent.deleteMany({ where: { accountId: student.id } });
      await db.auditEvent.deleteMany({
        where: { OR: [{ actorId: student.id }, { targetId: student.id }] },
      });
      await db.studentProfile.deleteMany({ where: { accountId: student.id } });
      await db.account.delete({ where: { id: student.id } });
    }
    if (app) await app.close();
  });

  it('generates a batch of codes via the admin endpoint', async () => {
    const token = await csrf(staffCookie);
    const res = await request(app.getHttpServer())
      .post('/admin/v1/offline-codes/generate')
      .set('Cookie', staffCookie)
      .set('x-csrf-token', token)
      .send({ quantity: 2, courseId, gradeId, maxUses: 1 })
      .expect(201);

    const data = res.body.data ?? res.body;
    expect(data.codes).toHaveLength(2);
    for (const item of data.codes) {
      expect(item.code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    }
    generated = data.codes[0];
    batchId = data.batch.id;
    expect(batchId).toBeDefined();
  });

  it('lists codes without exposing full values', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/v1/offline-codes?page=1&pageSize=25')
      .set('Cookie', staffCookie)
      .expect(200);

    const data = res.body.data ?? res.body;
    expect(data.total).toBeGreaterThanOrEqual(2);
    const item = data.items.find((entry: any) => entry.id === generated.id);
    expect(item).toBeDefined();
    expect(item.code).toContain('****');
    expect(item.status).toBe('ACTIVE');
  });

  it('rejects activation of an invalid code', async () => {
    const token = await csrf(studentCookie);
    const res = await request(app.getHttpServer())
      .post('/student/offline-codes/activate')
      .set('Cookie', studentCookie)
      .set('x-device-fingerprint', DEVICE)
      .set('x-csrf-token', token)
      .send({ code: 'ZZZZ-YYYY-XXXX' })
      .expect(400);
    expect(res.body.message).toBe('الكود غير صحيح');
  });

  it('activates a valid code and creates the course entitlement', async () => {
    const token = await csrf(studentCookie);
    const res = await request(app.getHttpServer())
      .post('/student/offline-codes/activate')
      .set('Cookie', studentCookie)
      .set('x-device-fingerprint', DEVICE)
      .set('x-csrf-token', token)
      .send({ code: generated.code })
      .expect(200);

    const data = res.body.data ?? res.body;
    expect(data.courseId).toBe(courseId);

    const code = await db.offlineAccessCode.findUnique({
      where: { id: generated.id },
    });
    expect(code?.status).toBe('USED');
    expect(code?.useCount).toBe(1);

    const account = await db.account.findFirst({
      where: {
        emailHmac: security.generateEmailHmac(`offline-${SUFFIX}@bahrawy.test`),
      },
    });
    const product = await db.product.findFirst({
      where: { code: `course-${courseId}` },
    });
    expect(product).toBeDefined();
    const entitlement = await db.entitlement.findFirst({
      where: {
        accountId: account!.id,
        productId: product!.id,
        status: 'ACTIVE',
      },
    });
    expect(entitlement).toBeDefined();
  });

  it('rejects a second activation of the same single-use code', async () => {
    const token = await csrf(studentCookie);
    const res = await request(app.getHttpServer())
      .post('/student/offline-codes/activate')
      .set('Cookie', studentCookie)
      .set('x-device-fingerprint', DEVICE)
      .set('x-csrf-token', token)
      .send({ code: generated.code })
      .expect(400);
    expect(res.body.message).toBe('الكود مستخدم بالفعل');
  });

  it('shows the course in the student dashboard after activation', async () => {
    const res = await request(app.getHttpServer())
      .get('/dashboard/student')
      .set('Cookie', studentCookie)
      .set('x-device-fingerprint', DEVICE)
      .expect(200);

    const data = res.body.data ?? res.body;
    const enrolled = (data.enrolledCourses ?? []).map(
      (course: any) => course.id,
    );
    expect(enrolled).toContain(courseId);
  });

  it('exports the batch codes (decrypted) for the staff admin', async () => {
    const res = await request(app.getHttpServer())
      .get(`/admin/v1/offline-codes/batches/${batchId}/export`)
      .set('Cookie', staffCookie)
      .expect(200);

    const data = res.body.data ?? res.body;
    expect(data.codes).toHaveLength(2);
    expect(data.codes.map((code: any) => code.code)).toContain(generated.code);
  });

  it('lists batches with usage statistics', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/v1/offline-codes/batches/list?page=1&pageSize=25')
      .set('Cookie', staffCookie)
      .expect(200);

    const data = res.body.data ?? res.body;
    const batch = data.items.find((entry: any) => entry.id === batchId);
    expect(batch).toBeDefined();
    expect(batch.quantity).toBe(2);
    expect(batch.usedCount).toBe(1);
  });
});
