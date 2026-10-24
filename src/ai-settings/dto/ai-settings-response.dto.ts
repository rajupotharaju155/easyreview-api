import type { AiTone } from '../constants/tone.constants';
import { AiQuestion } from '../entities/ai-settings.entity';

export class AiSettingsResponseDto {
  locationId: string;
  questions: AiQuestion[];
  questionsEnabled: boolean;
  keywords: string[];
  languages: string[];
  mentionLocalArea: boolean;
  /** Area the AI names: the owner's override, else defaultLocalArea. */
  localArea: string | null;
  /** The location's own localArea, else its city. */
  defaultLocalArea: string | null;
  tone: AiTone;

  constructor(data: AiSettingsResponseDto) {
    Object.assign(this, data);
  }
}
