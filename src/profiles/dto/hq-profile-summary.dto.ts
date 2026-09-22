/**
 * Row shape returned by `GET /hq/profiles`. Kept intentionally slim so the
 * table stays snappy: no links, no leads — just the counts and owner info.
 */
export class HqProfileSummaryDto {
  id: string;
  slug: string | null;
  displayName: string;
  designation: string | null;
  companyName: string | null;
  isPublished: boolean;

  coverImageUrl: string | null;
  profileImageUrl: string | null;

  /** Owner of this card. Loaded via left-join so deleted users still show up. */
  user: {
    id: string;
    email: string;
    name: string | null;
  } | null;

  /** Counts help HQ see engagement at a glance. */
  linksCount: number;
  leadsCount: number;

  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;

  constructor(data: HqProfileSummaryDto) {
    Object.assign(this, data);
  }
}
