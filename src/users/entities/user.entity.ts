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

  @Column({ nullable: true })
  name: string;

  @Column()
  @Exclude()
  password: string;

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
