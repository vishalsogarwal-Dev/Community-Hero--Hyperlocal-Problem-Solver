/**
 * Task 5.3 — Redis Leaderboard Service.
 *
 * Uses Redis Sorted Sets (ZADD / ZREVRANGE) to maintain monthly hyperlocal
 * leaderboards. Key pattern:  leaderboard:{YYYY-MM}
 * Each member is a user ID; the score is the cumulative points for that month.
 */
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class LeaderboardService implements OnModuleDestroy {
  private readonly logger = new Logger(LeaderboardService.name);
  private readonly redis: Redis;

  constructor(private readonly configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.get<string>('REDIS_HOST') || 'localhost',
      port: this.configService.get<number>('REDIS_PORT') || 6379,
    });
  }

  private currentKey(): string {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return `leaderboard:${ym}`;
  }

  /** Add `delta` points to a user's monthly score. */
  async addPoints(userId: string, delta: number): Promise<void> {
    const key = this.currentKey();
    await this.redis.zadd(key, 'XX', 0, userId); // ensure member exists
    await this.redis.zincrby(key, delta, userId);
    await this.redis.expire(key, 60 * 60 * 24 * 40); // keep for 40 days
    this.logger.debug(`+${delta} pts → userId=${userId} on ${key}`);
  }

  /** Return the top N users (with their score) for the current month. */
  async getTopN(n = 10): Promise<Array<{ rank: number; userId: string; score: number }>> {
    const key = this.currentKey();
    const raw = await this.redis.zrevrange(key, 0, n - 1, 'WITHSCORES');
    const results: Array<{ rank: number; userId: string; score: number }> = [];
    for (let i = 0; i < raw.length; i += 2) {
      results.push({
        rank: results.length + 1,
        userId: raw[i],
        score: parseFloat(raw[i + 1]),
      });
    }
    return results;
  }

  /** Return a specific user's rank and score for the current month. */
  async getUserRank(userId: string): Promise<{ rank: number; score: number } | null> {
    const key = this.currentKey();
    const [rank, score] = await Promise.all([
      this.redis.zrevrank(key, userId),
      this.redis.zscore(key, userId),
    ]);
    if (rank === null) return null;
    return { rank: rank + 1, score: parseFloat(score || '0') };
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }
}
