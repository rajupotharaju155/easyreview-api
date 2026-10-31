import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  emptyToNull,
  emptyToUndefined,
} from '../../common/utils/dto-transforms';
import { MenuOrderType } from '../enums/menu-order-type.enum';
import {
  MENU_ORDER_CUSTOMER_NAME_MAX_LENGTH,
  MENU_ORDER_NOTE_MAX_LENGTH,
  MENU_ORDER_SPOT_NUMBER_MAX_LENGTH,
} from '../entities/menu-order.entity';

const MAX_MENU_ORDER_LINES = 50;
const MAX_MENU_ORDER_LINE_QUANTITY = 99;
const DIAL_CODE_PATTERN = /^\+[1-9][0-9]{0,3}$/;
const NATIONAL_PHONE_PATTERN = /^[0-9]{4,14}$/;

function digitsOnly({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.replace(/\D/g, '') : value;
}

/** One cart line: either a menu item or a combo. */
export class CreateMenuOrderLineDto {
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(16)
  menuItemId?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(16)
  comboId?: string;

  /** "half" / "full" for half-served items, a price variant id for multi-priced ones. */
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(16)
  priceOption?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_MENU_ORDER_LINE_QUANTITY)
  quantity: number;
}

export class CreateMenuOrderDto {
  @Transform(emptyToUndefined)
  @IsString()
  @MinLength(1)
  @MaxLength(MENU_ORDER_CUSTOMER_NAME_MAX_LENGTH)
  customerName: string;

  @Transform(emptyToUndefined)
  @Matches(DIAL_CODE_PATTERN, { message: 'country code is not valid' })
  customerCountryCode: string;

  @Transform(digitsOnly)
  @Matches(NATIONAL_PHONE_PATTERN, { message: 'phone number is not valid' })
  customerPhone: string;

  @IsEnum(MenuOrderType)
  orderType: MenuOrderType;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(MENU_ORDER_SPOT_NUMBER_MAX_LENGTH)
  spotNumber?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(MENU_ORDER_NOTE_MAX_LENGTH)
  note?: string | null;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_MENU_ORDER_LINES)
  @ValidateNested({ each: true })
  @Type(() => CreateMenuOrderLineDto)
  items: CreateMenuOrderLineDto[];
}
