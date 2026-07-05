import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  Index,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Comment } from './comment.entity';
import { UpvoteValidation } from './upvote-validation.entity';

@Entity('issue_reports')
export class IssueReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, (u) => u.reports, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reporter_id' })
  reporter: User;

  @Column()
  category: string;

  @Column({ default: 'Minor' })
  severity: string;

  @Column({ default: 'Reported' })
  status: string;

  @Column('double precision')
  latitude: number;

  @Column('double precision')
  longitude: number;

  @Index({ spatial: true })
  @Column('geometry', {
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  geoLocation: string;

  @Column({ name: 's3_media_url', nullable: true })
  s3MediaUrl: string;

  @Column({ name: 'original_media_url', nullable: true })
  originalMediaUrl: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => Comment, (c) => c.issue)
  comments: Comment[];

  @OneToMany(() => UpvoteValidation, (v) => v.issue)
  validations: UpvoteValidation[];
}
