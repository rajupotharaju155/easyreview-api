import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { LoginResponseDto } from '../auth/dto/auth-response.dto';
import { LoginDto } from '../auth/dto/login.dto';
import { Public } from '../common/decorators/public.decorator';
import { HqService } from './hq.service';

@Controller('hq')
export class HqController {
  constructor(private readonly hqService: HqService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto): Promise<LoginResponseDto> {
    return this.hqService.login(loginDto);
  }
}
