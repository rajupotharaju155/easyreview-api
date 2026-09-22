import { IsBoolean } from 'class-validator';

export class HqUpdateProfilePublishedDto {
  @IsBoolean()
  isPublished: boolean;
}
