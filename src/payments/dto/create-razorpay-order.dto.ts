import { IsString, MinLength, ValidateIf } from 'class-validator';

export class CreateRazorpayOrderDto {
  @IsString()
  @MinLength(1)
  planId: string;

  @ValidateIf((dto: CreateRazorpayOrderDto) => !dto.profileId)
  @IsString()
  @MinLength(1)
  locationId?: string;

  @ValidateIf((dto: CreateRazorpayOrderDto) => !dto.locationId)
  @IsString()
  @MinLength(1)
  profileId?: string;
}
