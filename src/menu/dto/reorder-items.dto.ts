import { ArrayMinSize, IsArray, IsString, MinLength } from 'class-validator';

export class ReorderItemsDto {
  @IsString()
  @MinLength(1)
  categoryId: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  ids: string[];
}
