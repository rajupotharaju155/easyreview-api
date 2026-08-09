import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';
import { EmailService } from '../email/email.service';
import {
  comparePassword,
  generateTokens,
  validatePassword,
} from '../common/utils/token.util';
import { LOGIN_AS_TOKEN_TYPE } from '../hq/hq.constants';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { LoginResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './strategies/jwt.strategy';

const OTP_EXPIRY_MINUTES = 10;

function generateOtp(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function otpExpiresAt(): Date {
  return new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
}

@Injectable()
export class AuthService {
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {
    this.googleClient = new OAuth2Client(
      this.configService.get<string>('GOOGLE_OAUTH_CLIENT_ID'),
    );
  }

  async register(registerDto: RegisterDto): Promise<LoginResponseDto> {
    if (!validatePassword(registerDto.password)) {
      throw new BadRequestException(
        'Password must be at least 8 characters',
      );
    }

    const user = await this.usersService.create(registerDto);
    await this.issueAndSendVerificationOtp(user);

    return generateTokens(user, this.jwtService, this.configService);
  }

  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.password) {
      throw new UnauthorizedException(
        'This account uses Google sign-in. Please continue with Google.',
      );
    }

    const isPasswordValid = await comparePassword(
      loginDto.password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return generateTokens(user, this.jwtService, this.configService);
  }

  /**
   * Verifies a Google ID token from GIS, then creates or links the user and
   * returns the same JWT pair as email/password login.
   */
  async loginWithGoogle(idToken: string): Promise<LoginResponseDto> {
    const clientId = this.configService
      .get<string>('GOOGLE_OAUTH_CLIENT_ID')
      ?.trim();
    if (!clientId) {
      throw new BadRequestException('Google sign-in is not configured');
    }

    let email: string;
    let googleSub: string;
    let name: string | null;

    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: idToken.trim(),
        audience: clientId,
      });
      const payload = ticket.getPayload();
      if (!payload?.sub || !payload.email) {
        throw new UnauthorizedException('Invalid Google token');
      }
      if (payload.email_verified === false) {
        throw new UnauthorizedException('Google email is not verified');
      }
      email = payload.email.toLowerCase();
      googleSub = payload.sub;
      name = payload.name?.trim() || null;
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new UnauthorizedException('Invalid Google token');
    }

    let user = await this.usersService.findByGoogleSub(googleSub);
    //if user is not found, then check if the email is already in use
    if (!user) {
      //if email is already in use, then throw an error
      const existingByEmail = await this.usersService.findByEmail(email);
      if (existingByEmail) {
        //if the email is already in use, then check if the google sub is already linked to the email
        if (
          existingByEmail.googleSub &&
          existingByEmail.googleSub !== googleSub
        ) {
          //if the google sub is already linked to the email, then throw an error
          throw new UnauthorizedException('Unable to sign in with Google');
        }
        //if the google sub is not linked to the email, then link the google sub to the email
        user = await this.usersService.linkGoogleAccount(
          existingByEmail.id,
          googleSub,
          name,
        );
      } else {
        //if the email is not in use, then create a new user
        user = await this.usersService.createFromGoogle({
          email,
          name,
          googleSub,
        });
        void this.emailService
          .sendWelcome(user.email, user.name ?? undefined)
          .catch(() => {
            // Welcome email is best-effort for new Google users.
          });
      }
    }
    //if user is found, then return the token
    return generateTokens(user, this.jwtService, this.configService);
  }

  async verifyEmail(user: User, otp: string): Promise<User> {
    if (user.emailVerified) {
      return user;
    }

    if (
      !user.emailVerificationOtp ||
      !user.emailVerificationOtpExpiresAt ||
      user.emailVerificationOtp !== otp.trim()
    ) {
      throw new BadRequestException('Invalid verification code');
    }

    if (new Date(user.emailVerificationOtpExpiresAt).getTime() < Date.now()) {
      throw new BadRequestException(
        'Verification code has expired. Please request a new one.',
      );
    }

    const verifiedUser = await this.usersService.markEmailVerified(user.id);

    void this.emailService
      .sendWelcome(verifiedUser.email, verifiedUser.name ?? undefined)
      .catch(() => {
        // Welcome email is best-effort after verification succeeds.
      });

    return verifiedUser;
  }

  async resendVerificationOtp(user: User): Promise<{ message: string }> {
    if (user.emailVerified) {
      return { message: 'Email is already verified.' };
    }

    await this.issueAndSendVerificationOtp(user);
    return { message: 'Verification code sent.' };
  }

  /**
   * Exchanges a short-lived HQ login-as ticket for normal user session tokens.
   */
  async exchangeLoginAsTicket(ticket: string): Promise<LoginResponseDto> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(ticket.trim());
    } catch {
      throw new UnauthorizedException('Invalid or expired login-as ticket');
    }
    if (payload.type !== LOGIN_AS_TOKEN_TYPE || !payload.sub) {
      throw new UnauthorizedException('Invalid or expired login-as ticket');
    }
    const user = await this.usersService.findOne(payload.sub);
    //generate the token for user like how actually user is getting token
    return generateTokens(user, this.jwtService, this.configService);
  }

  private async issueAndSendVerificationOtp(user: User): Promise<void> {
    const otp = generateOtp();
    const updated = await this.usersService.setEmailVerificationOtp(
      user.id,
      otp,
      otpExpiresAt(),
    );
    await this.emailService.sendVerificationOtp(updated.email, otp);
  }
}
