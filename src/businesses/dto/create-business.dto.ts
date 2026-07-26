import { IsString, Length, MinLength } from 'class-validator';
import { ID_LENGTH } from '../../common/utils/id';

export class CreateBusinessDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @Length(ID_LENGTH, ID_LENGTH)
  userId: string;
}
