import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  Length,
} from 'class-validator';
import { ID_LENGTH } from '../../common/utils/id';
import { PROFILE_MAX_LINKS } from '../entities/profile-link.entity';

export class ReorderProfileLinksDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(PROFILE_MAX_LINKS)
  @IsString({ each: true })
  @Length(ID_LENGTH, ID_LENGTH, { each: true })
  ids: string[];
}
