import { AiQuestion } from '../entities/ai-settings.entity';

export class AiSettingsResponseDto {
  locationId: string;
  questions: AiQuestion[];
  questionsEnabled: boolean;

  constructor(data: AiSettingsResponseDto) {
    Object.assign(this, data);
  }
}
