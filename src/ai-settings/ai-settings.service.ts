import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentUserUtil } from '../common/utils/current-user.util';
import { Location } from '../locations/entities/location.entity';
import {
  PROFILE_COMPLETE_MESSAGE,
  PROFILE_COMPLETENESS_TOTAL_STEPS,
  PROFILE_KEYWORDS_INCOMPLETE_MESSAGE,
  PROFILE_MIN_KEYWORDS,
  PROFILE_MIN_QUESTIONS,
  PROFILE_QUESTIONS_INCOMPLETE_MESSAGE,
} from './constants/profile-completeness.constants';
import {
  AI_TONES,
  type AiTone,
  type ResolvedAiTone,
  resolveAutoTone,
} from './constants/tone.constants';
import { AiQuestionDto } from './dto/ai-question.dto';
import { AiSettingsResponseDto } from './dto/ai-settings-response.dto';
import { ProfileCompletenessResponseDto } from './dto/profile-completeness-response.dto';
import { UpsertAiSettingsDto } from './dto/upsert-ai-settings.dto';
import {
  AI_MAX_LANGUAGES,
  AiQuestion,
  AiSettings,
} from './entities/ai-settings.entity';

export type SubmittedAnswer = {
  question: string;
  answers: string[];
};

@Injectable()
export class AiSettingsService {
  constructor(
    @InjectRepository(AiSettings)
    private readonly aiSettingsRepository: Repository<AiSettings>,
    @InjectRepository(Location)
    private readonly locationRepository: Repository<Location>,
    private readonly currentUserUtil: CurrentUserUtil,
  ) {}

  /** Returns defaults instead of 404 so the settings form can render unconfigured locations. */
  async findForOwnedLocation(
    locationId: string,
  ): Promise<AiSettingsResponseDto> {
    const location = await this.assertLocationOwned(locationId);

    const settings = await this.aiSettingsRepository.findOne({
      where: { locationId },
    });

    return this.toResponse(location, settings);
  }

  async getProfileCompleteness(
    locationId: string,
  ): Promise<ProfileCompletenessResponseDto> {
    await this.assertLocationOwned(locationId);

    const settings = await this.aiSettingsRepository.findOne({
      where: { locationId },
    });

    return this.toCompletenessResponse(locationId, settings);
  }

  async upsertForOwnedLocation(
    locationId: string,
    upsertAiSettingsDto: UpsertAiSettingsDto,
  ): Promise<AiSettingsResponseDto> {
    const location = await this.assertLocationOwned(locationId);

    const existing = await this.aiSettingsRepository.findOne({
      where: { locationId },
    });

    const questions =
      upsertAiSettingsDto.questions !== undefined
        ? this.normalizeQuestions(upsertAiSettingsDto.questions)
        : (existing?.questions ?? null);
    const questionsEnabled =
      upsertAiSettingsDto.questionsEnabled ??
      existing?.questionsEnabled ??
      true;
    const keywords =
      upsertAiSettingsDto.keywords !== undefined
        ? this.normalizeStringList(upsertAiSettingsDto.keywords, 'keyword')
        : (existing?.keywords ?? null);
    const languages =
      upsertAiSettingsDto.languages !== undefined
        ? this.normalizeStringList(upsertAiSettingsDto.languages, 'language')
        : (existing?.languages ?? null);
    const mentionLocalArea =
      upsertAiSettingsDto.mentionLocalArea ??
      existing?.mentionLocalArea ??
      true;
    const localArea =
      upsertAiSettingsDto.localArea !== undefined
        ? this.normalizeLocalArea(upsertAiSettingsDto.localArea, location)
        : (existing?.localArea ?? null);
    const tone =
      upsertAiSettingsDto.tone !== undefined
        ? this.storedTone(upsertAiSettingsDto.tone)
        : (existing?.tone ?? null);

    const settings = existing
      ? Object.assign(existing, {
          questions,
          questionsEnabled,
          keywords,
          languages,
          mentionLocalArea,
          localArea,
          tone,
        })
      : this.aiSettingsRepository.create({
          locationId,
          questions,
          questionsEnabled,
          keywords,
          languages,
          mentionLocalArea,
          localArea,
          tone,
        });

    const saved = await this.aiSettingsRepository.save(settings);

    return this.toResponse(location, saved);
  }

  /** Prompt fields for the public rating page. Questions are empty when switched off. */
  async findPublicForRatingPage(locationId: string): Promise<{
    questions: AiQuestion[];
    keywords: string[] | null;
    languages: string[] | null;
  }> {
    const settings = await this.aiSettingsRepository.findOne({
      where: { locationId },
      select: ['questions', 'questionsEnabled', 'keywords', 'languages'],
    });

    return {
      questions: settings?.questionsEnabled
        ? this.withQuestionDefaults(settings.questions)
        : [],
      keywords: settings?.keywords ?? null,
      languages: settings?.languages?.slice(0, AI_MAX_LANGUAGES) ?? null,
    };
  }

  /**
   * Prompt settings for review drafts on the public rating page, read from the
   * database so request strings never reach the prompt. A null area means name
   * no place; a null tone means no category matched auto.
   */
  async findReviewSettings(locationId: string): Promise<{
    localArea: string | null;
    tone: ResolvedAiTone | null;
    keywords: string[];
    languages: string[];
  }> {
    const [location, settings] = await Promise.all([
      this.locationRepository.findOne({
        where: { id: locationId },
        select: [
          'id',
          'localArea',
          'city',
          'primaryType',
          'primaryTypeDisplayName',
          'types',
        ],
      }),
      this.aiSettingsRepository.findOne({
        where: { locationId },
        select: [
          'id',
          'mentionLocalArea',
          'localArea',
          'tone',
          'keywords',
          'languages',
        ],
      }),
    ]);

    if (!location) {
      return { localArea: null, tone: null, keywords: [], languages: [] };
    }

    const tone = this.toneOf(settings);
    return {
      localArea: this.resolveLocalArea(location, settings),
      tone: tone === 'auto' ? resolveAutoTone(location) : tone,
      keywords: settings?.keywords ?? [],
      languages: settings?.languages ?? [],
    };
  }

  /** Questions for the public rating page. Empty when unset or switched off. */
  async findPublicQuestions(locationId: string): Promise<AiQuestion[]> {
    const { questions } = await this.findPublicForRatingPage(locationId);
    return questions;
  }

  /**
   * Matches submitted answers against the configured questions and returns the
   * stored copies. `/review/suggestions` is public, so the caller's strings must
   * never reach the AI prompt.
   */
  async resolveAnswers(
    locationId: string,
    answers: SubmittedAnswer[] | undefined,
  ): Promise<SubmittedAnswer[]> {
    if (!answers?.length) {
      return [];
    }

    const questions = await this.findPublicQuestions(locationId);
    if (!questions.length) {
      throw new BadRequestException(
        'This location has no active questionnaire',
      );
    }

    const resolved: SubmittedAnswer[] = [];
    const answered = new Set<string>();

    for (const submitted of answers) {
      const question = questions.find((candidate) =>
        this.isSameText(candidate.question, submitted.question),
      );
      if (!question) {
        throw new BadRequestException(
          `Unknown question "${submitted.question}"`,
        );
      }

      const key = question.question.toLowerCase();
      if (answered.has(key)) {
        throw new BadRequestException(
          `Duplicate answer for "${question.question}"`,
        );
      }
      answered.add(key);

      if (!question.multiSelect && submitted.answers.length > 1) {
        throw new BadRequestException(
          `"${question.question}" allows only one answer`,
        );
      }

      const resolvedOptions: string[] = [];
      const seenOptions = new Set<string>();

      for (const submittedAnswer of submitted.answers) {
        const option = question.options.find((candidate) =>
          this.isSameText(candidate, submittedAnswer),
        );
        if (!option) {
          throw new BadRequestException(
            `"${submittedAnswer}" is not an option for "${question.question}"`,
          );
        }

        const optionKey = option.toLowerCase();
        if (seenOptions.has(optionKey)) {
          continue;
        }
        seenOptions.add(optionKey);
        resolvedOptions.push(option);
      }

      resolved.push({ question: question.question, answers: resolvedOptions });
    }

    return resolved;
  }

  private toCompletenessResponse(
    locationId: string,
    settings: AiSettings | null,
  ): ProfileCompletenessResponseDto {
    const keywordCount = (settings?.keywords ?? []).filter((keyword) =>
      keyword.trim(),
    ).length;
    const questionCount = (settings?.questions ?? []).filter((item) =>
      item.question?.trim(),
    ).length;

    const keywordsComplete = keywordCount >= PROFILE_MIN_KEYWORDS;
    const questionsComplete = questionCount >= PROFILE_MIN_QUESTIONS;
    const completedSteps = Number(keywordsComplete) + Number(questionsComplete);
    const isComplete = completedSteps === PROFILE_COMPLETENESS_TOTAL_STEPS;

    return new ProfileCompletenessResponseDto({
      locationId,
      completedSteps,
      totalSteps: PROFILE_COMPLETENESS_TOTAL_STEPS,
      isComplete,
      message: isComplete ? PROFILE_COMPLETE_MESSAGE : '',
      keywordCount,
      questionCount,
      steps: [
        {
          key: 'keywords',
          complete: keywordsComplete,
          message: keywordsComplete
            ? null
            : PROFILE_KEYWORDS_INCOMPLETE_MESSAGE,
        },
        {
          key: 'questions',
          complete: questionsComplete,
          message: questionsComplete
            ? null
            : PROFILE_QUESTIONS_INCOMPLETE_MESSAGE,
        },
      ],
    });
  }

  /**
   * Area the AI should name in drafts, or null when switched off or unknown.
   * Locations without saved AI settings fall back to their own address.
   */
  resolveLocalArea(
    location: Pick<Location, 'localArea' | 'city'>,
    settings: Pick<AiSettings, 'mentionLocalArea' | 'localArea'> | null,
  ): string | null {
    if (settings && !settings.mentionLocalArea) {
      return null;
    }
    return settings?.localArea ?? this.defaultLocalArea(location);
  }

  private defaultLocalArea(
    location: Pick<Location, 'localArea' | 'city'>,
  ): string | null {
    return location.localArea?.trim() || location.city?.trim() || null;
  }

  /** Stores null unless the owner typed something other than the location's own area. */
  private normalizeLocalArea(
    value: string,
    location: Pick<Location, 'localArea' | 'city'>,
  ): string | null {
    if (!value) {
      return null;
    }
    const fallback = this.defaultLocalArea(location);
    return fallback && this.isSameText(value, fallback) ? null : value;
  }

  /** Stored values outside AI_TONES (or null) read as auto. */
  private toneOf(settings: Pick<AiSettings, 'tone'> | null): AiTone {
    const tone = settings?.tone as AiTone | null | undefined;
    return tone && AI_TONES.includes(tone) ? tone : 'auto';
  }

  private storedTone(tone: AiTone): AiTone | null {
    return tone === 'auto' ? null : tone;
  }

  private toResponse(
    location: Pick<Location, 'id' | 'localArea' | 'city'>,
    settings: AiSettings | null,
  ): AiSettingsResponseDto {
    const defaultLocalArea = this.defaultLocalArea(location);
    return new AiSettingsResponseDto({
      locationId: location.id,
      questions: this.withQuestionDefaults(settings?.questions),
      questionsEnabled: settings?.questionsEnabled ?? true,
      keywords: settings?.keywords ?? [],
      languages: (settings?.languages ?? []).slice(0, AI_MAX_LANGUAGES),
      mentionLocalArea: settings?.mentionLocalArea ?? true,
      localArea: settings?.localArea ?? defaultLocalArea,
      defaultLocalArea,
      tone: this.toneOf(settings),
    });
  }

  private withQuestionDefaults(
    questions: AiQuestion[] | null | undefined,
  ): AiQuestion[] {
    return (questions ?? []).map((item) => ({
      question: item.question,
      options: item.options,
      multiSelect: Boolean(item.multiSelect),
    }));
  }

  private normalizeStringList(
    values: string[],
    label: string,
  ): string[] | null {
    if (!values.length) {
      return null;
    }

    const unique: string[] = [];
    const seen = new Set<string>();

    for (const value of values) {
      const key = value.toLowerCase();
      if (seen.has(key)) {
        throw new BadRequestException(`Duplicate ${label} "${value}"`);
      }
      seen.add(key);
      unique.push(value);
    }

    return unique;
  }

  private normalizeQuestions(questions: AiQuestionDto[]): AiQuestion[] | null {
    if (!questions.length) {
      return null;
    }

    const seenQuestions = new Set<string>();

    return questions.map((item) => {
      const questionKey = item.question.toLowerCase();
      if (seenQuestions.has(questionKey)) {
        throw new BadRequestException(`Duplicate question "${item.question}"`);
      }
      seenQuestions.add(questionKey);

      const seenOptions = new Set<string>();
      for (const option of item.options) {
        const optionKey = option.toLowerCase();
        if (seenOptions.has(optionKey)) {
          throw new BadRequestException(
            `Duplicate option "${option}" in "${item.question}"`,
          );
        }
        seenOptions.add(optionKey);
      }

      return {
        question: item.question,
        options: [...item.options],
        multiSelect: Boolean(item.multiSelect),
      };
    });
  }

  private async assertLocationOwned(
    locationId: string,
  ): Promise<Pick<Location, 'id' | 'localArea' | 'city'>> {
    const userId = this.currentUserUtil.getCurrentUserId();
    const location = await this.locationRepository.findOne({
      where: { id: locationId, userId },
      select: ['id', 'localArea', 'city'],
    });

    if (!location) {
      throw new NotFoundException(`Location with id "${locationId}" not found`);
    }

    return location;
  }

  private isSameText(left: string, right: string): boolean {
    return left.trim().toLowerCase() === right.trim().toLowerCase();
  }
}
