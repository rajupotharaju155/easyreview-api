import { IsString, MinLength } from 'class-validator';

export class CreateSpecialDto {
  @IsString()
  @MinLength(1)
  menuItemId: string;
}
