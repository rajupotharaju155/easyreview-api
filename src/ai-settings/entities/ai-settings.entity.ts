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
import { Location } from '../../locations/entities/location.entity';

export const AI_MAX_QUESTIONS = 5;
export const AI_MIN_OPTIONS = 2;
export const AI_MAX_OPTIONS = 10;
export const AI_QUESTION_MAX_LENGTH = 120;
export const AI_OPTION_MAX_LENGTH = 40;
export const AI_MAX_KEYWORDS = 20;
export const AI_MAX_LANGUAGES = 2;
export const AI_KEYWORD_MAX_LENGTH = 40;
export const AI_LANGUAGE_MAX_LENGTH = 40;

export type AiQuestion = {
  question: string;
  options: string[];
  /** When true, the customer can tap several options for this question. */
  multiSelect?: boolean;
};

@Entity('ai_settings')
@Index(['locationId'], { unique: true })
export class AiSettings {
  constructor(data: Partial<AiSettings>) {
    Object.assign(this, data);
  }

  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  id: string;

  @Column({ type: 'varchar', length: ID_LENGTH })
  locationId: string;

  @ManyToOne(() => Location, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'locationId' })
  location: Location;

  /** Business-configured questions shown before generating drafts. */
  @Column({ type: 'jsonb', nullable: true })
  questions: AiQuestion[] | null;

  /** Lets a business switch the questionnaire off without losing its config. */
  @Column({ type: 'boolean', default: true })
  questionsEnabled: boolean;

  @Column({ type: 'text', array: true, nullable: true })
  keywords: string[] | null;

  @Column({ type: 'text', array: true, nullable: true })
  languages: string[] | null;

  /** Reserved for the next batch of AI settings; not exposed by the API yet. */
  @Column({ type: 'varchar', length: 32, nullable: true })
  tone: string | null;

  @Column({ type: 'text', array: true, nullable: true })
  bannedPhrases: string[] | null;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
  })
  updatedAt: Date;

  @BeforeInsert()
  setId() {
    if (!this.id) {
      this.id = generateId();
    }
  }
}
