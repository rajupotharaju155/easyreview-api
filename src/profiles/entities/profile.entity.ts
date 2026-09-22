import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { generateId, ID_LENGTH } from '../../common/utils/id';
import { User } from '../../users/entities/user.entity';
import { ProfileLead } from './profile-lead.entity';
import { ProfileLink } from './profile-link.entity';

export const PROFILE_DISPLAY_NAME_MAX_LENGTH = 120;
export const PROFILE_DESIGNATION_MAX_LENGTH = 120;
export const PROFILE_COMPANY_NAME_MAX_LENGTH = 160;
export const PROFILE_BIO_MAX_LENGTH = 280;
export const PROFILE_PHONE_MAX_LENGTH = 32;
export const PROFILE_EMAIL_MAX_LENGTH = 254;
export const PROFILE_SLUG_MAX_LENGTH = 80;

@Entity('profiles')
export class Profile {
  constructor(data: Partial<Profile> = {}) {
    Object.assign(this, data);
  }

  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  id: string;

  @Index()
  @Column({ type: 'varchar', length: ID_LENGTH })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  /**
   * Public URL segment for /profile/:slug. Nullable while a card is being
   * created (never in the public flow — the API always allocates a slug on
   * insert). Unique across all rows, live or soft-deleted, so a reused name
   * still resolves the correct card.
   */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: PROFILE_SLUG_MAX_LENGTH, nullable: true })
  slug: string | null;

  @Column({ type: 'varchar', length: PROFILE_DISPLAY_NAME_MAX_LENGTH })
  displayName: string;

  @Column({
    type: 'varchar',
    length: PROFILE_DESIGNATION_MAX_LENGTH,
    nullable: true,
  })
  designation: string | null;

  @Column({
    type: 'varchar',
    length: PROFILE_COMPANY_NAME_MAX_LENGTH,
    nullable: true,
  })
  companyName: string | null;

  @Column({ type: 'varchar', length: PROFILE_BIO_MAX_LENGTH, nullable: true })
  bio: string | null;

  /** Powers Call, default WhatsApp target, and the vCard TEL. */
  @Column({ type: 'varchar', length: PROFILE_PHONE_MAX_LENGTH, nullable: true })
  phone: string | null;

  /** When null, WhatsApp button falls back to `phone`. */
  @Column({ type: 'varchar', length: PROFILE_PHONE_MAX_LENGTH, nullable: true })
  whatsappPhone: string | null;

  @Column({ type: 'varchar', length: PROFILE_EMAIL_MAX_LENGTH, nullable: true })
  email: string | null;

  @Column({ type: 'text', nullable: true })
  coverImageUrl: string | null;

  @Column({ type: 'text', nullable: true })
  profileImageUrl: string | null;

  /** Unpublished slugs return 404 so a card can be prepared before it is printed. */
  @Column({ type: 'boolean', default: false })
  isPublished: boolean;

  @OneToMany(() => ProfileLink, (link) => link.profile)
  links: ProfileLink[];

  @OneToMany(() => ProfileLead, (lead) => lead.profile)
  leads: ProfileLead[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;

  @BeforeInsert()
  setId() {
    if (!this.id) {
      this.id = generateId();
    }
  }
}
