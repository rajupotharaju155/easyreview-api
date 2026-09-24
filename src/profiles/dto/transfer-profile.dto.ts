import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class TransferProfileDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  userId: string;
}
