export class ReviewSuggestionDto {
  text: string;
  language: string;

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
