import { Transform } from 'class-transformer';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

function trimString({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  return value.trim();
}

export class HqUpdateLocationSlugDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'Slug must be lowercase letters, numbers, and hyphens only (e.g. my-business)',
  })
  slug: string;
}
