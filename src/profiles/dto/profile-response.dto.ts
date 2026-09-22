import type { ProfileLinkType } from '../entities/profile-link.entity';

export class ProfileLinkDto {
  id: string;
  profileId: string;
  type: ProfileLinkType;
  label: string;
  url: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;

  constructor(data: ProfileLinkDto) {
    Object.assign(this, data);
  }
}

export class ProfileDto {
  id: string;
  userId: string;
  slug: string;
  displayName: string;
  designation: string | null;
  companyName: string | null;
  bio: string | null;
  phone: string | null;
  whatsappPhone: string | null;
  email: string | null;
  coverImageUrl: string | null;
  profileImageUrl: string | null;
  isPublished: boolean;
  links: ProfileLinkDto[];
  createdAt: string;
  updatedAt: string;

  constructor(data: ProfileDto) {
    Object.assign(this, data);
  }
}

/** Public shape returned by GET /profiles/:slug. Owner-only fields are omitted. */
export class PublicProfileDto {
  id: string;
  slug: string;
  displayName: string;
  designation: string | null;
  companyName: string | null;
  bio: string | null;
  phone: string | null;
  whatsappPhone: string | null;
  email: string | null;
  coverImageUrl: string | null;
  profileImageUrl: string | null;
  links: PublicProfileLinkDto[];

  constructor(data: PublicProfileDto) {
    Object.assign(this, data);
  }
}

export class PublicProfileLinkDto {
  id: string;
  type: ProfileLinkType;
  label: string;
  url: string;

  constructor(data: PublicProfileLinkDto) {
    Object.assign(this, data);
  }
}

export class ProfileLeadDto {
  id: string;
  profileId: string;
  name: string;
  phone: string;
  email: string | null;
  companyName: string | null;
  note: string | null;
  createdAt: string;

  constructor(data: ProfileLeadDto) {
    Object.assign(this, data);
  }
}
