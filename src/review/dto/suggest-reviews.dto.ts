import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  AI_MAX_OPTIONS,
  AI_MAX_QUESTIONS,
  AI_OPTION_MAX_LENGTH,
  AI_QUESTION_MAX_LENGTH,
} from '../../ai-settings/entities/ai-settings.entity';

function emptyToUndefined({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function trimEach({ value }: { value: unknown }): unknown {
  if (!Array.isArray(value)) return value;
  return (value as unknown[]).map((item) =>
    typeof item === 'string' ? item.trim() : item,
  );
}

export class ReviewAnswerDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(AI_QUESTION_MAX_LENGTH)
  question: string;

  @Transform(trimEach)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(AI_MAX_OPTIONS)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(AI_OPTION_MAX_LENGTH, { each: true })
  answers: string[];
}

export class SuggestReviewsDto {
  @IsString()
  @MinLength(1)
  locationId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  starRating: number;

  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  city?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  state?: string;

  /** Google's business category, e.g. "Hair salon". */
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(255)
  primaryTypeDisplayName?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsString({ each: true })
  keywords: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  languages: string[];

  /** Answers to the location's configured questions, validated against them server-side. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(AI_MAX_QUESTIONS)
  @ValidateNested({ each: true })
  @Type(() => ReviewAnswerDto)
  answers?: ReviewAnswerDto[];
}
