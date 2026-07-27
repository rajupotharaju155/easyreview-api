import { Body, Controller, Post } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { TestOtpEmailDto } from './dto/test-otp-email.dto';
import { TestWelcomeEmailDto } from './dto/test-welcome-email.dto';
import { EmailService } from './email.service';

@Controller('email')
@Public()
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('test-otp')
  async testOtpEmail(@Body() dto: TestOtpEmailDto) {
    const otp =
      dto.otp?.trim() || String(Math.floor(100000 + Math.random() * 900000));
    await this.emailService.sendVerificationOtp(dto.email, otp);

    return {
      ok: true,
      email: dto.email,
      otp,
      message: 'Verification OTP email sent.',
    };
  }

  @Post('test-welcome')
  async testWelcomeEmail(@Body() dto: TestWelcomeEmailDto) {
    await this.emailService.sendWelcome(dto.email, dto.businessName);

    return {
      ok: true,
      email: dto.email,
      businessName: dto.businessName ?? null,
      message: 'Welcome email sent.',
    };
  }
}
