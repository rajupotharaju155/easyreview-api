import { IsEnum } from 'class-validator';
import { MenuOrderStatus } from '../enums/menu-order-status.enum';

export class UpdateMenuOrderStatusDto {
  @IsEnum(MenuOrderStatus)
  status: MenuOrderStatus;
}
