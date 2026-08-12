import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { AI_MAX_QUESTIONS } from '../entities/ai-settings.entity';
import { AiQuestionDto } from './ai-question.dto';

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
}
