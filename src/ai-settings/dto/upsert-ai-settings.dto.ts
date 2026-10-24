import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  AI_KEYWORD_MAX_LENGTH,
  AI_LANGUAGE_MAX_LENGTH,
  AI_LOCAL_AREA_MAX_LENGTH,
  AI_MAX_KEYWORDS,
  AI_MAX_LANGUAGES,
  AI_MAX_QUESTIONS,
} from '../entities/ai-settings.entity';
import { AI_TONES, type AiTone } from '../constants/tone.constants';
import { AiQuestionDto } from './ai-question.dto';

function trimEach({ value }: { value: unknown }): unknown {
  if (!Array.isArray(value)) return value;
  return (value as unknown[]).map((item) =>
    typeof item === 'string' ? item.trim() : item,
  );
}

export class UpsertAiSettingsDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(AI_MAX_QUESTIONS)
  @ValidateNested({ each: true })
  @Type(() => AiQuestionDto)
  questions?: AiQuestionDto[];

  @IsOptional()
  @IsBoolean()
  questionsEnabled?: boolean;

  @IsOptional()
  @Transform(trimEach)
  @IsArray()
  @ArrayMaxSize(AI_MAX_KEYWORDS)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(AI_KEYWORD_MAX_LENGTH, { each: true })
  keywords?: string[];

  @IsOptional()
  @Transform(trimEach)
  @IsArray()
  @ArrayMaxSize(AI_MAX_LANGUAGES)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(AI_LANGUAGE_MAX_LENGTH, { each: true })
  languages?: string[];

  @IsOptional()
  @IsBoolean()
  mentionLocalArea?: boolean;

  /** Empty or equal to the location's own area clears the override. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(AI_LOCAL_AREA_MAX_LENGTH)
  localArea?: string;

  @IsOptional()
  @IsIn(AI_TONES)
  tone?: AiTone;
}
