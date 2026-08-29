import { IsBoolean } from 'class-validator';

export class HqUpdateLocationEasyStoryDto {
  @IsBoolean()
  isEasyStoryEnabled: boolean;
}
