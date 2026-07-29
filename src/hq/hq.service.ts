import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { LoginResponseDto } from '../auth/dto/auth-response.dto';
import { LoginDto } from '../auth/dto/login.dto';
import { generateHqTokens } from '../common/utils/token.util';
import {
  HQ_ADMIN_EMAIL,
  HQ_ADMIN_PASSWORD,
} from './hq.constants';

@Injectable()
export class HqService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Authenticates HQ admin against hardcoded credentials and issues JWT tokens.
   */
  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
    const email = loginDto.email.trim().toLowerCase();
    if (
      email !== HQ_ADMIN_EMAIL.toLowerCase() ||
      loginDto.password !== HQ_ADMIN_PASSWORD
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }
    console.log('[INFO] HQ admin login successful');
    return generateHqTokens(email, this.jwtService, this.configService);
  }
}
