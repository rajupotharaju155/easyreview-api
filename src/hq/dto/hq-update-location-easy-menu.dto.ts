import { IsBoolean } from 'class-validator';

export class HqUpdateLocationEasyMenuDto {
  @IsBoolean()
  isEasyMenuEnabled: boolean;
}
