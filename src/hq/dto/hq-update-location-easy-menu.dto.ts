import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { MenuStyle } from '../../menu/enums/menu-style.enum';

export class HqUpdateLocationEasyMenuDto {
  @IsBoolean()
  isEasyMenuEnabled: boolean;

  @IsOptional()
  @IsEnum(MenuStyle)
  menuStyle?: MenuStyle;
}
