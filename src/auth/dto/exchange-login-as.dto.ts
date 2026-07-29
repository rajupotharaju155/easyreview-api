import { IsNotEmpty, IsString } from 'class-validator';

export class ExchangeLoginAsDto {
  @IsString()
  @IsNotEmpty()
  ticket: string;
}
