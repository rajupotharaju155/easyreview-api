import type { ProfileLinkType } from '../entities/profile-link.entity';

export class HqProfileLinkDto {
  id: string;
  type: ProfileLinkType;
  label: string;
  url: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Full EasyProfile card returned by `GET /hq/profiles/:id`.
 * Subscriptions are loaded separately, the same way location detail does.
 */
export class HqProfileDetailDto {
  id: string;
  userId: string;
  slug: string | null;
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
  links: HqProfileLinkDto[];
  linksCount: number;
  leadsCount: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;

  constructor(data: HqProfileDetailDto) {
    Object.assign(this, data);
  }
}
