import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { AppModule } from './../src/app.module';
import { db } from '@bahrawy/db';

describe('Exam Results Reporting (admin-v1) - E2E', () => {
  let app: INestApplication<App>;
  let staffCookie: string | undefined;
  let studentCookie: string | undefined;

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
    if (staffLogin.status === 201 || staffLogin.status === 200) {
      staffCookie = staffLogin.headers['set-cookie']?.[0];
    }

    const studentLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ phone: '+201000000001', password: 'student_secret' });
    if (studentLogin.status === 201 || studentLogin.status === 200) {
      studentCookie = studentLogin.headers['set-cookie']?.[0];
    }
  });

  afterAll(async () => {
    await db.$disconnect();
    await app.close();
  });

  it('rejects unauthenticated access', async () => {
    await request(app.getHttpServer())
      .get('/admin/v1/exam-results')
      .expect(401);
  });

  it('rejects a student account (RBAC + tenant session guard)', async () => {
    if (!studentCookie) return;
    await request(app.getHttpServer())
      .get('/admin/v1/exam-results')
      .set('Cookie', studentCookie)
      .expect(403);
  });

  it('returns a valid results payload for staff', async () => {
    if (!staffCookie) return;
    const response = await request(app.getHttpServer())
      .get('/admin/v1/exam-results?page=1&pageSize=25')
      .set('Cookie', staffCookie)
      .expect(200);

    const data = response.body.data as {
      items: unknown[];
      meta: {
        page: number;
        pageSize: number;
        total: number;
        pageCount: number;
      };
      summary: {
        examined: number;
        highest: number;
        average: number;
        passed: number;
      };
      grades: unknown[];
      exams: unknown[];
    };
    expect(data).toBeDefined();
    expect(data.items).toBeInstanceOf(Array);
    expect(data.meta).toBeDefined();
    expect(data.summary).toBeDefined();
    expect(data.grades).toBeInstanceOf(Array);
    expect(data.exams).toBeInstanceOf(Array);
  });

  it('applies grade + exam filters together and clamps page size', async () => {
    if (!staffCookie) return;
    const response = await request(app.getHttpServer())
      .get(
        '/admin/v1/exam-results?gradeId=not-a-grade&assessmentId=not-an-exam&pageSize=100000',
      )
      .set('Cookie', staffCookie)
      .expect(200);

    const data = response.body.data as {
      items: unknown[];
      meta: { pageSize: number };
    };
    expect(data.items).toHaveLength(0);
    expect(data.meta.pageSize).toBeLessThanOrEqual(100);
  });

  it('never exposes answer keys or account secrets in the payload', async () => {
    if (!staffCookie) return;
    const response = await request(app.getHttpServer())
      .get('/admin/v1/exam-results')
      .set('Cookie', staffCookie)
      .expect(200);

    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('passwordHash');
    expect(serialized).not.toContain('tokenHash');
    expect(serialized).not.toContain('correctOptionId');
    expect(serialized).not.toContain('autosavedAnswers');
  });
});
