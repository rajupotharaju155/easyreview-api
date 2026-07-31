import { Exclude } from 'class-transformer';
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Location } from '../../locations/entities/location.entity';
import { generateId, ID_LENGTH } from '../../common/utils/id';

@Entity('users')
export class User {
  constructor(data: Partial<User>) {
    Object.assign(this, data);
  }

  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  @Column({ type: 'varchar', nullable: true })
  @Exclude()
  password: string | null;

  /** Google account subject (`sub`) when the user signed in with Google. */
  @Column({ type: 'varchar', unique: true, nullable: true })
  googleSub: string | null;

  @Column({ default: false })
  emailVerified: boolean;

  @Column({ type: 'varchar', nullable: true })
  @Exclude()
  emailVerificationOtp: string | null;

  @Column({ type: 'timestamp', nullable: true })
  @Exclude()
  emailVerificationOtpExpiresAt: Date | null;

  @OneToMany(() => Location, (location) => location.user)
  locations: Location[];

  @CreateDateColumn({
    type: 'timestamp',
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamp',
  })
  updatedAt: Date;

  @DeleteDateColumn({
    type: 'timestamp',
  })
  deletedAt: Date;

  @BeforeInsert()
  setId() {
    if (!this.id) {
      this.id = generateId();
    }
  }
}
