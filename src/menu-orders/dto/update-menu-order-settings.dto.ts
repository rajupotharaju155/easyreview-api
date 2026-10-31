import { Transform } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  Matches,
  ValidateIf,
} from 'class-validator';
import { normalizePhoneOrNull } from '../../common/utils/dto-transforms';
import { MenuOrderType } from '../enums/menu-order-type.enum';

export class UpdateMenuOrderSettingsDto {
  @IsOptional()
  @IsBoolean()
  menuOrderingEnabled?: boolean;

  /** With country code, e.g. "+919876543210". Null falls back to the business phone. */
  @IsOptional()
  @Transform(normalizePhoneOrNull)
  @ValidateIf((_, value) => value !== null)
  @Matches(/^\+[1-9][0-9]{7,14}$/, {
    message: 'WhatsApp number must include the country code, e.g. +14155550123',
  })
  menuWhatsappNumber?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(MenuOrderType, { each: true })
  menuOrderTypes?: MenuOrderType[];
}
