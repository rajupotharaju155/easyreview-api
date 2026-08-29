import {
  BadGatewayException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { AiSettingsService } from '../ai-settings/ai-settings.service';
import { CurrentUserUtil } from '../common/utils/current-user.util';
import { Location } from '../locations/entities/location.entity';
import { todayIst } from '../subscriptions/utils/ist-date.util';
import { GenerateStoryDto } from './dto/generate-story.dto';
import { StoryGeneration } from './entities/story-generation.entity';
import { Story } from './entities/story.entity';
import { stampStoryBrand } from './stamp-story-brand';
import { StoryStorageService } from './story-storage.service';
import {
  STORY_ASPECT_RATIO,
  STORY_COMPOSE_MODEL,
  STORY_DAILY_LIMIT,
  STORY_IMAGE_MODEL,
  STORY_IMAGE_SIZE,
  STORY_LOOK_HINTS,
  STORY_MONTHLY_LIMIT,
  STORY_PICTURE_HINTS,
  type StoryTemplate,
} from './story.constants';

export type StoryQuota = {
  dailyUsed: number;
  dailyLimit: number;
  monthlyUsed: number;
  monthlyLimit: number;
};

export type StoryDto = {
  id: string;
  locationId: string;
  template: StoryTemplate;
  prompt: string | null;
  offerText: string | null;
  festival: string | null;
  imageUrl: string;
  aspectRatio: string;
  createdAt: Date;
};

@Injectable()
export class StoriesService {
  private gemini: GoogleGenAI | null = null;

  constructor(
    @InjectRepository(Story)
    private readonly storyRepository: Repository<Story>,
    @InjectRepository(StoryGeneration)
    private readonly generationRepository: Repository<StoryGeneration>,
    @InjectRepository(Location)
    private readonly locationRepository: Repository<Location>,
    private readonly currentUserUtil: CurrentUserUtil,
    private readonly configService: ConfigService,
    private readonly aiSettingsService: AiSettingsService,
    private readonly storyStorage: StoryStorageService,
  ) {}

  async listForOwnedLocation(locationId: string): Promise<{
    stories: StoryDto[];
    quota: StoryQuota;
  }> {
    await this.assertLocationOwned(locationId);
    const [stories, quota] = await Promise.all([
      this.storyRepository.find({
        where: { locationId },
        order: { createdAt: 'DESC' },
        take: 50,
      }),
      this.getQuota(locationId),
    ]);

    return {
      stories: stories.map((story) => this.toDto(story)),
      quota,
    };
  }

  async generate(
    locationId: string,
    dto: GenerateStoryDto,
  ): Promise<{ story: StoryDto; quota: StoryQuota }> {
    const location = await this.assertLocationOwned(locationId);
    this.validateGenerateDto(dto);
    await this.assertWithinQuota(locationId);

    const { keywords } = await this.aiSettingsService.findPublicForRatingPage(
      locationId,
    );
    const composedPrompt = await this.composePrompt(location, dto, keywords);
    const stampText = dto.stampText !== false;
    const brand = this.resolveBrand(location, dto);

    let imageBytes: Buffer;
    let mimeType: string;
    try {
      const generated = await this.generateImage(composedPrompt);
      if (stampText && (brand.name || brand.phone)) {
        const stamped = await stampStoryBrand(
          generated.bytes,
          brand.name,
          brand.phone,
        );
        imageBytes = stamped.bytes;
        mimeType = stamped.mimeType;
      } else {
        imageBytes = generated.bytes;
        mimeType = generated.mimeType;
      }
    } catch (error) {
      await this.generationRepository.save(
        new StoryGeneration({
          locationId,
          storyId: null,
          model: STORY_IMAGE_MODEL,
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      throw error;
    }

    const imageUrl = await this.storyStorage.uploadStoryImage(
      locationId,
      imageBytes,
      mimeType,
    );

    const story = await this.storyRepository.save(
      new Story({
        locationId,
        template: dto.template,
        prompt: dto.prompt?.trim() || null,
        offerText: dto.offerText?.trim() || null,
        festival: dto.festival?.trim() || null,
        composedPrompt,
        imageUrl,
        aspectRatio: STORY_ASPECT_RATIO,
      }),
    );

    await this.generationRepository.save(
      new StoryGeneration({
        locationId,
        storyId: story.id,
        model: STORY_IMAGE_MODEL,
        status: 'success',
        error: null,
      }),
    );

    return {
      story: this.toDto(story),
      quota: await this.getQuota(locationId),
    };
  }

  async deleteForOwnedLocation(
    locationId: string,
    storyId: string,
  ): Promise<void> {
    await this.assertLocationOwned(locationId);
    const story = await this.storyRepository.findOne({
      where: { id: storyId, locationId },
    });
    if (!story) {
      throw new NotFoundException('Story not found');
    }
    await this.storyRepository.delete({ id: story.id });
    await this.storyStorage.deleteIfManaged(story.imageUrl);
  }

  private resolveBrand(
    location: Location,
    dto: GenerateStoryDto,
  ): { name: string | null; phone: string | null } {
    const includeName = dto.includeBusinessName !== false;
    const includePhone = dto.includePhone !== false;
    return {
      name: includeName ? dto.businessName?.trim() || location.name : null,
      phone: includePhone
        ? dto.phoneNumber?.trim() || location.phoneNumber || null
        : null,
    };
  }

  private brandInstructions(
    location: Location,
    dto: GenerateStoryDto,
  ): string {
    const stampText = dto.stampText !== false;
    const brand = this.resolveBrand(location, dto);
    if (stampText) {
      return 'Do not write the business name, phone number, address, or website anywhere in the image. Those are added later as a small footer if the owner included them.';
    }
    return [
      brand.name
        ? `Write the shop name exactly as "${brand.name}" in the poster, designed into the layout (not a black bar stuck on the bottom).`
        : 'Do not write a business name.',
      brand.phone
        ? `Write the phone number exactly as "${brand.phone}". Spell every digit correctly.`
        : 'Do not write or invent a phone number.',
      'Do not invent a different business name or number.',
    ].join(' ');
  }

  private validateGenerateDto(dto: GenerateStoryDto): void {
    if (dto.template === 'custom' && !dto.prompt?.trim()) {
      throw new HttpException(
        'Write a short prompt for a custom story.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (dto.template === 'festival' && !dto.festival?.trim()) {
      throw new HttpException(
        'Choose a festival or occasion.',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async assertWithinQuota(locationId: string): Promise<void> {
    const quota = await this.getQuota(locationId);
    //TODO: Uncomment this when we have a daily limit
    // if (quota.dailyUsed >= quota.dailyLimit) {
    //   throw new HttpException(
    //     `Daily EasyStory limit reached (${quota.dailyLimit} posters). Try again tomorrow.`,
    //     HttpStatus.TOO_MANY_REQUESTS,
    //   );
    // }
    if (quota.monthlyUsed >= quota.monthlyLimit) {
      throw new HttpException(
        `Monthly EasyStory limit reached (${quota.monthlyLimit} posters). Try again next month.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async getQuota(locationId: string): Promise<StoryQuota> {
    const today = todayIst();
    const monthStart = `${today.slice(0, 7)}-01`;
    const startOfToday = new Date(`${today}T00:00:00+05:30`);
    const startOfMonth = new Date(`${monthStart}T00:00:00+05:30`);

    const [dailyUsed, monthlyUsed] = await Promise.all([
      this.generationRepository.count({
        where: { locationId, createdAt: MoreThanOrEqual(startOfToday) },
      }),
      this.generationRepository.count({
        where: { locationId, createdAt: MoreThanOrEqual(startOfMonth) },
      }),
    ]);

    return {
      dailyUsed,
      dailyLimit: STORY_DAILY_LIMIT,
      monthlyUsed,
      monthlyLimit: STORY_MONTHLY_LIMIT,
    };
  }

  private async composePrompt(
    location: Location,
    dto: GenerateStoryDto,
    keywords: string[] | null,
  ): Promise<string> {
    const brand = this.resolveBrand(location, dto);

    const details = [
      brand.name ? `Business name: ${brand.name}` : 'Do not include a business name',
      location.primaryTypeDisplayName
        ? `Category: ${location.primaryTypeDisplayName}`
        : null,
      [location.city, location.state].filter(Boolean).length
        ? `City: ${[location.city, location.state].filter(Boolean).join(', ')}`
        : null,
      brand.phone ? `Phone: ${brand.phone}` : 'Do not include a phone number',
      keywords?.length ? `Keywords: ${keywords.join(', ')}` : null,
      `Template: ${dto.template}`,
      dto.look
        ? `Mood: ${dto.look}. ${STORY_LOOK_HINTS[dto.look]}`
        : null,
      `Picture mode: ${dto.picture ?? 'photos'}. ${STORY_PICTURE_HINTS[dto.picture ?? 'photos']}`,
      dto.festival ? `Festival / occasion: ${dto.festival}` : null,
      dto.offerText ? `Offer text to feature: ${dto.offerText}` : null,
      dto.prompt ? `Owner request: ${dto.prompt}` : null,
    ]
      .filter((line): line is string => Boolean(line))
      .join('\n');

    const instructions = [
      'You write a single image-generation prompt for a 9:16 Instagram/WhatsApp story poster for an Indian small business.',
      'Return ONLY the image prompt. No title, no markdown, no quotes.',
      'Invent an original layout. Do not copy a stock template, a sunburst-and-circle poster, a neon line lockup, or a framed magazine layout.',
      'Use the selected mood only as colour, lighting, and energy. Composition, type, ribbons, badges, ornaments, and photography are yours to invent, within the picture mode.',
      this.brandInstructions(location, dto),
      'Do write the offer, festival greeting, and named services clearly in English or simple Hinglish. Prefer short phrases and numerals (20% OFF). Do not use native scripts such as Hindi, Telugu, or Tamil.',
      'If services are named, feature them with labels or small scenes.',
      'Do not invent awards, ratings, celebrity endorsements, or claims the owner did not provide.',
      'Do not render QR codes, watermarks, or fake app UI.',
      'Match the occasion: sale = discount poster; festival = greeting plus offer; cta = call/visit now; hours = open/closed; new = new arrival; custom = follow the owner request.',
      '',
      details,
    ].join('\n');

    const client = this.getGeminiClient();
    try {
      const result = await client.models.generateContent({
        model: STORY_COMPOSE_MODEL,
        contents: instructions,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
        },
      });
      const text = result.text?.trim();
      if (text) return text;
    } catch {
      // Fall through to the deterministic prompt so a composer outage
      // does not block poster generation.
    }

    return this.fallbackPrompt(location, dto, keywords);
  }

  private fallbackPrompt(
    location: Location,
    dto: GenerateStoryDto,
    keywords: string[] | null,
  ): string {
    const place = [location.city, location.state].filter(Boolean).join(', ');
    const offer = dto.offerText?.trim();
    const extra = dto.prompt?.trim();
    const festival = dto.festival?.trim();
    const picture = dto.picture ?? 'photos';
    const brand = this.resolveBrand(location, dto);
    return [
      `Vertical 9:16 promotional poster for a ${location.primaryTypeDisplayName || 'local'} business`,
      place ? `in ${place}` : '',
      festival ? `for ${festival}` : '',
      offer ? `featuring the offer "${offer}"` : '',
      extra ? `Owner direction: ${extra}` : '',
      dto.look ? `Mood (colour and energy only): ${STORY_LOOK_HINTS[dto.look]}` : '',
      STORY_PICTURE_HINTS[picture],
      keywords?.length ? `Visual cues: ${keywords.slice(0, 6).join(', ')}` : '',
      'Invent an original layout. Do not copy a stock template.',
      this.brandInstructions(location, dto),
      brand.name ? `Shop name to use if needed: ${brand.name}` : '',
      brand.phone ? `Phone to use if needed: ${brand.phone}` : '',
      'English or Hinglish text only. No QR codes, no fake awards.',
    ]
      .filter(Boolean)
      .join('. ');
  }

  private async generateImage(
    prompt: string,
  ): Promise<{ bytes: Buffer; mimeType: string }> {
    const client = this.getGeminiClient();
    let result;
    try {
      result = await client.models.generateContent({
        model: STORY_IMAGE_MODEL,
        contents: prompt,
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio: STORY_ASPECT_RATIO,
            imageSize: STORY_IMAGE_SIZE,
          },
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Gemini image request failed';
      throw new BadGatewayException(
        `Failed to generate story image: ${message}`,
      );
    }

    const parts = result.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      const data = part.inlineData?.data;
      if (data) {
        return {
          bytes: Buffer.from(data, 'base64'),
          mimeType: part.inlineData?.mimeType || 'image/png',
        };
      }
    }

    throw new BadGatewayException('Gemini did not return an image');
  }

  private getGeminiClient(): GoogleGenAI {
    if (this.gemini) return this.gemini;

    const apiKey = this.configService.get<string>('GEMINI_API_KEY')?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException('GEMINI_API_KEY is not configured');
    }

    this.gemini = new GoogleGenAI({ apiKey });
    return this.gemini;
  }

  private async assertLocationOwned(locationId: string): Promise<Location> {
    const userId = this.currentUserUtil.getCurrentUserId();
    const location = await this.locationRepository.findOne({
      where: { id: locationId, userId },
      select: [
        'id',
        'name',
        'city',
        'state',
        'phoneNumber',
        'formattedAddress',
        'primaryTypeDisplayName',
        'isEasyStoryEnabled',
      ],
    });

    if (!location) {
      throw new NotFoundException(`Location with id "${locationId}" not found`);
    }

    if (!location.isEasyStoryEnabled) {
      throw new ForbiddenException(
        'EasyStory is not enabled for this location',
      );
    }

    return location;
  }

  private toDto(story: Story): StoryDto {
    return {
      id: story.id,
      locationId: story.locationId,
      template: story.template,
      prompt: story.prompt,
      offerText: story.offerText,
      festival: story.festival,
      imageUrl: story.imageUrl,
      aspectRatio: story.aspectRatio,
      createdAt: story.createdAt,
    };
  }
}
