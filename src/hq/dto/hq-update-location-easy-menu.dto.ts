import { IsEnum } from 'class-validator';
import { MenuStyle } from '../../menu/enums/menu-style.enum';

export class HqUpdateLocationMenuStyleDto {
  @IsEnum(MenuStyle)
  menuStyle: MenuStyle;
}
