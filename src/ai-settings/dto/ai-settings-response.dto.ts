import { AiQuestion } from '../entities/ai-settings.entity';

export class AiSettingsResponseDto {
  locationId: string;
  questions: AiQuestion[];
  questionsEnabled: boolean;
  keywords: string[];
  languages: string[];

  constructor(data: AiSettingsResponseDto) {
    Object.assign(this, data);
  }
}
