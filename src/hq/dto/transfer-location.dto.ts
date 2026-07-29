import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class TransferLocationDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  userId: string;
}
