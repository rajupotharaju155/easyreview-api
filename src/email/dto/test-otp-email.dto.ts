import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class TestOtpEmailDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @MinLength(4)
  otp?: string;
}
