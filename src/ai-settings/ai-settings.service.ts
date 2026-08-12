import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentUserUtil } from '../common/utils/current-user.util';
import { Location } from '../locations/entities/location.entity';
import { AiQuestionDto } from './dto/ai-question.dto';
import { AiSettingsResponseDto } from './dto/ai-settings-response.dto';
import { UpsertAiSettingsDto } from './dto/upsert-ai-settings.dto';
import { AiQuestion, AiSettings } from './entities/ai-settings.entity';

export type SubmittedAnswer = {
  question: string;
  answer: string;
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
    await this.assertLocationOwned(locationId);

    const settings = await this.aiSettingsRepository.findOne({
      where: { locationId },
    });

    return new AiSettingsResponseDto({
      locationId,
      questions: settings?.questions ?? [],
      questionsEnabled: settings?.questionsEnabled ?? true,
    });
  }

  async upsertForOwnedLocation(
    locationId: string,
    upsertAiSettingsDto: UpsertAiSettingsDto,
  ): Promise<AiSettingsResponseDto> {
    await this.assertLocationOwned(locationId);

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

    const settings = existing
      ? Object.assign(existing, { questions, questionsEnabled })
      : this.aiSettingsRepository.create({
          locationId,
          questions,
          questionsEnabled,
        });

    const saved = await this.aiSettingsRepository.save(settings);

    return new AiSettingsResponseDto({
      locationId,
      questions: saved.questions ?? [],
      questionsEnabled: saved.questionsEnabled,
    });
  }

  /** Questions for the public rating page. Empty when unset or switched off. */
  async findPublicQuestions(locationId: string): Promise<AiQuestion[]> {
    const settings = await this.aiSettingsRepository.findOne({
      where: { locationId },
      select: ['questions', 'questionsEnabled'],
    });

    if (!settings?.questionsEnabled) {
      return [];
    }

    return settings.questions ?? [];
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

      const option = question.options.find((candidate) =>
        this.isSameText(candidate, submitted.answer),
      );
      if (!option) {
        throw new BadRequestException(
          `"${submitted.answer}" is not an option for "${question.question}"`,
        );
      }

      const key = question.question.toLowerCase();
      if (answered.has(key)) {
        throw new BadRequestException(
          `Duplicate answer for "${question.question}"`,
        );
      }
      answered.add(key);

      resolved.push({ question: question.question, answer: option });
    }

    return resolved;
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

      return { question: item.question, options: [...item.options] };
    });
  }

  private async assertLocationOwned(locationId: string): Promise<void> {
    const userId = this.currentUserUtil.getCurrentUserId();
    const location = await this.locationRepository.findOne({
      where: { id: locationId, userId },
      select: ['id'],
    });

    if (!location) {
      throw new NotFoundException(`Location with id "${locationId}" not found`);
    }
  }

  private isSameText(left: string, right: string): boolean {
    return left.trim().toLowerCase() === right.trim().toLowerCase();
  }
}
