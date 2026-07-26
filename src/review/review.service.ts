import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  ReviewSuggestionDto,
  ReviewSuggestionsResponseDto,
} from './dto/review-suggestions-response.dto';
import { SuggestReviewsDto } from './dto/suggest-reviews.dto';

const WORD_TARGETS = [20, 40, 60] as const;
const GEMINI_MODEL = 'gemini-3.6-flash';

type GeminiSuggestion = {
  text?: unknown;
  language?: unknown;
  targetWordCount?: unknown;
};

@Injectable()
export class ReviewService {
  private gemini: GoogleGenerativeAI | null = null;

  constructor(private readonly configService: ConfigService) {}

  async suggestReviews(
    dto: SuggestReviewsDto,
  ): Promise<ReviewSuggestionsResponseDto> {
    if(process.env.NODE_ENV === 'development'){
      await new Promise(resolve => setTimeout(resolve, 3000));
      return {
        "suggestions": [
            {
                "text": "Expected this to be the best saloon in Gajwel, but my experience was very disappointing. The service was quite poor today.",
                "language": "English",
                "targetWordCount": 20
            },
            {
                "text": "Gajwel lo unna CRUSH MENS BEAUTY PARLOUR & SALOON ki vellanu. Pedda ga emi baaledu. Friendly staff untaru ani vinnanu kaani ikkada service bilkul nachaledu. Good massage kosam vella kaani chala disappointing ga anipinchindi. Malli ikadiki vellanum anukovatledhu. Improvements avasaram.",
                "language": "Telugu",
                "targetWordCount": 40
            },
            {
                "text": "I visited CRUSH MENS BEAUTY PARLOUR & SALOON in Gajwel expecting great service after hearing it was the best saloon around. Sadly, my experience was very unsatisfactory. I was hoping for friendly staff and a good massage, but the service was rushed and unprofessional. I hope the management takes customer feedback seriously and improves their quality of service soon.",
                "language": "English",
                "targetWordCount": 60
            }
        ]
    }
    }
    const client = this.getGeminiClient();
    const languages = this.normalizeLanguages(dto.languages);
    const keywords = dto.keywords.map((k) => k.trim()).filter(Boolean);
    const assignedLanguages = this.assignLanguages(
      languages,
      WORD_TARGETS.length,
    );

    const model = client.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        temperature: 0.9,
        responseMimeType: 'application/json',
      },
    });

    const prompt = this.buildPrompt(dto, keywords, assignedLanguages);

    let rawText: string;
    try {
      const result = await model.generateContent(prompt);
      rawText = result.response.text();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Gemini request failed';
      throw new BadGatewayException(
        `Failed to generate review suggestions: ${message}`,
      );
    }

    const suggestions = this.parseSuggestions(rawText, assignedLanguages);
    return new ReviewSuggestionsResponseDto(suggestions);
  }

  private getGeminiClient(): GoogleGenerativeAI {
    if (this.gemini) {
      return this.gemini;
    }

    const apiKey = this.configService.get<string>('GEMINI_API_KEY')?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'GEMINI_API_KEY is not configured',
      );
    }

    this.gemini = new GoogleGenerativeAI(apiKey);
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
  ): string {
    const locationParts = [dto.city, dto.state].filter(Boolean).join(', ');
    const specs = WORD_TARGETS.map((wordCount, index) => ({
      index: index + 1,
      language: assignedLanguages[index],
      targetWordCount: wordCount,
    }));

    return [
      'You write short, authentic Google review drafts for customers.',
      'Return ONLY valid JSON matching this shape:',
      '{"suggestions":[{"text":"...","language":"...","targetWordCount":20}]}',
      '',
      'Business:',
      `- Name: ${dto.name}`,
      locationParts ? `- Location: ${locationParts}` : null,
      `- Customer star rating: ${dto.starRating} out of 5`,
      `- Keywords to naturally weave in when relevant: ${keywords.join(', ') || 'none'}`,
      '',
      'Generate exactly 3 review drafts with these exact specs:',
      ...specs.map(
        (spec) =>
          `${spec.index}. language="${spec.language}", targetWordCount=${spec.targetWordCount}`,
      ),
      '',
      'Rules:',
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
  ): ReviewSuggestionDto[] {
    let parsed: { suggestions?: GeminiSuggestion[] };
    try {
      parsed = JSON.parse(rawText) as { suggestions?: GeminiSuggestion[] };
    } catch {
      throw new BadGatewayException('Gemini returned invalid JSON');
    }

    if (!Array.isArray(parsed.suggestions) || parsed.suggestions.length < 3) {
      throw new BadGatewayException(
        'Gemini returned an incomplete suggestions list',
      );
    }

    return WORD_TARGETS.map((targetWordCount, index) => {
      const item = parsed.suggestions![index];
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
        targetWordCount,
      });
    });
  }
}
