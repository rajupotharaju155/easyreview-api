import { IsBoolean, IsOptional } from 'class-validator';

export class PlanEntitlementsDto {
  @IsOptional()
  @IsBoolean()
  multiLanguageAi?: boolean;

  @IsOptional()
  @IsBoolean()
  standeeIncluded?: boolean;

  @IsOptional()
  @IsBoolean()
  nfcIncluded?: boolean;
}
