import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { CreateProfileDto } from './dto/create-profile.dto';
import { CreateProfileLinkDto } from './dto/create-profile-link.dto';
import { ProfileLeadsQueryDto } from './dto/profile-leads-query.dto';
import {
  ProfileDto,
  ProfileLeadDto,
  ProfileLinkDto,
} from './dto/profile-response.dto';
import { ReorderProfileLinksDto } from './dto/reorder-profile-links.dto';
import { UpdateProfileLinkDto } from './dto/update-profile-link.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import type { ProfileImageFile } from './profile-storage.service';
import { ProfilesService } from './profiles.service';

const IMAGE_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;

/**
 * Authenticated owner endpoints. Namespaced under `/me/profiles` so the
 * public `/profiles/:slug` route does not collide with `:profileId`
 * lookups.
 */
@Controller('me/profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Post()
  create(@Body() dto: CreateProfileDto): Promise<ProfileDto> {
    return this.profilesService.create(dto);
  }

  @Get()
  list(): Promise<ProfileDto[]> {
    return this.profilesService.findAllForOwner();
  }

  @Get(':profileId')
  findOne(@Param('profileId') profileId: string): Promise<ProfileDto> {
    return this.profilesService.findOneForOwner(profileId);
  }

  @Patch(':profileId')
  update(
    @Param('profileId') profileId: string,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileDto> {
    return this.profilesService.update(profileId, dto);
  }

  /** Soft delete. */
  @Delete(':profileId')
  @HttpCode(204)
  remove(@Param('profileId') profileId: string): Promise<void> {
    return this.profilesService.remove(profileId);
  }

  // ---------- Images ----------

  @Post(':profileId/cover-image')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: IMAGE_UPLOAD_MAX_BYTES } }),
  )
  uploadCoverImage(
    @Param('profileId') profileId: string,
    @UploadedFile() file: ProfileImageFile,
  ): Promise<ProfileDto> {
    return this.profilesService.uploadImage(profileId, 'cover', file);
  }

  @Delete(':profileId/cover-image')
  removeCoverImage(@Param('profileId') profileId: string): Promise<ProfileDto> {
    return this.profilesService.removeImage(profileId, 'cover');
  }

  @Post(':profileId/profile-image')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: IMAGE_UPLOAD_MAX_BYTES } }),
  )
  uploadProfileImage(
    @Param('profileId') profileId: string,
    @UploadedFile() file: ProfileImageFile,
  ): Promise<ProfileDto> {
    return this.profilesService.uploadImage(profileId, 'avatar', file);
  }

  @Delete(':profileId/profile-image')
  removeProfileImage(
    @Param('profileId') profileId: string,
  ): Promise<ProfileDto> {
    return this.profilesService.removeImage(profileId, 'avatar');
  }

  // ---------- Links (hard delete) ----------

  @Post(':profileId/links')
  createLink(
    @Param('profileId') profileId: string,
    @Body() dto: CreateProfileLinkDto,
  ): Promise<ProfileLinkDto> {
    return this.profilesService.createLink(profileId, dto);
  }

  @Put(':profileId/links/reorder')
  @HttpCode(204)
  reorderLinks(
    @Param('profileId') profileId: string,
    @Body() dto: ReorderProfileLinksDto,
  ): Promise<void> {
    return this.profilesService.reorderLinks(profileId, dto);
  }

  @Patch(':profileId/links/:linkId')
  updateLink(
    @Param('profileId') profileId: string,
    @Param('linkId') linkId: string,
    @Body() dto: UpdateProfileLinkDto,
  ): Promise<ProfileLinkDto> {
    return this.profilesService.updateLink(profileId, linkId, dto);
  }

  @Delete(':profileId/links/:linkId')
  @HttpCode(204)
  removeLink(
    @Param('profileId') profileId: string,
    @Param('linkId') linkId: string,
  ): Promise<void> {
    return this.profilesService.removeLink(profileId, linkId);
  }

  // ---------- Leads (hard delete) ----------

  @Get(':profileId/leads')
  listLeads(
    @Param('profileId') profileId: string,
    @Query() query: ProfileLeadsQueryDto,
  ): Promise<PaginatedResponseDto<ProfileLeadDto>> {
    return this.profilesService.listLeads(profileId, query);
  }

  @Delete(':profileId/leads/:leadId')
  @HttpCode(204)
  removeLead(
    @Param('profileId') profileId: string,
    @Param('leadId') leadId: string,
  ): Promise<void> {
    return this.profilesService.removeLead(profileId, leadId);
  }
}
