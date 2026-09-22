import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { generateId, ID_LENGTH } from '../../common/utils/id';
import { Profile } from './profile.entity';

export const PROFILE_LEAD_NAME_MAX_LENGTH = 120;
export const PROFILE_LEAD_PHONE_MAX_LENGTH = 32;
export const PROFILE_LEAD_EMAIL_MAX_LENGTH = 254;
export const PROFILE_LEAD_COMPANY_MAX_LENGTH = 160;
export const PROFILE_LEAD_NOTE_MAX_LENGTH = 500;

/** Hard delete — leads are removed outright when the owner clears them. */
@Entity('profile_leads')
export class ProfileLead {
  constructor(data: Partial<ProfileLead> = {}) {
    Object.assign(this, data);
  }

  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  id: string;

  @Index()
  @Column({ type: 'varchar', length: ID_LENGTH })
  profileId: string;

  @ManyToOne(() => Profile, (profile) => profile.leads, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'profileId' })
  profile: Profile;

  @Column({ type: 'varchar', length: PROFILE_LEAD_NAME_MAX_LENGTH })
  name: string;

  @Column({ type: 'varchar', length: PROFILE_LEAD_PHONE_MAX_LENGTH })
  phone: string;

  @Column({
    type: 'varchar',
    length: PROFILE_LEAD_EMAIL_MAX_LENGTH,
    nullable: true,
  })
  email: string | null;

  @Column({
    type: 'varchar',
    length: PROFILE_LEAD_COMPANY_MAX_LENGTH,
    nullable: true,
  })
  companyName: string | null;

  @Column({
    type: 'varchar',
    length: PROFILE_LEAD_NOTE_MAX_LENGTH,
    nullable: true,
  })
  note: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @BeforeInsert()
  setId() {
    if (!this.id) {
      this.id = generateId();
    }
  }
}
