import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { AllowUnverified } from '../common/decorators/allow-unverified.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/user.decorator';
import { User } from '../users/entities/user.entity';
import { AuthService } from './auth.service';
import { LoginResponseDto } from './dto/auth-response.dto';
import { ExchangeLoginAsDto } from './dto/exchange-login-as.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  async register(@Body() registerDto: RegisterDto): Promise<LoginResponseDto> {
    return this.authService.register(registerDto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(loginDto);
  }

  @Public()
  @Post('google')
  @HttpCode(HttpStatus.OK)
  async googleAuth(@Body() dto: GoogleAuthDto): Promise<LoginResponseDto> {
    return this.authService.loginWithGoogle(dto.idToken);
  }

  @Public()
  @Post('login-as/exchange')
  @HttpCode(HttpStatus.OK)
  async exchangeLoginAs(
    @Body() dto: ExchangeLoginAsDto,
  ): Promise<LoginResponseDto> {
    return this.authService.exchangeLoginAsTicket(dto.ticket);
  }

  @AllowUnverified()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(
    @CurrentUser() user: User,
    @Body() dto: VerifyEmailDto,
  ): Promise<User> {
    return this.authService.verifyEmail(user, dto.otp);
  }

  @AllowUnverified()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(@CurrentUser() user: User) {
    return this.authService.resendVerificationOtp(user);
  }
}
