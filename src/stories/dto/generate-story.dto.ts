import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  STORY_LOOKS,
  STORY_PICTURE_MODES,
  STORY_TEMPLATES,
  type StoryLook,
  type StoryPicture,
  type StoryTemplate,
} from '../story.constants';

function emptyToUndefined({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export class GenerateStoryDto {
  @IsIn(STORY_TEMPLATES)
  template: StoryTemplate;

  @IsOptional()
  @IsIn(STORY_LOOKS)
  look?: StoryLook;

  @IsOptional()
  @IsIn(STORY_PICTURE_MODES)
  picture?: StoryPicture;

  @IsOptional()
  @IsBoolean()
  stampText?: boolean;

  @IsOptional()
  @IsBoolean()
  includeBusinessName?: boolean;

  @IsOptional()
  @IsBoolean()
  includePhone?: boolean;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(80)
  businessName?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(24)
  phoneNumber?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(500)
  prompt?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(120)
  offerText?: string;

  @ValidateIf((dto: GenerateStoryDto) => dto.template === 'festival')
  @Transform(emptyToUndefined)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  festival?: string;
}
