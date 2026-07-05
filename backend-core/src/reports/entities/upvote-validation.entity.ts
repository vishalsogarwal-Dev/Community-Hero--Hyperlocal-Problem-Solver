import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { IssueReport } from './issue-report.entity';
import { User } from '../../users/entities/user.entity';

@Entity('upvotes_validations')
@Unique(['issue', 'user']) // Prevent a user from voting on the same issue multiple times
export class UpvoteValidation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => IssueReport, (r) => r.validations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'issue_id' })
  issue: IssueReport;

  @ManyToOne(() => User, (u) => u.validations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'vote_type', type: 'varchar', length: 20 })
  voteType: string; // 'Verify' or 'Spam'

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
