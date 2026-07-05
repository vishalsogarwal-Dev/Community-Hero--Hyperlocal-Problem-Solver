import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { IssueReport } from './issue-report.entity';
import { User } from '../../users/entities/user.entity';

@Entity('comments')
export class Comment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => IssueReport, (r) => r.comments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'issue_id' })
  issue: IssueReport;

  @ManyToOne(() => User, (u) => u.comments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column('text', { name: 'comment_text' })
  commentText: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
