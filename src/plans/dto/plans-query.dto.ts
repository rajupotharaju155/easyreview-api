import { IsEnum, IsOptional } from 'class-validator';
import { Product } from '../enums/product.enum';

export class PlansQueryDto {
  @IsOptional()
  @IsEnum(Product)
  product?: Product;
}
