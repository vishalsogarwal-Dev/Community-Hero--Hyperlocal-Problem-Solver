import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { GamificationService } from './gamification.service';
import { LeaderboardService } from './leaderboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('gamification')
export class GamificationController {
  constructor(
    private readonly gamificationService: GamificationService,
    private readonly leaderboard: LeaderboardService,
  ) {}

  /** Internal endpoint for the async worker to trigger gamification events. */
  @Post('event')
  async handleEvent(
    @Body('event') event: string,
    @Body('userId') userId: string,
  ) {
    await this.gamificationService.handleEvent(event as any, userId);
    return { ok: true };
  }

  @Get('leaderboard')
  async getLeaderboard() {
    const top = await this.leaderboard.getTopN(20);
    return { leaderboard: top };
  }

  @Get('rank/:userId')
  @UseGuards(JwtAuthGuard)
  async getUserRank(@Param('userId') userId: string) {
    const result = await this.leaderboard.getUserRank(userId);
    return result ?? { rank: null, score: 0 };
  }
}
