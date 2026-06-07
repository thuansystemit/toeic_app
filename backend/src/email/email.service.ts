import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/**
 * Provider-agnostic email sender. If SMTP is configured (any provider — SES,
 * SendGrid, Resend, Mailgun all offer SMTP) it sends a real email; otherwise it
 * logs the message to the console so the flow is fully testable in development.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    this.from = this.config.get<string>('mail.from') ?? 'no-reply@toeic.local';
    const host = this.config.get<string>('mail.smtp.host');
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: this.config.get<number>('mail.smtp.port') ?? 587,
        secure: this.config.get<boolean>('mail.smtp.secure') ?? false,
        auth: {
          user: this.config.get<string>('mail.smtp.user'),
          pass: this.config.get<string>('mail.smtp.pass'),
        },
      });
    } else {
      this.transporter = null;
    }
  }

  get configured(): boolean {
    return this.transporter !== null;
  }

  async sendPasswordReset(to: string, resetUrl: string): Promise<void> {
    const subject = 'Reset your TOEIC Platform password';
    const text =
      `You requested a password reset.\n\n` +
      `Open this link to choose a new password (valid for 30 minutes):\n${resetUrl}\n\n` +
      `If you didn't request this, you can ignore this email.`;
    const html =
      `<p>You requested a password reset.</p>` +
      `<p><a href="${resetUrl}">Choose a new password</a> (valid for 30 minutes).</p>` +
      `<p>If you didn't request this, you can ignore this email.</p>`;

    if (!this.transporter) {
      // Dev fallback — surface the link so it can be used/tested without SMTP.
      this.logger.log(`[DEV email] Password reset for ${to}: ${resetUrl}`);
      return;
    }
    await this.transporter.sendMail({ from: this.from, to, subject, text, html });
    this.logger.log(`Password reset email sent to ${to}`);
  }
}
