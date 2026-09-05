import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

function toOptionalBoolean({ value }: { value: unknown }): boolean | undefined {
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return undefined;
}

export class HqExpenseCategoriesQueryDto {
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  includeArchived?: boolean;
}
