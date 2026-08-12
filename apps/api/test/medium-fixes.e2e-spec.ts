import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { AppModule } from './../src/app.module';
import { db } from '@bahrawy/db';

const VALID_QUESTION = {
  titleAr: 'M1 test question عاصمة مصر؟',
  options: [
    { id: '1', textAr: 'القاهرة' },
    { id: '2', textAr: 'الإسكندرية' },
  ],
  correctOptionId: '1',
  points: 1,
};

const UNIQUE_SUFFIX = `${Date.now()}`;

describe('Medium fixes M1 + M2 (admin-v1) - E2E', () => {
  let app: INestApplication<App>;
  let ownerCookie: string;
  const createdQuestionIds: string[] = [];

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
  });

  afterAll(async () => {
    if (createdQuestionIds.length) {
      await db.question.deleteMany({
        where: { id: { in: createdQuestionIds } },
      });
    }
    await db.$disconnect();
    await app.close();
  });

  async function createQuestion(payload: Record<string, unknown>) {
    const token = await csrf(ownerCookie);
    return request(app.getHttpServer())
      .post('/admin/v1/questions')
      .set('Cookie', ownerCookie)
      .set('x-csrf-token', token)
      .send(payload);
  }

  describe('M1: question option validation', () => {
    it('creates a valid question and persists it', async () => {
      const res = await createQuestion(VALID_QUESTION);
      expect(res.status).toBe(201);
      const body = res.body.data ?? res.body;
      expect(body.id).toBeTruthy();
      createdQuestionIds.push(body.id as string);
    });

    it('rejects correctOptionId that refers to no option', async () => {
      const res = await createQuestion({
        ...VALID_QUESTION,
        titleAr: `${UNIQUE_SUFFIX} bad-correct`,
        correctOptionId: 'zz',
      });
      expect(res.status).toBe(400);
    });

    it('rejects a missing correctOptionId', async () => {
      const { correctOptionId: _removed, ...rest } = VALID_QUESTION;
      void _removed;
      const res = await createQuestion({
        ...rest,
        titleAr: `${UNIQUE_SUFFIX} no-correct`,
      });
      expect(res.status).toBe(400);
    });

    it('rejects duplicate option ids', async () => {
      const res = await createQuestion({
        ...VALID_QUESTION,
        titleAr: `${UNIQUE_SUFFIX} dup-ids`,
        options: [
          { id: '1', text: 'A' },
          { id: '1', text: 'B' },
        ],
      });
      expect(res.status).toBe(400);
    });

    it('rejects an option missing its id', async () => {
      const res = await createQuestion({
        ...VALID_QUESTION,
        titleAr: `${UNIQUE_SUFFIX} no-option-id`,
        options: [{ id: '1', textAr: 'A' }, { textAr: 'B' }],
      });
      expect(res.status).toBe(400);
    });

    it('rejects an option missing a text-like field', async () => {
      const res = await createQuestion({
        ...VALID_QUESTION,
        titleAr: `${UNIQUE_SUFFIX} no-option-text`,
        options: [{ id: '1', textAr: 'A' }, { id: '2' }],
      });
      expect(res.status).toBe(400);
    });

    it('rejects options that are plain strings', async () => {
      const res = await createQuestion({
        ...VALID_QUESTION,
        titleAr: `${UNIQUE_SUFFIX} raw-strings`,
        options: ['not', 'objects'],
      });
      expect(res.status).toBe(400);
    });

    it('rejects fewer than two options', async () => {
      const res = await createQuestion({
        ...VALID_QUESTION,
        titleAr: `${UNIQUE_SUFFIX} one-option`,
        options: [{ id: '1', textAr: 'A' }],
      });
      expect(res.status).toBe(400);
    });

    it('never persists a rejected malformed question', async () => {
      const list = await request(app.getHttpServer())
        .get(`/admin/v1/questions?search=${UNIQUE_SUFFIX}&page=1&pageSize=25`)
        .set('Cookie', ownerCookie)
        .expect(200);
      const body = list.body.data ?? list.body;
      expect(body.items).toHaveLength(0);
    });

    it('updates a valid question when version matches', async () => {
      expect(createdQuestionIds.length).toBeGreaterThan(0);
      const token = await csrf(ownerCookie);
      const res = await request(app.getHttpServer())
        .patch(`/admin/v1/questions/${createdQuestionIds[0]}`)
        .set('Cookie', ownerCookie)
        .set('x-csrf-token', token)
        .send({
          ...VALID_QUESTION,
          titleAr: 'M1 test question updated',
          options: [
            { id: 'a', textAr: 'الخيار أ' },
            { id: 'b', textAr: 'الخيار ب' },
          ],
          correctOptionId: 'b',
          version: 1,
        });
      expect(res.status).toBe(200);
      const body = res.body.data ?? res.body;
      expect(body.options).toEqual([
        { id: 'a', textAr: 'الخيار أ' },
        { id: 'b', textAr: 'الخيار ب' },
      ]);
    });

    it('rejects an invalid option shape on update', async () => {
      expect(createdQuestionIds.length).toBeGreaterThan(0);
      const token = await csrf(ownerCookie);
      const res = await request(app.getHttpServer())
        .patch(`/admin/v1/questions/${createdQuestionIds[0]}`)
        .set('Cookie', ownerCookie)
        .set('x-csrf-token', token)
        .send({
          ...VALID_QUESTION,
          options: [
            { id: '1', textAr: 'A' },
            { id: '2', textAr: 'B' },
            { id: '2', textAr: 'dupe' },
          ],
          correctOptionId: '2',
          version: 1,
        });
      expect(res.status).toBe(400);
    });
  });

  describe('M2: pagination validation across admin-v1 list endpoints', () => {
    const PAGINATED: { path: string }[] = [
      { path: '/admin/v1/questions' },
      { path: '/admin/v1/exam-results' },
      { path: '/admin/v1/courses' },
      { path: '/admin/v1/products' },
      { path: '/admin/v1/students' },
      { path: '/admin/v1/support' },
      { path: '/admin/v1/management/staff' },
      { path: '/admin/v1/management/audit' },
      { path: '/admin/v1/payments' },
    ];

    it.each(PAGINATED)(
      'accepts valid pagination on $path',
      async ({ path }) => {
        const res = await request(app.getHttpServer())
          .get(`${path}?page=1&pageSize=25`)
          .set('Cookie', ownerCookie)
          .expect(200);
        const body = res.body.data ?? res.body;
        expect(body.meta).toBeDefined();
        expect(body.meta.page).toBe(1);
        expect(body.meta.pageSize).toBe(25);
      },
    );

    it.each(PAGINATED)('rejects page=0 on $path', async ({ path }) => {
      await request(app.getHttpServer())
        .get(`${path}?page=0&pageSize=25`)
        .set('Cookie', ownerCookie)
        .expect(400);
    });

    it.each(PAGINATED)('rejects a negative page on $path', async ({ path }) => {
      await request(app.getHttpServer())
        .get(`${path}?page=-1&pageSize=25`)
        .set('Cookie', ownerCookie)
        .expect(400);
    });

    it.each(PAGINATED)(
      'rejects a non-numeric page on $path',
      async ({ path }) => {
        await request(app.getHttpServer())
          .get(`${path}?page=abc&pageSize=25`)
          .set('Cookie', ownerCookie)
          .expect(400);
      },
    );

    it.each(PAGINATED)('rejects page size 0 on $path', async ({ path }) => {
      await request(app.getHttpServer())
        .get(`${path}?page=1&pageSize=0`)
        .set('Cookie', ownerCookie)
        .expect(400);
    });

    it.each(PAGINATED)(
      'rejects an oversized page size on $path',
      async ({ path }) => {
        await request(app.getHttpServer())
          .get(`${path}?page=1&pageSize=100000`)
          .set('Cookie', ownerCookie)
          .expect(400);
      },
    );

    it.each(PAGINATED)(
      'rejects a non-numeric page size on $path',
      async ({ path }) => {
        await request(app.getHttpServer())
          .get(`${path}?page=1&pageSize=abc`)
          .set('Cookie', ownerCookie)
          .expect(400);
      },
    );

    it.each(PAGINATED)(
      'rejects a decimal page size on $path',
      async ({ path }) => {
        await request(app.getHttpServer())
          .get(`${path}?page=1&pageSize=25.5`)
          .set('Cookie', ownerCookie)
          .expect(400);
      },
    );

    it('still allows the maximum page size of 100', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/v1/questions?page=1&pageSize=100')
        .set('Cookie', ownerCookie)
        .expect(200);
      const body = res.body.data ?? res.body;
      expect(body.meta.pageSize).toBe(100);
    });
  });
});
