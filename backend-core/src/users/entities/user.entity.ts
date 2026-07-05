import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  OneToMany,
} from 'typeorm';
import { UserGamification } from './user-gamification.entity';
import { IssueReport } from '../../reports/entities/issue-report.entity';
import { Comment } from '../../reports/entities/comment.entity';
import { UpvoteValidation } from '../../reports/entities/upvote-validation.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'phone_hash', nullable: true, unique: true })
  phoneHash: string | null;

  @Column({ name: 'email_hash', nullable: true, unique: true })
  emailHash: string | null;

  @Column({ name: 'anonymized_display_name' })
  anonymizedDisplayName: string;

  @Column({ name: 'is_anonymous', default: false })
  isAnonymous: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToOne(() => UserGamification, (g) => g.user, { cascade: true })
  gamification: UserGamification;

  @OneToMany(() => IssueReport, (r) => r.reporter)
  reports: IssueReport[];

  @OneToMany(() => Comment, (c) => c.user)
  comments: Comment[];

  @OneToMany(() => UpvoteValidation, (v) => v.user)
  validations: UpvoteValidation[];
}
