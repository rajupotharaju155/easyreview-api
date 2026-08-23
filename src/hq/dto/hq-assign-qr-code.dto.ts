import { IsBoolean, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class HqAssignQrCodeDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  code: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  locationId: string;

  /** When true, the QR redirects to the public menu page instead of the rating page. */
  @IsBoolean()
  isMenuQr: boolean;
}
