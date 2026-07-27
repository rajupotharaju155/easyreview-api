import { Type } from 'class-transformer';
import { IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreatePrivateFeedbackDto {
  @IsString()
  @MinLength(1)
  locationId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  rating: number;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  feedback: string;
}
