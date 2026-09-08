import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { SubmittedFrom } from '../enums/submitted-from.enum';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateContactMessageDto {
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @Transform(trimString)
  @IsEmail()
  @MaxLength(255)
  email: string;

  @Transform(trimString)
  @IsString()
  @Matches(/^\+\d{1,7}$/, {
    message: 'Country code must be a + prefix followed by 1-7 digits',
  })
  @MaxLength(8)
  countryCode: string;

  @Transform(trimString)
  @IsString()
  @Length(6, 15)
  phone: string;

  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message: string;

  @IsEnum(SubmittedFrom)
  submittedFrom: SubmittedFrom;
}
