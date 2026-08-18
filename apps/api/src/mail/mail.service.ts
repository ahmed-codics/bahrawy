import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';

/**
 * SMTP/Gmail email delivery for video access notifications.
 *
 * Configuration comes from env (see apps/api/.env.example):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM (defaults to SMTP_USER),
 *   ADMIN_EMAILS (comma-separated recipients for admin notifications),
 *   DASHBOARD_URL (link used in admin emails; defaults to localhost:3002).
 *
 * Without SMTP credentials the service degrades to a no-op logger so dev and
 * CI flows never fail on missing infrastructure. Emails never carry YouTube
 * URLs, passwords, tokens, or private playback URLs.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;

  constructor() {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    if (host && user && pass) {
      try {
        this.transporter = nodemailer.createTransport({
          host,
          port: Number(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: { user, pass },
        });
      } catch (error) {
        this.logger.warn(
          `SMTP transport could not be created (${(error as Error).message}); emails will be logged instead of sent`,
        );
        this.transporter = null;
      }
    } else {
      this.logger.warn(
        'SMTP_HOST/SMTP_USER/SMTP_PASS not configured — emails will be logged instead of sent',
      );
      this.transporter = null;
    }
  }

  private get from(): string {
    return process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@bahrawy.test';
  }

  get adminRecipients(): string[] {
    const raw = process.env.ADMIN_EMAILS || '';
    return raw
      .split(',')
      .map((email) => email.trim())
      .filter(Boolean);
  }

  get isConfigured(): boolean {
    return Boolean(this.transporter);
  }

  /**
   * Send an email, or log it when no SMTP transport is configured.
   * Never throws — email failures must not break the underlying request.
   */
  async sendMail(params: {
    to: string | string[];
    subject: string;
    html: string;
  }): Promise<{ delivered: boolean; to: string[] }> {
    const recipients = (Array.isArray(params.to) ? params.to : [params.to])
      .map((email) => email.trim())
      .filter(Boolean);
    if (!recipients.length) return { delivered: false, to: [] };

    if (!this.transporter) {
      this.logger.log(
        `[MAIL DRY-RUN] to=${recipients.join(',')} subject="${params.subject}"\n${params.html}`,
      );
      return { delivered: false, to: recipients };
    }

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: recipients,
        subject: params.subject,
        html: params.html,
      });
      return { delivered: true, to: recipients };
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${recipients.join(',')}: ${(error as Error).message}`,
      );
      return { delivered: false, to: recipients };
    }
  }
}
