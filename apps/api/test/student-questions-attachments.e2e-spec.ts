import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';
import { AppModule } from './../src/app.module';
import { db } from '@bahrawy/db';

const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAMAAAACCAIAAAASFvFNAAAAEElEQVR4nGM4IRcFQQxwFgBNqAeBaqhD4AAAAABJRU5ErkJggg==';
const PNG_BUFFER = Buffer.from(PNG_BASE64, 'base64');

describe('Student Questions image attachments (E2E)', () => {
  let app: INestApplication<App>;
  let studentCookie: string;
  let studentFingerprint: string;
  let ownerCookie: string;
  const createdStoredObjectIds: string[] = [];
  let createdQuestionId: string | null = null;
  let createdVoiceQuestionId: string | null = null;

  async function loginStudent(): Promise<void> {
    const account = await db.studentDevice.findFirst({
      where: { deviceFingerprint: '6e56bafa-3b4b-4643-9026-d0111a716598' },
      select: { accountId: true },
    });
    const primary = account
      ? await db.studentDevice.findFirst({
          where: { accountId: account.accountId, isPrimary: true },
          select: { deviceFingerprint: true },
        })
      : null;
    studentFingerprint =
      primary?.deviceFingerprint ?? '6e56bafa-3b4b-4643-9026-d0111a716598';
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .set('x-device-fingerprint', studentFingerprint)
      .send({ phone: '01091444524', password: 'student_secret' })
      .expect(201);
    studentCookie = (res.headers['set-cookie']?.[0] ?? '').split(';')[0];
  }

  async function csrf(cookie: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .get('/auth/csrf-token')
      .set('Cookie', cookie)
      .expect(200);
    return (res.body.data ?? res.body).csrfToken as string;
  }

  async function uploadStudent(
    buffer: Buffer,
    filename: string,
    contentType: string,
    expectStatus: number,
  ): Promise<string> {
    const token = await csrf(studentCookie);
    const res = await request(app.getHttpServer())
      .post('/student/questions/uploads')
      .set('Cookie', studentCookie)
      .set('x-device-fingerprint', studentFingerprint)
      .set('x-csrf-token', token)
      .attach('file', buffer, { filename, contentType })
      .expect(expectStatus);
    return (res.body.data ?? res.body)?.storedObjectId as string;
  }

  async function uploadOwner(
    buffer: Buffer,
    filename: string,
    contentType: string,
  ): Promise<string> {
    const token = await csrf(ownerCookie);
    const res = await request(app.getHttpServer())
      .post('/admin/v1/student-questions/uploads')
      .set('Cookie', ownerCookie)
      .set('x-csrf-token', token)
      .attach('file', buffer, { filename, contentType })
      .expect(201);
    return (res.body.data ?? res.body).storedObjectId as string;
  }

  async function uploadStudentVoice(
    buffer: Buffer,
    filename = 'rec.webm',
    contentType = 'audio/webm',
    expectStatus = 201,
  ): Promise<string> {
    const token = await csrf(studentCookie);
    const res = await request(app.getHttpServer())
      .post('/student/questions/uploads/voice')
      .set('Cookie', studentCookie)
      .set('x-device-fingerprint', studentFingerprint)
      .set('x-csrf-token', token)
      .attach('file', buffer, { filename, contentType })
      .expect(expectStatus);
    return (res.body.data ?? res.body)?.storedObjectId as string;
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

    await loginStudent();
    const owner = await request(app.getHttpServer())
      .post('/auth/staff-login')
      .send({ email: 'admin@bahrawy.test', password: 'owner_secret' })
      .expect(201);
    ownerCookie = (owner.headers['set-cookie']?.[0] ?? '').split(';')[0];
  });

  afterAll(async () => {
    for (const questionId of [createdQuestionId, createdVoiceQuestionId]) {
      if (!questionId) continue;
      const attachments = await db.studentQuestionAttachment.findMany({
        where: { message: { questionId } },
        select: { storedObjectId: true },
      });
      await db.studentQuestionMessage.deleteMany({
        where: { questionId },
      });
      await db.studentQuestion.delete({ where: { id: questionId } });
      for (const a of attachments)
        createdStoredObjectIds.push(a.storedObjectId);
    }
    if (createdStoredObjectIds.length) {
      await db.storedObject.deleteMany({
        where: { id: { in: createdStoredObjectIds } },
      });
    }
    await db.$disconnect();
    await app.close();
  });

  it('rejects a non-image upload with an Arabic message', async () => {
    await request(app.getHttpServer())
      .post('/student/questions/uploads')
      .set('Cookie', studentCookie)
      .set('x-device-fingerprint', studentFingerprint)
      .set('x-csrf-token', await csrf(studentCookie))
      .attach('file', Buffer.from('%PDF-1.4 not an image'), {
        filename: 'doc.png',
        contentType: 'image/png',
      })
      .expect(400)
      .expect((res) => {
        expect(res.body.code).toBe('INVALID_MIME_TYPE');
      });
  });

  it('rejects a file larger than 5 MB', async () => {
    const big = Buffer.alloc(5 * 1024 * 1024 + 1, 0x89);
    await request(app.getHttpServer())
      .post('/student/questions/uploads')
      .set('Cookie', studentCookie)
      .set('x-device-fingerprint', studentFingerprint)
      .set('x-csrf-token', await csrf(studentCookie))
      .attach('file', big, { filename: 'big.png', contentType: 'image/png' })
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toBe('حجم الصورة يجب ألا يتجاوز 5 ميجابايت');
      });
  });

  it('uploads a PNG, optimizes it to WebP, and streams it through a signed URL', async () => {
    const storedObjectId = await uploadStudent(
      PNG_BUFFER,
      'photo.png',
      'image/png',
      201,
    );
    expect(storedObjectId).toBeTruthy();
    createdStoredObjectIds.push(storedObjectId);

    const token = await csrf(studentCookie);
    const created = await request(app.getHttpServer())
      .post('/student/questions')
      .set('Cookie', studentCookie)
      .set('x-device-fingerprint', studentFingerprint)
      .set('x-csrf-token', token)
      .send({ message: 'سؤال مع صورة', attachmentIds: [storedObjectId] })
      .expect(201);
    const question = created.body.data ?? created.body;
    createdQuestionId = question.id;

    const detail = await request(app.getHttpServer())
      .get(`/student/questions/${createdQuestionId}`)
      .set('Cookie', studentCookie)
      .set('x-device-fingerprint', studentFingerprint)
      .expect(200);
    const messages = (detail.body.data ?? detail.body).messages;
    expect(messages[0].attachments).toHaveLength(1);
    const attachment = messages[0].attachments[0];
    expect(attachment.mimeType).toBe('image/webp');
    expect(attachment.url).toContain('/student/questions/');

    // No session cookie or fingerprint header — the signed URL must suffice.
    const image = await request(app.getHttpServer())
      .get(attachment.url)
      .expect(200);
    expect(image.headers['content-type']).toContain('image/webp');

    // Tampered token is rejected.
    const tampered = attachment.url.replace('token=', 'token=X');
    await request(app.getHttpServer()).get(tampered).expect(401);
  });

  it('denies attaching an arbitrary/nonexistent stored object', async () => {
    const token = await csrf(studentCookie);
    await request(app.getHttpServer())
      .post('/student/questions')
      .set('Cookie', studentCookie)
      .set('x-device-fingerprint', studentFingerprint)
      .set('x-csrf-token', token)
      .send({
        message: 'معرف وهمي',
        attachmentIds: ['00000000-0000-4000-8000-000000000000'],
      })
      .expect(400)
      .expect((res) => expect(res.body.code).toBe('INVALID_ATTACHMENT'));
  });

  it('rejects more than 3 attachments per message', async () => {
    const ids = [];
    for (let i = 0; i < 4; i++) {
      ids.push(await uploadStudent(PNG_BUFFER, `m${i}.png`, 'image/png', 201));
    }
    createdStoredObjectIds.push(...ids);
    const token = await csrf(studentCookie);
    await request(app.getHttpServer())
      .post('/student/questions')
      .set('Cookie', studentCookie)
      .set('x-device-fingerprint', studentFingerprint)
      .set('x-csrf-token', token)
      .send({ message: 'أربع صور', attachmentIds: ids })
      .expect(400);
  });

  it('exposes a voice policy endpoint for the recorder UI', async () => {
    const res = await request(app.getHttpServer())
      .get('/student/questions/policy')
      .set('Cookie', studentCookie)
      .set('x-device-fingerprint', studentFingerprint)
      .expect(200);
    const data = res.body.data ?? res.body;
    expect(data.maxVoiceCount).toBe(1);
    expect(data.maxVoiceSizeBytes).toBe(10 * 1024 * 1024);
    expect(data.maxVoiceDurationSeconds).toBe(180);
  });

  it('uploads a voice recording and rejects a non-audio file', async () => {
    const webm = Buffer.concat([
      Buffer.from([0x1a, 0x45, 0xdf, 0xa3]),
      Buffer.alloc(512),
    ]);
    const id = await uploadStudentVoice(webm);
    expect(id).toBeTruthy();
    createdStoredObjectIds.push(id);

    const res = await request(app.getHttpServer())
      .post('/student/questions/uploads/voice')
      .set('Cookie', studentCookie)
      .set('x-device-fingerprint', studentFingerprint)
      .set('x-csrf-token', await csrf(studentCookie))
      .attach('file', Buffer.from('plain text not audio'), {
        filename: 'rec.txt',
        contentType: 'text/plain',
      })
      .expect(400)
      .expect((r) => expect(r.body.code).toBe('INVALID_MIME_TYPE'));
    expect(res.body.message).toContain('صوتي');
  });

  it('attaches a voice with its duration and streams it via the signed URL', async () => {
    const webm = Buffer.concat([
      Buffer.from([0x1a, 0x45, 0xdf, 0xa3]),
      Buffer.alloc(512),
    ]);
    const voiceId = await uploadStudentVoice(webm);
    createdStoredObjectIds.push(voiceId);

    const token = await csrf(studentCookie);
    const created = await request(app.getHttpServer())
      .post('/student/questions')
      .set('Cookie', studentCookie)
      .set('x-device-fingerprint', studentFingerprint)
      .set('x-csrf-token', token)
      .send({
        message: 'سؤال مع رسالة صوتية',
        attachmentIds: [voiceId],
        voiceDurations: { [voiceId]: 9 },
      })
      .expect(201);
    createdVoiceQuestionId = (created.body.data ?? created.body).id;

    const detail = await request(app.getHttpServer())
      .get(`/student/questions/${createdVoiceQuestionId}`)
      .set('Cookie', studentCookie)
      .set('x-device-fingerprint', studentFingerprint)
      .expect(200);
    const messages = (detail.body.data ?? detail.body).messages;
    const attachment = messages[0].attachments[0];
    expect(attachment.type).toBe('VOICE');
    expect(attachment.durationSeconds).toBe(9);
    expect(attachment.mimeType).toBe('audio/webm');

    const audio = await request(app.getHttpServer())
      .get(attachment.url)
      .expect(200);
    expect(audio.headers['content-type']).toContain('audio/webm');
  });

  it('rejects a second voice on the same question', async () => {
    const webm = Buffer.concat([
      Buffer.from([0x1a, 0x45, 0xdf, 0xa3]),
      Buffer.alloc(512),
    ]);
    const secondVoiceId = await uploadStudentVoice(webm);
    createdStoredObjectIds.push(secondVoiceId);

    const token = await csrf(studentCookie);
    await request(app.getHttpServer())
      .post(`/student/questions/${createdVoiceQuestionId}/messages`)
      .set('Cookie', studentCookie)
      .set('x-device-fingerprint', studentFingerprint)
      .set('x-csrf-token', token)
      .send({
        message: 'رد مع صوت ثانٍ',
        attachmentIds: [secondVoiceId],
        voiceDurations: { [secondVoiceId]: 3 },
      })
      .expect(400)
      .expect((res) => expect(res.body.code).toBe('TOO_MANY_ATTACHMENTS'));
  });

  it('lets the admin reply with an uploaded image and stream it', async () => {
    const storedObjectId = await uploadOwner(
      PNG_BUFFER,
      'staff.png',
      'image/png',
    );
    createdStoredObjectIds.push(storedObjectId);

    const token = await csrf(ownerCookie);
    await request(app.getHttpServer())
      .post(`/admin/v1/student-questions/${createdQuestionId}/replies`)
      .set('Cookie', ownerCookie)
      .set('x-csrf-token', token)
      .send({ message: 'رد مع صورة', attachmentIds: [storedObjectId] })
      .expect(201);

    const detail = await request(app.getHttpServer())
      .get(`/admin/v1/student-questions/${createdQuestionId}`)
      .set('Cookie', ownerCookie)
      .expect(200);
    const messages = (detail.body.data ?? detail.body).messages;
    const staffMessage = messages.find(
      (m: { senderType: string }) => m.senderType === 'STAFF',
    );
    expect(staffMessage.attachments).toHaveLength(1);
    const url = staffMessage.attachments[0].url;

    const image = await request(app.getHttpServer()).get(url).expect(200);
    expect(image.headers['content-type']).toContain('image/webp');
    await request(app.getHttpServer())
      .get(url.replace('token=', 'token=X'))
      .expect(401);
  });
});
