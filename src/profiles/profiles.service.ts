import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Not, Repository } from 'typeorm';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { CurrentUserUtil } from '../common/utils/current-user.util';
import {
  slugCandidatesFromName,
  slugWithSuffix,
} from '../common/utils/slug.util';
import { HqDeletedFilter } from '../hq/enums/hq-deleted-filter.enum';
import { CreateProfileDto } from './dto/create-profile.dto';
import { CreateProfileLeadDto } from './dto/create-profile-lead.dto';
import { CreateProfileLinkDto } from './dto/create-profile-link.dto';
import { HqProfileSummaryDto } from './dto/hq-profile-summary.dto';
import { HqProfilesQueryDto } from './dto/hq-profiles-query.dto';
import {
  ProfileDto,
  ProfileLeadDto,
  ProfileLinkDto,
  PublicProfileDto,
  PublicProfileLinkDto,
} from './dto/profile-response.dto';
import { ProfileLeadsQueryDto } from './dto/profile-leads-query.dto';
import { ReorderProfileLinksDto } from './dto/reorder-profile-links.dto';
import { UpdateProfileLinkDto } from './dto/update-profile-link.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileLead } from './entities/profile-lead.entity';
import { PROFILE_MAX_LINKS, ProfileLink } from './entities/profile-link.entity';
import { Profile } from './entities/profile.entity';
import {
  ProfileImageKind,
  ProfileStorageService,
  type ProfileImageFile,
} from './profile-storage.service';

@Injectable()
export class ProfilesService {
  private readonly logger = new Logger(ProfilesService.name);

  constructor(
    @InjectRepository(Profile)
    private readonly profileRepository: Repository<Profile>,
    @InjectRepository(ProfileLink)
    private readonly linkRepository: Repository<ProfileLink>,
    @InjectRepository(ProfileLead)
    private readonly leadRepository: Repository<ProfileLead>,
    private readonly dataSource: DataSource,
    private readonly currentUserUtil: CurrentUserUtil,
    private readonly profileStorage: ProfileStorageService,
  ) {}

  // ------------------------------------------------------------------
  // Owner (authenticated) endpoints
  // ------------------------------------------------------------------

  async create(dto: CreateProfileDto): Promise<ProfileDto> {
    const userId = this.currentUserUtil.getCurrentUserId();

    const profile = await this.dataSource.transaction(async (manager) => {
      const slug = await this.allocateUniqueSlug(manager, dto.displayName);
      const created = manager.create(Profile, {
        userId,
        slug,
        displayName: dto.displayName.trim(),
        designation: dto.designation ?? null,
        companyName: dto.companyName ?? null,
        bio: dto.bio ?? null,
        phone: dto.phone ?? null,
        whatsappPhone: dto.whatsappPhone ?? null,
        email: dto.email ?? null,
        coverImageUrl: null,
        profileImageUrl: null,
        isPublished: true,
      });
      return manager.save(created);
    });

    return this.toProfileDto(profile, []);
  }

  async findAllForOwner(): Promise<ProfileDto[]> {
    const userId = this.currentUserUtil.getCurrentUserId();
    const profiles = await this.profileRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    if (profiles.length === 0) return [];

    const links = await this.linkRepository.find({
      where: { profileId: In(profiles.map((p) => p.id)) },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    const linksByProfile = new Map<string, ProfileLink[]>();
    for (const link of links) {
      const list = linksByProfile.get(link.profileId) ?? [];
      list.push(link);
      linksByProfile.set(link.profileId, list);
    }

    return profiles.map((profile) =>
      this.toProfileDto(profile, linksByProfile.get(profile.id) ?? []),
    );
  }

  async findOneForOwner(profileId: string): Promise<ProfileDto> {
    const profile = await this.requireOwnedProfile(profileId);
    const links = await this.linkRepository.find({
      where: { profileId: profile.id },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    return this.toProfileDto(profile, links);
  }

  async update(profileId: string, dto: UpdateProfileDto): Promise<ProfileDto> {
    const profile = await this.requireOwnedProfile(profileId);

    if (dto.displayName !== undefined)
      profile.displayName = dto.displayName.trim();
    if (dto.designation !== undefined) profile.designation = dto.designation;
    if (dto.companyName !== undefined) profile.companyName = dto.companyName;
    if (dto.bio !== undefined) profile.bio = dto.bio;
    if (dto.phone !== undefined) profile.phone = dto.phone;
    if (dto.whatsappPhone !== undefined)
      profile.whatsappPhone = dto.whatsappPhone;
    if (dto.email !== undefined) profile.email = dto.email;

    if (dto.slug !== undefined && dto.slug !== profile.slug) {
      const available = await this.isSlugAvailable(
        this.profileRepository.manager,
        dto.slug,
        profile.id,
      );
      if (!available) {
        throw new ConflictException(
          `Slug "${dto.slug}" is already taken. Choose another.`,
        );
      }
      profile.slug = dto.slug;
    }

    await this.profileRepository.save(profile);
    return this.findOneForOwner(profile.id);
  }

  /** Soft delete — the row is kept so the slug stays reserved. */
  async remove(profileId: string): Promise<void> {
    const profile = await this.requireOwnedProfile(profileId);
    await this.profileRepository.softDelete({ id: profile.id });
  }

  // ---------- Images ----------

  async uploadImage(
    profileId: string,
    kind: ProfileImageKind,
    file: ProfileImageFile,
  ): Promise<ProfileDto> {
    const profile = await this.requireOwnedProfile(profileId);
    const previousUrl =
      kind === 'cover' ? profile.coverImageUrl : profile.profileImageUrl;

    const url = await this.profileStorage.uploadImage(profile.id, kind, file);

    if (kind === 'cover') profile.coverImageUrl = url;
    else profile.profileImageUrl = url;
    await this.profileRepository.save(profile);

    // Fire-and-forget cleanup of the replaced image; failure must not block the response.
    void this.profileStorage
      .deleteIfManaged(previousUrl)
      .catch(() => undefined);

    return this.findOneForOwner(profile.id);
  }

  async removeImage(
    profileId: string,
    kind: ProfileImageKind,
  ): Promise<ProfileDto> {
    const profile = await this.requireOwnedProfile(profileId);
    const previousUrl =
      kind === 'cover' ? profile.coverImageUrl : profile.profileImageUrl;

    if (kind === 'cover') profile.coverImageUrl = null;
    else profile.profileImageUrl = null;
    await this.profileRepository.save(profile);

    void this.profileStorage
      .deleteIfManaged(previousUrl)
      .catch(() => undefined);

    return this.findOneForOwner(profile.id);
  }

  // ---------- Links (hard delete) ----------

  async createLink(
    profileId: string,
    dto: CreateProfileLinkDto,
  ): Promise<ProfileLinkDto> {
    const profile = await this.requireOwnedProfile(profileId);

    const currentCount = await this.linkRepository.count({
      where: { profileId: profile.id },
    });
    if (currentCount >= PROFILE_MAX_LINKS) {
      throw new BadRequestException(
        `A profile can have at most ${PROFILE_MAX_LINKS} links`,
      );
    }

    const sortOrder =
      dto.sortOrder ?? (await this.nextLinkSortOrder(profile.id));

    const link = await this.linkRepository.save(
      new ProfileLink({
        profileId: profile.id,
        type: dto.type,
        label: dto.label,
        url: dto.url,
        sortOrder,
      }),
    );

    return this.toLinkDto(link);
  }

  async updateLink(
    profileId: string,
    linkId: string,
    dto: UpdateProfileLinkDto,
  ): Promise<ProfileLinkDto> {
    const profile = await this.requireOwnedProfile(profileId);
    const link = await this.linkRepository.findOne({
      where: { id: linkId, profileId: profile.id },
    });
    if (!link) {
      throw new NotFoundException(`Link with id "${linkId}" not found`);
    }
    if (dto.type !== undefined) link.type = dto.type;
    if (dto.label !== undefined) link.label = dto.label;
    if (dto.url !== undefined) link.url = dto.url;
    if (dto.sortOrder !== undefined) link.sortOrder = dto.sortOrder;
    await this.linkRepository.save(link);
    return this.toLinkDto(link);
  }

  async removeLink(profileId: string, linkId: string): Promise<void> {
    const profile = await this.requireOwnedProfile(profileId);
    const result = await this.linkRepository.delete({
      id: linkId,
      profileId: profile.id,
    });
    if (!result.affected) {
      throw new NotFoundException(`Link with id "${linkId}" not found`);
    }
  }

  async reorderLinks(
    profileId: string,
    dto: ReorderProfileLinksDto,
  ): Promise<void> {
    const profile = await this.requireOwnedProfile(profileId);
    const existing = await this.linkRepository.find({
      where: { profileId: profile.id },
      select: ['id'],
    });
    const existingIds = new Set(existing.map((link) => link.id));

    if (dto.ids.length !== existingIds.size) {
      throw new BadRequestException(
        'Reorder payload must include every link exactly once',
      );
    }
    const seen = new Set<string>();
    for (const id of dto.ids) {
      if (seen.has(id) || !existingIds.has(id)) {
        throw new BadRequestException(
          'Reorder payload must include every link exactly once',
        );
      }
      seen.add(id);
    }

    await this.dataSource.transaction(async (manager) => {
      for (let index = 0; index < dto.ids.length; index += 1) {
        await manager.update(
          ProfileLink,
          { id: dto.ids[index], profileId: profile.id },
          { sortOrder: index },
        );
      }
    });
  }

  // ---------- Leads (hard delete) ----------

  async listLeads(
    profileId: string,
    query: ProfileLeadsQueryDto,
  ): Promise<PaginatedResponseDto<ProfileLeadDto>> {
    const profile = await this.requireOwnedProfile(profileId);
    const { page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;
    const [rows, total] = await this.leadRepository.findAndCount({
      where: { profileId: profile.id },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });
    const data = rows.map((row) => this.toLeadDto(row));
    return new PaginatedResponseDto(data, total, page, limit);
  }

  async removeLead(profileId: string, leadId: string): Promise<void> {
    const profile = await this.requireOwnedProfile(profileId);
    const result = await this.leadRepository.delete({
      id: leadId,
      profileId: profile.id,
    });
    if (!result.affected) {
      throw new NotFoundException(`Lead with id "${leadId}" not found`);
    }
  }

  // ------------------------------------------------------------------
  // Public endpoints
  // ------------------------------------------------------------------

  async findPublicBySlug(slug: string): Promise<PublicProfileDto> {
    const profile = await this.profileRepository.findOne({
      where: { slug, isPublished: true },
    });
    if (!profile || !profile.slug) {
      throw new NotFoundException(`Profile with slug "${slug}" not found`);
    }

    const links = await this.linkRepository.find({
      where: { profileId: profile.id },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });

    return new PublicProfileDto({
      id: profile.id,
      slug: profile.slug,
      displayName: profile.displayName,
      designation: profile.designation,
      companyName: profile.companyName,
      bio: profile.bio,
      phone: profile.phone,
      whatsappPhone: profile.whatsappPhone,
      email: profile.email,
      coverImageUrl: profile.coverImageUrl,
      profileImageUrl: profile.profileImageUrl,
      links: links.map(
        (link) =>
          new PublicProfileLinkDto({
            id: link.id,
            type: link.type,
            label: link.label,
            url: link.url,
          }),
      ),
    });
  }

  async createLeadForSlug(
    slug: string,
    dto: CreateProfileLeadDto,
  ): Promise<ProfileLeadDto> {
    const profile = await this.profileRepository.findOne({
      where: { slug, isPublished: true },
      select: ['id'],
    });
    if (!profile) {
      throw new NotFoundException(`Profile with slug "${slug}" not found`);
    }

    const lead = await this.leadRepository.save(
      new ProfileLead({
        profileId: profile.id,
        name: dto.name,
        phone: dto.phone,
        email: dto.email ?? null,
        companyName: dto.companyName ?? null,
        note: dto.note ?? null,
      }),
    );

    return this.toLeadDto(lead);
  }

  // ------------------------------------------------------------------
  // HQ (admin) endpoints
  // ------------------------------------------------------------------

  /**
   * Lists profiles globally for HQ. Search matches id, slug, or display name.
   * `deleted` follows the standard HQ filter (active by default). Links and
   * leads are aggregated as counts so the payload stays lean.
   */
  async findAllForHq(
    query: HqProfilesQueryDto,
  ): Promise<PaginatedResponseDto<HqProfileSummaryDto>> {
    const {
      page = 1,
      limit = 10,
      search,
      deleted = HqDeletedFilter.ACTIVE,
    } = query;
    const skip = (page - 1) * limit;
    const term = search?.trim();

    const qb = this.profileRepository
      .createQueryBuilder('profile')
      .leftJoinAndSelect('profile.user', 'user')
      .orderBy('profile.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (deleted === HqDeletedFilter.DELETED) {
      qb.withDeleted().andWhere('profile.deletedAt IS NOT NULL');
    } else if (deleted === HqDeletedFilter.ALL) {
      qb.withDeleted();
    }

    if (term) {
      qb.andWhere(
        '(profile.id ILIKE :term OR profile.slug ILIKE :term OR profile.displayName ILIKE :term)',
        { term: `%${term}%` },
      );
    }

    const [profiles, total] = await qb.getManyAndCount();

    // Aggregate link + lead counts in one query each so the table doesn't
    // trigger N+1 lookups when the page is full.
    const profileIds = profiles.map((profile) => profile.id);
    const linksCount = await this.countByProfile(this.linkRepository, profileIds);
    const leadsCount = await this.countByProfile(this.leadRepository, profileIds);

    const data = profiles.map(
      (profile) =>
        new HqProfileSummaryDto({
          id: profile.id,
          slug: profile.slug,
          displayName: profile.displayName,
          designation: profile.designation,
          companyName: profile.companyName,
          isPublished: profile.isPublished,
          coverImageUrl: profile.coverImageUrl,
          profileImageUrl: profile.profileImageUrl,
          user: profile.user
            ? {
                id: profile.user.id,
                email: profile.user.email,
                name: profile.user.name,
              }
            : null,
          linksCount: linksCount.get(profile.id) ?? 0,
          leadsCount: leadsCount.get(profile.id) ?? 0,
          createdAt: this.toIsoString(profile.createdAt),
          updatedAt: this.toIsoString(profile.updatedAt),
          deletedAt: profile.deletedAt
            ? this.toIsoString(profile.deletedAt)
            : null,
        }),
    );

    return new PaginatedResponseDto(data, total, page, limit);
  }

  /** HQ-only. Customers cannot publish or hide their own card. */
  async setPublishedForHq(
    profileId: string,
    isPublished: boolean,
  ): Promise<HqProfileSummaryDto> {
    const profile = await this.profileRepository.findOne({
      where: { id: profileId },
      relations: { user: true },
    });
    if (!profile) {
      throw new NotFoundException(`Profile with id "${profileId}" not found`);
    }

    profile.isPublished = isPublished;
    await this.profileRepository.save(profile);

    const [linksCount, leadsCount] = await Promise.all([
      this.countByProfile(this.linkRepository, [profile.id]),
      this.countByProfile(this.leadRepository, [profile.id]),
    ]);

    return new HqProfileSummaryDto({
      id: profile.id,
      slug: profile.slug,
      displayName: profile.displayName,
      designation: profile.designation,
      companyName: profile.companyName,
      isPublished: profile.isPublished,
      coverImageUrl: profile.coverImageUrl,
      profileImageUrl: profile.profileImageUrl,
      user: profile.user
        ? {
            id: profile.user.id,
            email: profile.user.email,
            name: profile.user.name,
          }
        : null,
      linksCount: linksCount.get(profile.id) ?? 0,
      leadsCount: leadsCount.get(profile.id) ?? 0,
      createdAt: this.toIsoString(profile.createdAt),
      updatedAt: this.toIsoString(profile.updatedAt),
      deletedAt: profile.deletedAt ? this.toIsoString(profile.deletedAt) : null,
    });
  }

  private async countByProfile(
    repo: Repository<ProfileLink> | Repository<ProfileLead>,
    profileIds: string[],
  ): Promise<Map<string, number>> {
    if (profileIds.length === 0) return new Map();
    const rows = await repo
      .createQueryBuilder('row')
      .select('row.profileId', 'profileId')
      .addSelect('COUNT(*)', 'count')
      .where('row.profileId IN (:...profileIds)', { profileIds })
      .groupBy('row.profileId')
      .getRawMany<{ profileId: string; count: string }>();
    const map = new Map<string, number>();
    for (const row of rows) {
      map.set(row.profileId, Number(row.count));
    }
    return map;
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  private async requireOwnedProfile(profileId: string): Promise<Profile> {
    const userId = this.currentUserUtil.getCurrentUserId();
    const profile = await this.profileRepository.findOne({
      where: { id: profileId, userId },
    });
    if (!profile) {
      throw new NotFoundException(`Profile with id "${profileId}" not found`);
    }
    return profile;
  }

  private async nextLinkSortOrder(profileId: string): Promise<number> {
    const row = await this.linkRepository
      .createQueryBuilder('link')
      .select('COALESCE(MAX(link.sortOrder), -1)', 'max')
      .where('link.profileId = :profileId', { profileId })
      .getRawOne<{ max: string | number | null }>();
    const max = row?.max == null ? -1 : Number(row.max);
    return max + 1;
  }

  private async allocateUniqueSlug(
    manager: EntityManager,
    displayName: string,
  ): Promise<string> {
    const candidates = slugCandidatesFromName(displayName);
    const twoWordBase = candidates[0] || 'profile';

    for (const candidate of candidates) {
      if (await this.isSlugAvailable(manager, candidate)) {
        return candidate;
      }
    }

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = slugWithSuffix(twoWordBase);
      if (await this.isSlugAvailable(manager, candidate)) {
        return candidate;
      }
    }

    throw new ConflictException('Unable to allocate a unique profile slug');
  }

  /**
   * Slug is considered taken if any row (soft-deleted included) already uses it.
   * Reserving deleted slugs prevents printed NFC cards from resolving to a
   * different owner after a card was deleted and someone re-registers the name.
   */
  private async isSlugAvailable(
    manager: EntityManager,
    slug: string,
    ignoreProfileId?: string,
  ): Promise<boolean> {
    const existing = await manager.findOne(Profile, {
      where: ignoreProfileId ? { slug, id: Not(ignoreProfileId) } : { slug },
      withDeleted: true,
      select: ['id'],
    });
    return !existing;
  }

  /**
   * TypeORM returns timestamp columns as ISO strings (see
   * `configurePgUtcTimestampParsers`) but the TypeScript entity types
   * still declare them as `Date`. Handle both shapes so DTO helpers
   * never crash when reading `createdAt` / `updatedAt`.
   */
  private toIsoString(value: Date | string | null | undefined): string {
    if (!value) return '';
    if (value instanceof Date) return value.toISOString();
    return String(value);
  }

  private toProfileDto(profile: Profile, links: ProfileLink[]): ProfileDto {
    return new ProfileDto({
      id: profile.id,
      userId: profile.userId,
      slug: profile.slug ?? '',
      displayName: profile.displayName,
      designation: profile.designation,
      companyName: profile.companyName,
      bio: profile.bio,
      phone: profile.phone,
      whatsappPhone: profile.whatsappPhone,
      email: profile.email,
      coverImageUrl: profile.coverImageUrl,
      profileImageUrl: profile.profileImageUrl,
      isPublished: profile.isPublished,
      links: links.map((link) => this.toLinkDto(link)),
      createdAt: this.toIsoString(profile.createdAt),
      updatedAt: this.toIsoString(profile.updatedAt),
    });
  }

  private toLinkDto(link: ProfileLink): ProfileLinkDto {
    return new ProfileLinkDto({
      id: link.id,
      profileId: link.profileId,
      type: link.type,
      label: link.label,
      url: link.url,
      sortOrder: link.sortOrder,
      createdAt: this.toIsoString(link.createdAt),
      updatedAt: this.toIsoString(link.updatedAt),
    });
  }

  private toLeadDto(lead: ProfileLead): ProfileLeadDto {
    return new ProfileLeadDto({
      id: lead.id,
      profileId: lead.profileId,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      companyName: lead.companyName,
      note: lead.note,
      createdAt: this.toIsoString(lead.createdAt),
    });
  }
}
