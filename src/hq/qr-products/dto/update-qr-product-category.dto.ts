import { MaxLength, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateQrProductCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;
}

