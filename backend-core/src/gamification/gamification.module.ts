import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserGamification } from '../users/entities/user-gamification.entity';
import { GamificationService } from './gamification.service';
import { LeaderboardService } from './leaderboard.service';
import { EventsGateway } from './events.gateway';
import { GamificationController } from './gamification.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserGamification])],
  providers: [GamificationService, LeaderboardService, EventsGateway],
  controllers: [GamificationController],
  exports: [GamificationService, LeaderboardService, EventsGateway],
})
export class GamificationModule {}
