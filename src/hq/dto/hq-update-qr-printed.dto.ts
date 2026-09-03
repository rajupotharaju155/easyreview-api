import { IsBoolean } from 'class-validator';

export class HqUpdateQrPrintedDto {
  @IsBoolean()
  isPrinted: boolean;
}
