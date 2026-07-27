import { IsEmail, IsOptional, IsString } from 'class-validator';

export class TestWelcomeEmailDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  businessName?: string;
}
