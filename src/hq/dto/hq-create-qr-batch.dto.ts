import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class HqCreateQrBatchDto {
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  @Min(1, { message: 'Size must be at least 1' })
  @Max(200, { message: 'Size cannot exceed 200' })
  size?: number = 10;
}
