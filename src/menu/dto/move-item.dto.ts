import { IsString, MinLength } from 'class-validator';

export class MoveItemDto {
  @IsString()
  @MinLength(1)
  categoryId: string;
}
