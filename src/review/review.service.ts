import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI, Schema, ThinkingLevel, Type } from '@google/genai';
import {
  AiSettingsService,
  SubmittedAnswer,
} from '../ai-settings/ai-settings.service';
import { LocationsService } from '../locations/locations.service';
import {
  ReviewSuggestionDto,
  ReviewSuggestionsResponseDto,
} from './dto/review-suggestions-response.dto';
import { SuggestReviewsDto } from './dto/suggest-reviews.dto';

/**
 * One short and one medium draft. Randomized per request so a location's reviews
 * do not all fall into the same length buckets.
 */
const WORD_TARGET_RANGES = [
  { min: 15, max: 25 },
  { min: 30, max: 45 },
] as const;
const GEMINI_MODEL = 'gemini-3.6-flash';

/** Item count is pinned so the model cannot return fewer drafts than we asked for. */
const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    suggestions: {
      type: Type.ARRAY,
      minItems: String(WORD_TARGET_RANGES.length),
      maxItems: String(WORD_TARGET_RANGES.length),
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING },
          language: { type: Type.STRING },
        },
        required: ['text', 'language'],
        propertyOrdering: ['text', 'language'],
      },
    },
  },
  required: ['suggestions'],
} satisfies Schema;

type GeminiSuggestion = {
  text?: unknown;
  language?: unknown;
};

@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);
  private gemini: GoogleGenAI | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly locationsService: LocationsService,
    private readonly aiSettingsService: AiSettingsService,
  ) {}

  async suggestReviews(
    dto: SuggestReviewsDto,
  ): Promise<ReviewSuggestionsResponseDto> {
    const languages = this.normalizeLanguages(dto.languages);
    const keywords = dto.keywords.map((k) => k.trim()).filter(Boolean);
    const answers = await this.aiSettingsService.resolveAnswers(
      dto.locationId,
      dto.answers,
    );
    const wordTargets = this.pickWordTargets();
    const assignedLanguages = this.assignLanguages(
      languages,
      wordTargets.length,
    );
    const prompt = this.buildPrompt(
      dto,
      keywords,
      assignedLanguages,
      answers,
      wordTargets,
    );

    if (process.env.NODE_ENV === 'development') {
      this.logger.log(`Skipping Gemini. Prompt would be:\n${prompt}`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const mockResponse = new ReviewSuggestionsResponseDto([
        {
          text: 'Expected this to be the best saloon in Gajwel, but my experience was very disappointing. The service was quite poor today.',
          language: 'English',
        },
        {
          text: 'Gajwel lo unna CRUSH MENS BEAUTY PARLOUR & SALOON ki vellanu. Pedda ga emi baaledu. Friendly staff untaru ani vinnanu kaani ikkada service bilkul nachaledu. Good massage kosam vella kaani chala disappointing ga anipinchindi. Malli ikadiki vellanum anukovatledhu. Improvements avasaram.',
          language: 'Telugu',
        },
      ]);
      void this.locationsService.incrementAiReviewCount(dto.locationId);
      return mockResponse;
    }

    const client = this.getGeminiClient();

    let rawText: string | undefined;
    try {
      const result = await client.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          // Gemini 3 defaults to high thinking, which cost ~10s on a page the
          // customer is waiting on. Short drafts need no reasoning budget.
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        },
      });
      rawText = result.text;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Gemini request failed';
      throw new BadGatewayException(
        `Failed to generate review suggestions: ${message}`,
      );
    }

    if (!rawText) {
      throw new BadGatewayException('Gemini returned an empty response');
    }

    const suggestions = this.parseSuggestions(
      rawText,
      assignedLanguages,
      wordTargets,
    );
    const response = new ReviewSuggestionsResponseDto(suggestions);
    void this.locationsService.incrementAiReviewCount(dto.locationId);
    return response;
  }

  private getGeminiClient(): GoogleGenAI {
    if (this.gemini) {
      return this.gemini;
    }

    const apiKey = this.configService.get<string>('GEMINI_API_KEY')?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException('GEMINI_API_KEY is not configured');
    }

    this.gemini = new GoogleGenAI({ apiKey });
    return this.gemini;
  }

  private normalizeLanguages(languages: string[]): string[] {
    const seen = new Set<string>();
    const normalized: string[] = [];

    for (const language of languages) {
      const trimmed = language.trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      normalized.push(trimmed);
    }

    if (!normalized.length) {
      return ['English'];
    }

    return normalized;
  }

  private pickWordTargets(): number[] {
    return WORD_TARGET_RANGES.map(
      ({ min, max }) => min + Math.floor(Math.random() * (max - min + 1)),
    );
  }

  /** Prefer English for extra slots so 2 langs → 2 English + 1 other. */
  private assignLanguages(languages: string[], count: number): string[] {
    const ordered = [...languages].sort((a, b) => {
      const aIsEnglish = a.toLowerCase() === 'english';
      const bIsEnglish = b.toLowerCase() === 'english';
      if (aIsEnglish === bIsEnglish) return 0;
      return aIsEnglish ? -1 : 1;
    });

    return Array.from(
      { length: count },
      (_, index) => ordered[index % ordered.length],
    );
  }

  private buildPrompt(
    dto: SuggestReviewsDto,
    keywords: string[],
    assignedLanguages: string[],
    answers: SubmittedAnswer[],
    wordTargets: number[],
  ): string {
    const locationParts = [dto.city, dto.state].filter(Boolean).join(', ');
    const specs = wordTargets.map((wordCount, index) => ({
      index: index + 1,
      language: assignedLanguages[index],
      targetWordCount: wordCount,
    }));
    const answerLines = answers.map(
      ({ question, answers: selected }) => `- ${question}: ${selected.join(', ')}`,
    );

    return [
      'You write short, authentic Google review drafts for customers.',
      'Return ONLY valid JSON matching this shape:',
      '{"suggestions":[{"text":"...","language":"..."}]}',
      '',
      'Business:',
      `- Name: ${dto.name}`,
      dto.primaryTypeDisplayName
        ? `- Category: ${dto.primaryTypeDisplayName}`
        : null,
      locationParts ? `- Location: ${locationParts}` : null,
      `- Customer star rating: ${dto.starRating} out of 5`,
      `- Keywords to naturally weave in when relevant: ${keywords.join(', ') || 'none'}`,
      ...(answerLines.length
        ? ['', 'What this customer told us about their visit:', ...answerLines]
        : []),
      '',
      `Generate exactly ${wordTargets.length} review drafts with these exact specs:`,
      ...specs.map(
        (spec) =>
          `${spec.index}. language="${spec.language}", targetWordCount=${spec.targetWordCount}`,
      ),
      '',
      'Rules:',
      ...(answerLines.length
        ? [
            '- Ground every draft in the visit details above; treat them as facts about this specific customer.',
            '- Work those details into the sentences. Never list them or echo the question wording.',
            '- If the customer named several things, include all of them naturally — they are all true of this visit.',
          ]
        : []),
      dto.primaryTypeDisplayName
        ? '- Only mention services, staff roles, and details that a customer of this category would plausibly experience.'
        : null,
      '- Match the tone to the star rating (higher = more positive; lower = polite constructive).',
      '- Sound like a real customer, not marketing copy.',
      '- Do not invent specific staff names, prices, or unverifiable claims.',
      '- Do not include hashtags, emojis, or quotation marks around the whole review.',
      '- For any language that is not English, write in that language using Latin/English script only (transliteration). Never use native scripts such as Telugu, Hindi, or Arabic script.',
      '- Aim for approximately the target word count for each review (±15%).',
      '- Keep each suggestion distinct in wording.',
    ]
      .filter((line) => line !== null)
      .join('\n');
  }

  private parseSuggestions(
    rawText: string,
    assignedLanguages: string[],
    wordTargets: number[],
  ): ReviewSuggestionDto[] {
    let parsed: { suggestions?: GeminiSuggestion[] };
    try {
      parsed = JSON.parse(rawText) as { suggestions?: GeminiSuggestion[] };
    } catch {
      throw new BadGatewayException('Gemini returned invalid JSON');
    }

    if (
      !Array.isArray(parsed.suggestions) ||
      parsed.suggestions.length < wordTargets.length
    ) {
      throw new BadGatewayException(
        'Gemini returned an incomplete suggestions list',
      );
    }

    return parsed.suggestions
      .slice(0, wordTargets.length)
      .map((item, index) => {
        const text = typeof item?.text === 'string' ? item.text.trim() : '';
        if (!text) {
          throw new BadGatewayException('Gemini returned an empty suggestion');
        }

        return new ReviewSuggestionDto({
          text,
          language:
            typeof item?.language === 'string' && item.language.trim()
              ? item.language.trim()
              : assignedLanguages[index],
        });
      });
  }
}
