import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { generateId, ID_LENGTH } from '../../common/utils/id';
import { Profile } from './profile.entity';

export enum ProfileLinkType {
  GOOGLE_BUSINESS = 'google_business',
  INSTAGRAM = 'instagram',
  FACEBOOK = 'facebook',
  X = 'x',
  LINKEDIN = 'linkedin',
  YOUTUBE = 'youtube',
  WHATSAPP = 'whatsapp',
  TELEGRAM = 'telegram',
  TIKTOK = 'tiktok',
  SNAPCHAT = 'snapchat',
  SPOTIFY = 'spotify',
  REDDIT = 'reddit',
  TWITCH = 'twitch',
  YELP = 'yelp',
  SHOPIFY = 'shopify',
  ZOOM = 'zoom',
  NOTION = 'notion',
  WEBSITE = 'website',
  CUSTOM = 'custom',
}

export const PROFILE_LINK_TYPE_VALUES = Object.values(ProfileLinkType);

export const PROFILE_LINK_LABEL_MAX_LENGTH = 60;
export const PROFILE_LINK_URL_MAX_LENGTH = 2048;
export const PROFILE_MAX_LINKS = 30;

/** Hard delete — the plan calls for delete-links to remove the row outright. */
@Entity('profile_links')
export class ProfileLink {
  constructor(data: Partial<ProfileLink> = {}) {
    Object.assign(this, data);
  }

  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  id: string;

  @Index()
  @Column({ type: 'varchar', length: ID_LENGTH })
  profileId: string;

  @ManyToOne(() => Profile, (profile) => profile.links, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'profileId' })
  profile: Profile;

  @Column({ type: 'varchar', length: 32 })
  type: ProfileLinkType;

  @Column({ type: 'varchar', length: PROFILE_LINK_LABEL_MAX_LENGTH })
  label: string;

  @Column({ type: 'varchar', length: PROFILE_LINK_URL_MAX_LENGTH })
  url: string;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @BeforeInsert()
  setId() {
    if (!this.id) {
      this.id = generateId();
    }
  }
}
