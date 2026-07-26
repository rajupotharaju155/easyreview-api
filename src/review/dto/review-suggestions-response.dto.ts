export class ReviewSuggestionDto {
  text: string;
  language: string;
  targetWordCount: number;

  constructor(data: ReviewSuggestionDto) {
    Object.assign(this, data);
  }
}

export class ReviewSuggestionsResponseDto {
  suggestions: ReviewSuggestionDto[];

  constructor(suggestions: ReviewSuggestionDto[]) {
    this.suggestions = suggestions;
  }
}
