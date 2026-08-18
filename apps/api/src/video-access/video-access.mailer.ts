import { Injectable } from '@nestjs/common';
import { MailService } from '../mail/mail.service';

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Builds and sends the email messages for the video access request flow.
 * Security rules:
 *  - Never include YouTube URLs, signed playback URLs, passwords, or tokens.
 *  - The admin email links to the dashboard section, never to raw media.
 *  - The student email carries no playback URL (playback is enforced
 *    server-side through the authenticated /video endpoints).
 */
@Injectable()
export class VideoAccessMailerService {
  constructor(private readonly mail: MailService) {}

  async notifyAdminsOfNewRequest(params: {
    studentName: string;
    studentNumber: number | null;
    requestedEmail: string;
    courseTitle: string;
    lessonTitle: string;
    requestedAt: Date;
  }): Promise<void> {
    const recipients = this.mail.adminRecipients;
    if (!recipients.length) return;
    const dashboardUrl =
      process.env.DASHBOARD_URL || 'http://localhost:3002';
    const date = new Date(params.requestedAt).toLocaleString('ar-EG', {
      timeZone: process.env.TZ || 'Africa/Cairo',
    });
    await this.mail.sendMail({
      to: recipients,
      subject: `طلب فتح فيديو جديد: ${params.lessonTitle}`,
      html: `
        <div dir="rtl" style="font-family:Arial,Helvetica,sans-serif;line-height:1.7;color:#0f172a;max-width:560px;margin:auto;padding:24px">
          <h2 style="color:#0d9488;margin:0 0 8px">طلب فتح فيديو جديد</h2>
          <p>وصل طلب جديد لفتح فيديو يحتاج إلى مراجعة.</p>
          <table style="border-collapse:collapse;width:100%;margin:16px 0">
            <tr><td style="padding:6px 8px;border:1px solid #e2e8f0;font-weight:bold">الطالب</td><td style="padding:6px 8px;border:1px solid #e2e8f0">${escapeHtml(params.studentName)}</td></tr>
            <tr><td style="padding:6px 8px;border:1px solid #e2e8f0;font-weight:bold">رقم الطالب</td><td style="padding:6px 8px;border:1px solid #e2e8f0">${params.studentNumber ?? '—'}</td></tr>
            <tr><td style="padding:6px 8px;border:1px solid #e2e8f0;font-weight:bold">بريد الطالب</td><td style="padding:6px 8px;border:1px solid #e2e8f0">${escapeHtml(params.requestedEmail || '—')}</td></tr>
            <tr><td style="padding:6px 8px;border:1px solid #e2e8f0;font-weight:bold">الكورس</td><td style="padding:6px 8px;border:1px solid #e2e8f0">${escapeHtml(params.courseTitle)}</td></tr>
            <tr><td style="padding:6px 8px;border:1px solid #e2e8f0;font-weight:bold">الدرس</td><td style="padding:6px 8px;border:1px solid #e2e8f0">${escapeHtml(params.lessonTitle)}</td></tr>
            <tr><td style="padding:6px 8px;border:1px solid #e2e8f0;font-weight:bold">وقت الطلب</td><td style="padding:6px 8px;border:1px solid #e2e8f0">${escapeHtml(date)}</td></tr>
          </table>
          <a href="${escapeHtml(dashboardUrl)}/dashboard/video-access" style="display:inline-block;background:#0d9488;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">فتح لوحة التحكم</a>
          <p style="color:#64748b;font-size:12px;margin-top:20px">لا ترد على هذه الرسالة. يتم الفتح من لوحة التحكم فقط.</p>
        </div>`,
    });
  }

  async notifyStudentOfApproval(params: {
    to: string;
    studentName: string;
    lessonTitle: string;
    expiresAt: Date | null;
    durationLabel: string;
  }): Promise<void> {
    const expiry = params.expiresAt
      ? new Date(params.expiresAt).toLocaleString('ar-EG', {
          timeZone: process.env.TZ || 'Africa/Cairo',
        })
      : params.durationLabel;
    await this.mail.sendMail({
      to: params.to,
      subject: 'تم فتح الفيديو لك ✅',
      html: `
        <div dir="rtl" style="font-family:Arial,Helvetica,sans-serif;line-height:1.7;color:#0f172a;max-width:560px;margin:auto;padding:24px">
          <h2 style="color:#0d9488;margin:0 0 8px">تمت الموافقة على طلبك</h2>
          <p>أهلاً ${escapeHtml(params.studentName)}، تم فتح فيديو الدرس «${escapeHtml(params.lessonTitle)}» لك. يمكنك الآن مشاهدته من حسابك داخل الأكاديمية.</p>
          <p style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;padding:10px 14px"><strong>مدة الوصول:</strong> ${escapeHtml(expiry)}</p>
          <p style="color:#64748b;font-size:12px;margin-top:20px">لا تشارك محتوى الدروس مع الآخرين. يحق للإدارة إيقاف وصولك في أي وقت.</p>
        </div>`,
    });
  }

  async notifyStudentOfRejection(params: {
    to: string;
    studentName: string;
    lessonTitle: string;
    reason: string | null;
  }): Promise<void> {
    await this.mail.sendMail({
      to: params.to,
      subject: 'لم تتم الموافقة على طلب فتح الفيديو',
      html: `
        <div dir="rtl" style="font-family:Arial,Helvetica,sans-serif;line-height:1.7;color:#0f172a;max-width:560px;margin:auto;padding:24px">
          <h2 style="color:#e11d48;margin:0 0 8px">رفض طلب فتح الفيديو</h2>
          <p>أهلاً ${escapeHtml(params.studentName)}، لم تتم الموافقة على طلبك لفتح فيديو الدرس «${escapeHtml(params.lessonTitle)}».</p>
          ${params.reason ? `<p><strong>السبب:</strong> ${escapeHtml(params.reason)}</p>` : ''}
          <p style="color:#64748b;font-size:12px;margin-top:20px">إذا كان لديك استفسار، يمكنك التواصل مع فريق الدعم.</p>
        </div>`,
    });
  }
}
