import { MaxLength, MinLength, IsString } from 'class-validator';

export class CreateQrProductCategoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;
}

