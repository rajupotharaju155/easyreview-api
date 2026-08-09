import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class HqAssignQrCodeDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  code: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  locationId: string;
}
