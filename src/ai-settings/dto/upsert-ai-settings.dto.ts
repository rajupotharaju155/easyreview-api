import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  AI_KEYWORD_MAX_LENGTH,
  AI_LANGUAGE_MAX_LENGTH,
  AI_MAX_KEYWORDS,
  AI_MAX_LANGUAGES,
  AI_MAX_QUESTIONS,
} from '../entities/ai-settings.entity';
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
}
