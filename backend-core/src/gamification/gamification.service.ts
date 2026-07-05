/**
 * Task 5.1 + 5.2 — Gamification Service.
 *
 * Consumes events (REPORT_CREATED, REPORT_VERIFIED, RESOLUTION_CONFIRMED)
 * and:
 *  - Appends points to the user's PostgreSQL row.
 *  - Checks milestone badge criteria.
 *  - Updates the Redis leaderboard.
 *  - Emits a WebSocket event if a badge is unlocked.
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserGamification } from '../users/entities/user-gamification.entity';
import { LeaderboardService } from './leaderboard.service';
import { EventsGateway } from './events.gateway';
import { GamificationEvent, POINTS, BADGES } from './gamification.constants';

@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);

  constructor(
    @InjectRepository(UserGamification)
    private readonly gamificationRepo: Repository<UserGamification>,
    private readonly leaderboard: LeaderboardService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async handleEvent(event: GamificationEvent, userId: string): Promise<void> {
    const delta = POINTS[event];
    if (!delta) return;

    // 1. Fetch or create gamification row
    let row = await this.gamificationRepo.findOne({ where: { user: { id: userId } } });
    if (!row) {
      row = this.gamificationRepo.create({ user: { id: userId } as any });
    }

    const before = row.totalPoints;
    row.totalPoints += delta;

    // 2. Check badge milestones
    const newBadges: string[] = [];
    for (const [threshold, badge] of Object.entries(BADGES)) {
      const t = Number(threshold);
      if (before < t && row.totalPoints >= t && !row.badgeMilestones.includes(badge)) {
        row.badgeMilestones = [...row.badgeMilestones, badge];
        newBadges.push(badge);
      }
    }

    // 3. Persist to PostgreSQL
    await this.gamificationRepo.save(row);
    this.logger.log(`[gamification] user=${userId} +${delta} pts → total=${row.totalPoints}`);

    // 4. Update Redis leaderboard
    await this.leaderboard.addPoints(userId, delta);

    // 5. Push WebSocket notifications for new badges
    for (const badge of newBadges) {
      this.logger.log(`[gamification] 🏅 Badge unlocked: "${badge}" for user=${userId}`);
      this.eventsGateway.emitToUser(userId, 'badge_unlocked', {
        badge,
        totalPoints: row.totalPoints,
      });
    }

    // 6. Always push a points-update event so the UI stays in sync
    this.eventsGateway.emitToUser(userId, 'points_updated', {
      delta,
      totalPoints: row.totalPoints,
      event,
    });
  }
}
