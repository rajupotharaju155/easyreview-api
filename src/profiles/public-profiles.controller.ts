import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { CreateProfileLeadDto } from './dto/create-profile-lead.dto';
import { ProfileLeadDto, PublicProfileDto } from './dto/profile-response.dto';
import { ProfilesService } from './profiles.service';

/**
 * Serves the public digital business card at
 * `https://easyreview.co.in/profile/:slug`.
 *
 * The path segment is the current slug, or the profile code encoded in
 * the QR / NFC tag. A code resolves to the same card; the site then
 * replaces the address bar with the slug. Previous slugs are not kept.
 */
@Controller('profiles')
export class PublicProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Public()
  @Get(':slug')
  findBySlug(@Param('slug') slug: string): Promise<PublicProfileDto> {
    return this.profilesService.findPublicBySlug(slug);
  }

  @Public()
  @Post(':slug/leads')
  createLead(
    @Param('slug') slug: string,
    @Body() dto: CreateProfileLeadDto,
  ): Promise<ProfileLeadDto> {
    return this.profilesService.createLeadForSlug(slug, dto);
  }
}
