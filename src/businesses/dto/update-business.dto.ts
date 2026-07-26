import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateBusinessDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;
}
