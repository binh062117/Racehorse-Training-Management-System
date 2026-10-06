import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const BREVO_SEND_URL = 'https://api.brevo.com/v3/smtp/email';
const DEFAULT_FROM = 'Racehorse Club <no-reply@example.com>';

function parseFrom(from: string): { name?: string; email: string } {
  const match = from.match(/^\s*(.*?)\s*<([^<>]+)>\s*$/);
  if (match) return { name: match[1] || undefined, email: match[2] };
  return { email: from.trim() };
}

/**
 * Sends transactional email via the Brevo HTTP API (not raw SMTP — some
 * PaaS free tiers, e.g. Render, block/timeout outbound SMTP connections
 * even with correct credentials; HTTPS on 443 is never blocked). When
 * BREVO_API_KEY is absent (e.g. local dev / CI) it logs the message
 * instead of sending, so flows stay testable.
 */
@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger('Mail');
  private apiKey: string | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const apiKey = this.config.get<string>('BREVO_API_KEY');
    if (!apiKey) {
      this.logger.warn('BREVO_API_KEY not set — emails will be logged only');
      return;
    }
    this.apiKey = apiKey;
  }

  private webUrl(path: string): string {
    const base =
      this.config.get<string>('APP_WEB_URL') ?? 'http://localhost:5173';
    return `${base.replace(/\/$/, '')}${path}`;
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.apiKey) {
      this.logger.log(
        `[email:not-sent] to=${to} subject="${subject}"\n${html}`,
      );
      return;
    }
    const from = this.config.get<string>('MAIL_FROM') ?? DEFAULT_FROM;
    const res = await fetch(BREVO_SEND_URL, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': this.apiKey,
      },
      body: JSON.stringify({
        sender: parseFrom(from),
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Brevo send failed (${res.status}): ${body}`);
    }
    this.logger.log(`Sent "${subject}" to ${to}`);
  }

  async sendVerifyOtp(to: string, name: string, code: string): Promise<void> {
    await this.send(
      to,
      'Verify your Racehorse Club account',
      `<p>Hi ${name},</p>
       <p>Enter this code on the website to confirm your email:</p>
       <p style="font-size:28px;font-weight:bold;letter-spacing:4px">${code}</p>
       <p>This code expires in 10 minutes. After verification a manager will approve your account.</p>`,
    );
  }

  async sendAccountApproved(to: string, name: string): Promise<void> {
    const link = this.webUrl('/login');
    await this.send(
      to,
      'Your Racehorse Club account has been approved',
      `<p>Hi ${name},</p>
       <p>Good news — a manager has approved your account. You can log in now:</p>
       <p><a href="${link}">${link}</a></p>`,
    );
  }

  async sendResetPassword(
    to: string,
    name: string,
    token: string,
  ): Promise<void> {
    const link = this.webUrl(`/reset-password?token=${token}`);
    await this.send(
      to,
      'Reset your Racehorse Club password',
      `<p>Hi ${name},</p>
       <p>Use this link to set a new password:</p>
       <p><a href="${link}">${link}</a></p>
       <p>This link expires in 1 hour. Ignore this email if you did not request it.</p>`,
    );
  }
}
