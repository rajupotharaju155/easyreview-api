import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  AI_MAX_OPTIONS,
  AI_MIN_OPTIONS,
  AI_OPTION_MAX_LENGTH,
  AI_QUESTION_MAX_LENGTH,
} from '../entities/ai-settings.entity';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function trimEach({ value }: { value: unknown }): unknown {
  if (!Array.isArray(value)) return value;
  return (value as unknown[]).map((item) =>
    typeof item === 'string' ? item.trim() : item,
  );
}

export class AiQuestionDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(AI_QUESTION_MAX_LENGTH)
  question: string;

  @Transform(trimEach)
  @IsArray()
  @ArrayMinSize(AI_MIN_OPTIONS)
  @ArrayMaxSize(AI_MAX_OPTIONS)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  @MaxLength(AI_OPTION_MAX_LENGTH, { each: true })
  options: string[];

  @IsOptional()
  @IsBoolean()
  multiSelect?: boolean;
}
