import { Transform } from 'class-transformer';
import { IsString, Length, Matches, MaxLength } from 'class-validator';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class UpdateUserPhoneDto {
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
}
