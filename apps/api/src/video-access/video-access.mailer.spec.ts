import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from '../mail/mail.service';
import { VideoAccessMailerService } from './video-access.mailer';

describe('VideoAccessMailerService', () => {
  let mailer: VideoAccessMailerService;
  let sendMail: jest.Mock;

  beforeEach(async () => {
    sendMail = jest.fn().mockResolvedValue(undefined);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VideoAccessMailerService,
        {
          provide: MailService,
          useValue: {
            sendMail,
            adminRecipients: ['admin@bahrawy.test'],
          },
        },
      ],
    }).compile();
    mailer = module.get<VideoAccessMailerService>(VideoAccessMailerService);
    delete process.env.DASHBOARD_URL;
  });

  it('notifyAdminsOfNewRequest sends an admin notification email', async () => {
    await mailer.notifyAdminsOfNewRequest({
      studentName: 'أحمد <script>alert(1)</script>',
      studentNumber: 1234,
      requestedEmail: 'student@bahrawy.test',
      courseTitle: 'كورس تجريبي',
      lessonTitle: 'درس الفيديو',
      requestedAt: new Date('2026-01-01T10:00:00Z'),
    });
    expect(sendMail).toHaveBeenCalledTimes(1);
    const arg = sendMail.mock.calls[0][0];
    expect(arg.to).toEqual(['admin@bahrawy.test']);
    expect(arg.subject).toContain('طلب فتح فيديو جديد');
    // HTML-escaped so raw tags are not present.
    expect(arg.html).not.toContain('<script>');
    expect(arg.html).toContain('&lt;script&gt;');
    // Links only to the dashboard, never to a media URL.
    expect(arg.html).toContain('/dashboard/video-access');
  });

  it('notifyAdminsOfNewRequest skips entirely when no recipients configured', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VideoAccessMailerService,
        {
          provide: MailService,
          useValue: { sendMail, adminRecipients: [] },
        },
      ],
    }).compile();
    const m = module.get<VideoAccessMailerService>(VideoAccessMailerService);
    await m.notifyAdminsOfNewRequest({
      studentName: 'test',
      studentNumber: null,
      requestedEmail: '',
      courseTitle: 'c',
      lessonTitle: 'l',
      requestedAt: new Date(),
    });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('notifyStudentOfApproval sends a student email with no playback URL', async () => {
    await mailer.notifyStudentOfApproval({
      to: 'student@bahrawy.test',
      studentName: 'سارة',
      lessonTitle: 'درس مشروط',
      expiresAt: new Date('2026-02-01T10:00:00Z'),
      durationLabel: 'SESSION',
    });
    const arg = sendMail.mock.calls[0][0];
    expect(arg.to).toBe('student@bahrawy.test');
    expect(arg.subject).toContain('تم فتح الفيديو');
    expect(arg.html).toContain('مدة الوصول');
    // Security: no signed playback/token/YouTube URLs anywhere in the mail.
    expect(arg.html).not.toMatch(/https?:\/\/[^"]*(youtube|playback|token|sign)/i);
  });

  it('notifyStudentOfApproval uses the duration label for a permanent grant', async () => {
    await mailer.notifyStudentOfApproval({
      to: 'student@bahrawy.test',
      studentName: 'سارة',
      lessonTitle: 'درس مشروط',
      expiresAt: null,
      durationLabel: 'SESSION',
    });
    const arg = sendMail.mock.calls[0][0];
    expect(arg.html).toContain('SESSION');
  });

  it('notifyStudentOfRejection sends a rejection email and escapes reason', async () => {
    await mailer.notifyStudentOfRejection({
      to: 'student@bahrawy.test',
      studentName: 'سارة',
      lessonTitle: 'درس مشروط',
      reason: 'سبب <b>تجريبي</b>',
    });
    const arg = sendMail.mock.calls[0][0];
    expect(arg.subject).toContain('لم تتم الموافقة');
    expect(arg.html).not.toContain('<b>تجريبي</b>');
    expect(arg.html).toContain('&lt;b&gt;تجريبي&lt;/b&gt;');
  });
});