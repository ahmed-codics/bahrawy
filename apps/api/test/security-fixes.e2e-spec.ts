import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { AppModule } from './../src/app.module';
import { db } from '@bahrawy/db';

const FORBIDDEN_KEYS = [
  'passwordHash',
  'phoneHmac',
  'emailHmac',
  'phoneEncrypted',
  'emailEncrypted',
  'mustChangePassword',
  'tokenHash',
];

function collectKeys(value: unknown, keys: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys);
    return keys;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      keys.push(k);
      collectKeys(v, keys);
    }
  }
  return keys;
}

describe('Security fixes H1-H5 (admin-v1) - E2E', () => {
  let app: INestApplication<App>;
  let ownerCookie: string;
  let studentCookie: string;
  const createdStaffIds: string[] = [];

  async function login(email: string, password: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/staff-login')
      .send({ email, password });
    expect([200, 201]).toContain(res.status);
    return (res.headers['set-cookie']?.[0] ?? '').split(';')[0];
  }

  async function csrf(cookie: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .get('/auth/csrf-token')
      .set('Cookie', cookie)
      .expect(200);
    return (res.body.data ?? res.body).csrfToken as string;
  }

  async function createStaff(
    displayName: string,
    roleIds: string[],
  ): Promise<{ id: string; email: string; password: string }> {
    const token = await csrf(ownerCookie);
    const email = `${displayName.toLowerCase().replace(/\s+/g, '.')}.${Date.now()}@bahrawy.test`;
    const res = await request(app.getHttpServer())
      .post('/admin/v1/management/staff')
      .set('Cookie', ownerCookie)
      .set('x-csrf-token', token)
      .send({ displayName, email, roleIds })
      .expect(201);
    const body = res.body.data ?? res.body;
    const id = body.staff.id;
    createdStaffIds.push(id);
    return { id, email, password: body.temporaryPassword as string };
  }

  async function onboard(
    email: string,
    temporaryPassword: string,
  ): Promise<string> {
    const first = await request(app.getHttpServer())
      .post('/auth/staff-login')
      .send({ email, password: temporaryPassword })
      .expect(201);
    const cookie = (first.headers['set-cookie']?.[0] ?? '').split(';')[0];
    const token = await csrf(cookie);
    const newPassword = 'NewPass_' + Math.random().toString(36).slice(2, 10);
    await request(app.getHttpServer())
      .post('/auth/change-password')
      .set('Cookie', cookie)
      .set('x-csrf-token', token)
      .send({ oldPasswordAr: temporaryPassword, newPasswordAr: newPassword })
      .expect(201);
    return login(email, newPassword);
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

    ownerCookie = await login('admin@bahrawy.test', 'owner_secret');
    const studentLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .set('x-device-fingerprint', 'e2e-shared-seed-device')
      .send({ phone: '+201000000001', password: 'student_secret' });
    studentCookie = (studentLogin.headers['set-cookie']?.[0] ?? '').split(
      ';',
    )[0];
  });

  afterAll(async () => {
    if (createdStaffIds.length) {
      await db.account.deleteMany({ where: { id: { in: createdStaffIds } } });
    }
    await db.$disconnect();
    await app.close();
  });

  it('H1: denies the dashboard to student / auditor / finance and allows owner', async () => {
    await request(app.getHttpServer())
      .get('/admin/v1/dashboard')
      .set('Cookie', studentCookie || 'invalid')
      .set('x-device-fingerprint', 'e2e-shared-seed-device')
      .expect(403);

    const roles = await request(app.getHttpServer())
      .get('/admin/v1/management/roles')
      .set('Cookie', ownerCookie)
      .expect(200);
    const roleList = (roles.body.data ?? roles.body) as {
      id: string;
      code: string;
    }[];
    const financeRole = roleList.find((r) => r.code === 'FINANCE')!;
    const auditorRole = roleList.find((r) => r.code === 'READ_ONLY_AUDITOR')!;

    const finance = await createStaff('Finance Tester', [financeRole.id]);
    const auditor = await createStaff('Auditor Tester', [auditorRole.id]);
    const financeCookie = await onboard(finance.email, finance.password);
    const auditorCookie = await onboard(auditor.email, auditor.password);

    await request(app.getHttpServer())
      .get('/admin/v1/dashboard')
      .set('Cookie', financeCookie)
      .expect(403);
    await request(app.getHttpServer())
      .get('/admin/v1/dashboard')
      .set('Cookie', auditorCookie)
      .expect(403);

    await request(app.getHttpServer())
      .get('/admin/v1/dashboard')
      .set('Cookie', ownerCookie)
      .expect(200);
  });

  it('H2: student detail never emits forbidden Account internals', async () => {
    const student = await db.studentProfile.findFirst({
      where: { account: { kind: 'STUDENT', deletedAt: null } },
    });
    expect(student).toBeTruthy();

    const detail = await request(app.getHttpServer())
      .get(`/admin/v1/students/${student!.id}`)
      .set('Cookie', ownerCookie)
      .expect(200);
    const body = JSON.stringify(detail.body, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    );
    for (const key of FORBIDDEN_KEYS) {
      expect(body).not.toContain(`"${key}"`);
    }
  });

  it('H3: staff list never emits forbidden Account internals', async () => {
    const res = await request(app.getHttpServer())
      .get('/admin/v1/management/staff?pageSize=50')
      .set('Cookie', ownerCookie)
      .expect(200);
    const items = (res.body.data ?? res.body).items as unknown[];
    expect(items.length).toBeGreaterThan(0);
    const keys = new Set(collectKeys(items));
    for (const key of FORBIDDEN_KEYS) {
      expect(keys.has(key)).toBe(false);
    }
  });

  it('H4: mustChangePassword session can fetch CSRF token then change password', async () => {
    const roles = await request(app.getHttpServer())
      .get('/admin/v1/management/roles')
      .set('Cookie', ownerCookie)
      .expect(200);
    const roleList = (roles.body.data ?? roles.body) as {
      id: string;
      code: string;
    }[];
    const supportRole = roleList.find((r) => r.code === 'SUPPORT')!;
    const created = await createStaff('Password Flow Tester', [supportRole.id]);

    const firstLogin = await request(app.getHttpServer())
      .post('/auth/staff-login')
      .send({ email: created.email, password: created.password })
      .expect(201);
    const firstBody = firstLogin.body.data ?? firstLogin.body;
    expect(firstBody.mustChangePassword).toBe(true);
    const cookie = (firstLogin.headers['set-cookie']?.[0] ?? '').split(';')[0];

    const token = await csrf(cookie);
    expect(typeof token).toBe('string');

    const newPassword = 'NewPass_' + Math.random().toString(36).slice(2, 10);
    await request(app.getHttpServer())
      .post('/auth/change-password')
      .set('Cookie', cookie)
      .set('x-csrf-token', token)
      .send({
        oldPasswordAr: created.password,
        newPasswordAr: newPassword,
      })
      .expect(201);

    const afterChange = await request(app.getHttpServer())
      .post('/auth/staff-login')
      .send({ email: created.email, password: newPassword })
      .expect(201);
    expect((afterChange.body.data ?? afterChange.body).mustChangePassword).toBe(
      false,
    );
  });

  it('H5: invalid course status returns 400, valid/missing returns 200', async () => {
    const csrfToken = await csrf(ownerCookie);
    await request(app.getHttpServer())
      .get('/admin/v1/courses?status=BOGUS')
      .set('Cookie', ownerCookie)
      .set('x-csrf-token', csrfToken)
      .expect(400);

    await request(app.getHttpServer())
      .get('/admin/v1/courses?status=DRAFT')
      .set('Cookie', ownerCookie)
      .expect(200);
    await request(app.getHttpServer())
      .get('/admin/v1/courses?status=PUBLISHED')
      .set('Cookie', ownerCookie)
      .expect(200);
    await request(app.getHttpServer())
      .get('/admin/v1/courses?status=ARCHIVED')
      .set('Cookie', ownerCookie)
      .expect(200);
    await request(app.getHttpServer())
      .get('/admin/v1/courses')
      .set('Cookie', ownerCookie)
      .expect(200);
  });
});
