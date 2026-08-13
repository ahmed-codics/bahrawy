import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { AppModule } from './../src/app.module';
import { db } from '@bahrawy/db';
import { SecurityService } from './../src/security/security.service';

const SUFFIX = `${Date.now().toString(36)}`;
const PASSWORD = 'E2eDeviceLock!2026';
const DEVICE_A = `e2e-device-a-${SUFFIX}`;
const DEVICE_B = `e2e-device-b-${SUFFIX}`;
const DEVICE_C = `e2e-device-c-${SUFFIX}`;

describe('Device Lock - E2E', () => {
  let app: INestApplication<App>;
  let staffCookie: string | undefined;
  let studentId: string;
  let gradeId: string;

  const security = new SecurityService();

  async function csrf(cookie: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .get('/auth/csrf-token')
      .set('Cookie', cookie)
      .expect(200);
    return (res.body.data ?? res.body).csrfToken as string;
  }

  async function login(deviceFingerprint: string): Promise<request.Response> {
    return request(app.getHttpServer())
      .post('/auth/login')
      .set('x-device-fingerprint', deviceFingerprint)
      .set('user-agent', 'E2E-Jest-Agent')
      .send({
        phone: `+20${SUFFIX.replace(/\D/g, '').slice(-10).padStart(10, '1')}1`,
        password: PASSWORD,
      });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    await app.init();

    const staffLogin = await request(app.getHttpServer())
      .post('/auth/staff-login')
      .send({ email: 'admin@bahrawy.test', password: 'owner_secret' });
    if ([200, 201].includes(staffLogin.status)) {
      staffCookie = staffLogin.headers['set-cookie']?.[0];
    }
    expect(staffCookie).toBeDefined();

    const organization = await db.organization.findFirst({
      where: { slug: 'bahrawy-academy-dev' },
      select: { id: true },
    });
    expect(organization).toBeDefined();

    const grade = await db.grade.findFirst({
      where: { organizationId: organization!.id, status: 'ACTIVE' },
      select: { id: true },
    });
    expect(grade).toBeDefined();
    gradeId = grade!.id;

    const phone = `+20${SUFFIX.replace(/\D/g, '').slice(-10).padStart(10, '1')}1`;
    const passwordHash = await security.hashPassword(PASSWORD);

    const student = await db.account.create({
      data: {
        organizationId: organization!.id,
        kind: 'STUDENT',
        status: 'ACTIVE',
        phoneEncrypted: security.encrypt(phone),
        phoneHmac: security.generatePhoneHmac(phone),
        emailEncrypted: security.encrypt(`device-lock-${SUFFIX}@bahrawy.test`),
        emailHmac: security.generateEmailHmac(
          `device-lock-${SUFFIX}@bahrawy.test`,
        ),
        passwordHash,
        mustChangePassword: false,
        studentProfile: {
          create: {
            gradeId: grade!.id,
            displayName: `DeviceLock E2E ${SUFFIX}`,
            firstName: 'DeviceLock',
            secondName: 'E2E',
            thirdName: 'Test',
            lastName: SUFFIX,
          },
        },
      },
    });
    studentId = student.id;

    await db.studentDevice.create({
      data: {
        accountId: student.id,
        deviceFingerprint: DEVICE_A,
        isPrimary: true,
        label: 'E2E Primary',
      },
    });
  });

  afterAll(async () => {
    await db.deviceBlock.deleteMany({ where: { accountId: studentId } });
    await db.authSession.deleteMany({ where: { accountId: studentId } });
    await db.studentDevice.deleteMany({ where: { accountId: studentId } });
    await db.securityEvent.deleteMany({ where: { accountId: studentId } });
    await db.auditEvent.deleteMany({
      where: { OR: [{ targetId: studentId }, { actorId: studentId }] },
    });
    await db.studentProfile.deleteMany({ where: { accountId: studentId } });
    await db.account.delete({ where: { id: studentId } });
    if (app) await app.close();
  });

  it('allows login from the bound primary device', async () => {
    const res = await login(DEVICE_A);
    expect([200, 201]).toContain(res.status);
    expect(res.body.data?.status ?? res.body.status).toBe('SUCCESS');
  });

  it('blocks an unknown device and flips the account to DEVICE_BLOCKED', async () => {
    const res = await login(DEVICE_B);
    expect(res.status).toBe(403);

    const blocked = await db.account.findUnique({ where: { id: studentId } });
    expect(blocked?.status).toBe('DEVICE_BLOCKED');

    const block = await db.deviceBlock.findFirst({
      where: { accountId: studentId, resolvedAt: null },
      orderBy: { blockedAt: 'desc' },
    });
    expect(block).toBeDefined();
    expect(block?.deviceFingerprint).toBe(DEVICE_B);
    expect(block?.previousStatus).toBe('ACTIVE');
    expect(block?.ipAddress).toBeTruthy();
    expect(block?.userAgent).toBe('E2E-Jest-Agent');

    const securityEvent = await db.securityEvent.findFirst({
      where: { accountId: studentId },
      orderBy: { createdAt: 'desc' },
    });
    expect(securityEvent?.eventType).toBe('DEVICE_MISMATCH');
    expect((securityEvent?.metadata as any)?.attemptedDeviceId).toBeTruthy();
  });

  it('lists the blocked student in the admin device-locks endpoint', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/v1/device-locks')
      .set('Cookie', staffCookie!)
      .expect(200);
    const items = (res.body.data ?? res.body).items as any[];
    const item = items.find((entry) => entry.accountId === studentId);
    expect(item).toBeDefined();
    expect(item.studentNumber).toBeDefined();
    expect(item.blockReason).toBe('UNKNOWN_DEVICE');
    expect(item.previousStatus).toBe('ACTIVE');
    expect(item.ipAddress).toBeTruthy();
    expect(item.userAgent).toBe('E2E-Jest-Agent');
    expect(item.attemptCount).toBeGreaterThanOrEqual(1);
    expect(item.attemptedDevice.fingerprint).toContain('…');
    expect(item.gradeId).toBe(gradeId);
  });

  it('unlocks the account and restores its previous status', async () => {
    const token = await csrf(staffCookie!);
    const res = await request(app.getHttpServer())
      .post(`/admin/v1/device-locks/${studentId}/unlock`)
      .set('Cookie', staffCookie!)
      .set('x-csrf-token', token)
      .expect(201);

    const data = res.body.data ?? res.body;
    expect(data.status).toBe('ACTIVE');

    const openBlock = await db.deviceBlock.findFirst({
      where: { accountId: studentId, resolvedAt: null },
    });
    expect(openBlock).toBeNull();

    const audit = await db.auditEvent.findFirst({
      where: { targetId: studentId, action: 'ADMIN_DEVICE_UNLOCK' },
    });
    expect(audit).toBeDefined();
    expect(audit?.before).toEqual({ status: 'DEVICE_BLOCKED' });
    expect(audit?.after).toEqual({ status: 'ACTIVE' });
  });

  it('re-blocks then allow-device promotes the offending device to primary', async () => {
    await login(DEVICE_B);
    const blocked = await db.account.findUnique({ where: { id: studentId } });
    expect(blocked?.status).toBe('DEVICE_BLOCKED');

    const token = await csrf(staffCookie!);
    const res = await request(app.getHttpServer())
      .post(`/admin/v1/device-locks/${studentId}/allow-device`)
      .set('Cookie', staffCookie!)
      .set('x-csrf-token', token)
      .expect(201);
    expect((res.body.data ?? res.body).status).toBe('ACTIVE');

    const primary = await db.studentDevice.findFirst({
      where: { accountId: studentId, isPrimary: true },
    });
    expect(primary?.deviceFingerprint).toBe(DEVICE_B);

    const audit = await db.auditEvent.findFirst({
      where: { targetId: studentId, action: 'ADMIN_DEVICE_ALLOW' },
    });
    expect(audit).toBeDefined();

    const allowed = await login(DEVICE_B);
    expect([200, 201]).toContain(allowed.status);
  });

  it('reset-primary clears all bound devices', async () => {
    await db.studentDevice.create({
      data: {
        accountId: studentId,
        deviceFingerprint: DEVICE_C,
        isPrimary: false,
      },
    });
    await db.deviceBlock.create({
      data: {
        accountId: studentId,
        deviceFingerprint: DEVICE_C,
        reason: 'UNKNOWN_DEVICE',
        previousStatus: 'ACTIVE',
      },
    });
    await db.account.update({
      where: { id: studentId },
      data: { status: 'DEVICE_BLOCKED' },
    });

    const token = await csrf(staffCookie!);
    const res = await request(app.getHttpServer())
      .post(`/admin/v1/device-locks/${studentId}/reset-primary`)
      .set('Cookie', staffCookie!)
      .set('x-csrf-token', token)
      .expect(201);
    expect((res.body.data ?? res.body).status).toBe('ACTIVE');

    const devices = await db.studentDevice.findMany({
      where: { accountId: studentId },
    });
    expect(devices).toHaveLength(0);

    const audit = await db.auditEvent.findFirst({
      where: { targetId: studentId, action: 'ADMIN_DEVICE_RESET' },
    });
    expect(audit).toBeDefined();
  });
});
