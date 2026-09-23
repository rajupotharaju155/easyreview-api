import { SubscriptionStatus } from '../../subscriptions/enums/subscription-status.enum';

/** Open EasyProfile plan attached to an HQ profile row, when one exists. */
export class HqProfileSubscriptionDto {
  id: string;
  status: SubscriptionStatus;
  planName: string | null;
}

/**
 * Row shape returned by `GET /hq/profiles`. Kept intentionally slim so the
 * table stays snappy: no links, no leads — just the counts, owner, and the
 * open EasyProfile subscription when one exists.
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

  /** Pending, active, or queued EasyProfile plan. Null when none is open. */
  subscription: HqProfileSubscriptionDto | null;

  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;

  constructor(data: HqProfileSummaryDto) {
    Object.assign(this, data);
  }
}
