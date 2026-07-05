import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('user_gamification')
export class UserGamification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, (u) => u.gamification, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'total_points', default: 0 })
  totalPoints: number;

  @Column({ name: 'current_level', default: 1 })
  currentLevel: number;

  @Column('jsonb', { name: 'badge_milestones', default: [] })
  badgeMilestones: string[];
}
