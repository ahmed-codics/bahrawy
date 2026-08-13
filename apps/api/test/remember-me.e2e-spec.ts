import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { AppModule } from './../src/app.module';
import { db } from '@bahrawy/db';
import { SecurityService } from './../src/security/security.service';

const SUFFIX = Date.now().toString(36);
const PASSWORD = 'RememberMe!2026';
const DEVICE = `e2e-remember-${SUFFIX}`;

const COOKIE_NAME = 'bahrawy_session_student';

describe('Remember Me - E2E', () => {
  let app: INestApplication<App>;
  let studentId: string;

  const security = new SecurityService();

  const phone = `+20${SUFFIX.replace(/\D/g, '').slice(-10).padStart(10, '1')}1`;

  async function login(rememberMe: boolean): Promise<request.Response> {
    return request(app.getHttpServer())
      .post('/auth/login')
      .set('x-device-fingerprint', DEVICE)
      .set('user-agent', 'E2E-RememberMe-Agent')
      .send({ phone, password: PASSWORD, rememberMe });
  }

  async function csrf(cookie: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .get('/auth/csrf-token')
      .set('Cookie', cookie)
      .expect(200);
    return (res.body.data ?? res.body).csrfToken as string;
  }

  function cookieToken(res: request.Response): string {
    const raw = (res.headers['set-cookie'] ?? []).find((c: string) =>
      c.startsWith(COOKIE_NAME),
    );
    expect(raw).toBeDefined();
    return raw.split(';')[0];
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    await app.init();

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

    const passwordHash = await security.hashPassword(PASSWORD);
    const student = await db.account.create({
      data: {
        organizationId: organization!.id,
        kind: 'STUDENT',
        status: 'ACTIVE',
        phoneEncrypted: security.encrypt(phone),
        phoneHmac: security.generatePhoneHmac(phone),
        emailEncrypted: security.encrypt(`remember-${SUFFIX}@bahrawy.test`),
        emailHmac: security.generateEmailHmac(
          `remember-${SUFFIX}@bahrawy.test`,
        ),
        passwordHash,
        mustChangePassword: false,
        studentProfile: {
          create: {
            gradeId: grade!.id,
            displayName: `RememberMe E2E ${SUFFIX}`,
            firstName: 'Remember',
            secondName: 'Me',
            thirdName: 'E2E',
            lastName: SUFFIX,
          },
        },
      },
    });
    studentId = student.id;

    await db.studentDevice.create({
      data: {
        accountId: student.id,
        deviceFingerprint: DEVICE,
        isPrimary: true,
        label: 'E2E Primary',
      },
    });
  });

  afterAll(async () => {
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

  it('normal login (rememberMe=false) sets a session cookie with no Max-Age and 1h idle / 7d absolute', async () => {
    const res = await login(false);
    expect([200, 201]).toContain(res.status);

    const setCookie = res.headers['set-cookie'] as string[];
    const rememberCookie = setCookie.find((c) => c.startsWith(COOKIE_NAME));
    expect(rememberCookie).toBeDefined();
    expect(rememberCookie).not.toMatch(/Max-Age|Expires/i);
    expect(rememberCookie).toMatch(/HttpOnly/i);
    expect(rememberCookie).toMatch(/SameSite=Lax/i);

    const session = await db.authSession.findFirst({
      where: { accountId: studentId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    expect(session).toBeDefined();
    expect(session!.rememberMe).toBe(false);
    const idleMs = session!.idleExpiresAt.getTime() - Date.now();
    const absoluteMs = session!.absoluteExpiresAt.getTime() - Date.now();
    expect(idleMs).toBeGreaterThanOrEqual(1000 * 60 * 59);
    expect(idleMs).toBeLessThanOrEqual(1000 * 60 * 61);
    expect(absoluteMs).toBeGreaterThanOrEqual(1000 * 60 * 60 * 24 * 6);
    expect(absoluteMs).toBeLessThanOrEqual(1000 * 60 * 60 * 24 * 7 + 5000);
  });

  it('rememberMe=true sets a persistent cookie with Max-Age and a 30d session', async () => {
    const res = await login(true);
    expect([200, 201]).toContain(res.status);

    const setCookie = res.headers['set-cookie'] as string[];
    const rememberCookie = setCookie.find((c) => c.startsWith(COOKIE_NAME));
    expect(rememberCookie).toBeDefined();
    expect(rememberCookie).toMatch(/Max-Age=2592000/i);
    expect(rememberCookie).toMatch(/HttpOnly/i);

    const session = await db.authSession.findFirst({
      where: { accountId: studentId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    expect(session!.rememberMe).toBe(true);
    const idleMs = session!.idleExpiresAt.getTime() - Date.now();
    const absoluteMs = session!.absoluteExpiresAt.getTime() - Date.now();
    expect(idleMs).toBeGreaterThanOrEqual(1000 * 60 * 60 * 24 * 29);
    expect(absoluteMs).toBeGreaterThanOrEqual(1000 * 60 * 60 * 24 * 29);
    expect(absoluteMs).toBeLessThanOrEqual(1000 * 60 * 60 * 24 * 30 + 5000);
  });

  it('a persistent session survives a simulated browser restart (fresh cookie jar)', async () => {
    const res = await login(true);
    const cookie = cookieToken(res);

    // Brand new "browser": only the persisted cookie is carried over, no
    // localStorage or session data. The session must still be valid.
    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookie)
      .set('x-device-fingerprint', DEVICE);
    expect(me.status).toBe(200);
    expect(me.body.data?.accountId).toBe(studentId);
  });

  it('a normal (non-remember) session cookie has no Max-Age so browsers drop it on close', async () => {
    const res = await login(false);
    const setCookie = res.headers['set-cookie'] as string[];
    const normalCookie = setCookie.find((c) => c.startsWith(COOKIE_NAME));
    expect(normalCookie).not.toMatch(/Max-Age|Expires/i);
  });

  it('logout revokes the persistent session and the cookie cannot be reused', async () => {
    const res = await login(true);
    const cookie = cookieToken(res);
    const token = await csrf(cookie);

    const logout = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', cookie)
      .set('x-csrf-token', token)
      .set('x-device-fingerprint', DEVICE)
      .expect(201);
    expect((logout.body.data ?? logout.body).status).toBe('SUCCESS');

    const session = await db.authSession.findFirst({
      where: { accountId: studentId, revokedAt: { not: null } },
      orderBy: { revokedAt: 'desc' },
    });
    expect(session?.revokedReason).toBe('USER_LOGOUT');

    // Reusing the old cookie after logout must be rejected.
    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookie)
      .set('x-device-fingerprint', DEVICE);
    expect([401, 403]).toContain(me.status);
  });

  it('an expired absolute session is auto-revoked and rejected', async () => {
    const res = await login(false);
    const cookie = cookieToken(res);
    const session = await db.authSession.findFirst({
      where: { accountId: studentId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    expect(session).toBeDefined();

    await db.authSession.update({
      where: { id: session!.id },
      data: { absoluteExpiresAt: new Date(Date.now() - 1000) },
    });

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookie)
      .set('x-device-fingerprint', DEVICE);
    expect([401, 403]).toContain(me.status);

    const expired = await db.authSession.findUnique({
      where: { id: session!.id },
    });
    expect(expired?.revokedReason).toBe('EXPIRED');
  });

  it('an idle-expired session is rejected even if absolute is still valid', async () => {
    const res = await login(true);
    const cookie = cookieToken(res);
    const session = await db.authSession.findFirst({
      where: { accountId: studentId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    expect(session).toBeDefined();

    await db.authSession.update({
      where: { id: session!.id },
      data: { idleExpiresAt: new Date(Date.now() - 1000) },
    });

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookie)
      .set('x-device-fingerprint', DEVICE);
    expect([401, 403]).toContain(me.status);
  });

  it('suspending the account revokes even remember-me sessions', async () => {
    const res = await login(true);
    const cookie = cookieToken(res);

    await db.account.update({
      where: { id: studentId },
      data: { status: 'SUSPENDED' },
    });

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookie)
      .set('x-device-fingerprint', DEVICE);
    expect([401, 403]).toContain(me.status);

    const sessions = await db.authSession.findMany({
      where: { accountId: studentId },
    });
    expect(sessions.length).toBeGreaterThan(0);
    const created = await db.authSession.findFirst({
      where: { accountId: studentId, rememberMe: true },
      orderBy: { createdAt: 'desc' },
    });
    expect(created?.revokedAt).not.toBeNull();

    await db.account.update({
      where: { id: studentId },
      data: { status: 'ACTIVE' },
    });
  });

  it('password change revokes all sessions including remember-me ones', async () => {
    const res = await login(true);
    const cookie = cookieToken(res);
    const token = await csrf(cookie);

    const change = await request(app.getHttpServer())
      .post('/auth/change-password')
      .set('Cookie', cookie)
      .set('x-csrf-token', token)
      .set('x-device-fingerprint', DEVICE)
      .send({ oldPassword: PASSWORD, newPassword: 'Changed!2026' })
      .expect(201);
    expect((change.body.data ?? change.body).status).toBe('SUCCESS');

    const revoked = await db.authSession.findMany({
      where: { accountId: studentId, revokedAt: { not: null } },
    });
    expect(revoked.some((s) => s.revokedReason === 'PASSWORD_CHANGED')).toBe(
      true,
    );

    // Password changed — new sessions must use the new password.
    await db.account.update({
      where: { id: studentId },
      data: { passwordHash: await security.hashPassword(PASSWORD) },
    });
  });

  it('a revoked session token is rejected', async () => {
    const res = await login(false);
    const cookie = cookieToken(res);
    const session = await db.authSession.findFirst({
      where: { accountId: studentId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    await db.authSession.update({
      where: { id: session!.id },
      data: { revokedAt: new Date(), revokedReason: 'TEST_REVOKE' },
    });

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookie)
      .set('x-device-fingerprint', DEVICE);
    expect([401, 403]).toContain(me.status);
  });

  it('an invalid/expired cookie is rejected', async () => {
    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', `${COOKIE_NAME}=not-a-valid-token;`)
      .set('x-device-fingerprint', DEVICE);
    expect([401, 403]).toContain(me.status);
  });
});
