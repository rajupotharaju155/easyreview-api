export type ProfileCompletenessStepKey = 'keywords' | 'questions';

export type ProfileCompletenessStepDto = {
  key: ProfileCompletenessStepKey;
  complete: boolean;
  message: string | null;
};

export class ProfileCompletenessResponseDto {
  locationId: string;
  completedSteps: number;
  totalSteps: number;
  isComplete: boolean;
  message: string;
  keywordCount: number;
  questionCount: number;
  steps: ProfileCompletenessStepDto[];

  constructor(data: ProfileCompletenessResponseDto) {
    Object.assign(this, data);
  }
}
