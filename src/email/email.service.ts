import {
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../common/services/logger.service';
import {
  verificationOtpEmailHtml,
  welcomeEmailHtml,
} from './templates/email.templates';

const BREVO_SMTP_URL = 'https://api.brevo.com/v3/smtp/email';
const DEFAULT_SENDER = {
  name: 'EasyReview',
  email: 'no-reply@easyreview.co.in',
};

type BrevoSendPayload = {
  toEmail: string;
  toName?: string;
  subject: string;
  htmlContent: string;
};

@Injectable()
export class EmailService {
  private readonly logger = new LoggerService();

  constructor(private readonly configService: ConfigService) {
    this.logger.setContext(EmailService.name);
  }

  async sendVerificationOtp(email: string, otp: string): Promise<void> {
    await this.sendEmail({
      toEmail: email,
      subject: 'Your EasyReview verification code',
      htmlContent: verificationOtpEmailHtml(otp),
    });
  }

  async sendWelcome(email: string, businessName?: string): Promise<void> {
    await this.sendEmail({
      toEmail: email,
      toName: businessName,
      subject: 'Welcome to EasyReview for small business',
      htmlContent: welcomeEmailHtml(businessName),
    });
  }

  private async sendEmail(payload: BrevoSendPayload): Promise<void> {
    const apiKey = this.configService.get<string>('BREVO_API_KEY')?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Email service is not configured (missing BREVO_API_KEY).',
      );
    }

    const response = await fetch(BREVO_SMTP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        sender: DEFAULT_SENDER,
        to: [
          {
            email: payload.toEmail,
            ...(payload.toName ? { name: payload.toName } : {}),
          },
        ],
        subject: payload.subject,
        htmlContent: payload.htmlContent,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      this.logger.error(
        `Brevo email failed (${response.status}): ${errorBody || response.statusText}`,
      );
      throw new InternalServerErrorException('Failed to send email.');
    }
  }
}
