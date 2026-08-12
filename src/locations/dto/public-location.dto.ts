import { AiQuestion } from '../../ai-settings/entities/ai-settings.entity';

export class PublicLocationDto {
  id: string;
  name: string;
  placeId: string;
  slug: string;
  city: string | null;
  state: string | null;
  /** Google's business category, e.g. "Hair salon". Gives the AI prompt context. */
  primaryTypeDisplayName: string | null;
  keywords: string[] | null;
  languages: string[] | null;
  questions: AiQuestion[];

  constructor(data: PublicLocationDto) {
    Object.assign(this, data);
  }
}
