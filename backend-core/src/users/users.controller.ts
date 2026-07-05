import { Controller, Get, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getProfile(@Request() req) {
    const user = await this.usersService.findById(req.user.id);
    return {
      id: user.id,
      anonymizedDisplayName: user.anonymizedDisplayName,
      isAnonymous: user.isAnonymous,
      createdAt: user.createdAt,
      totalPoints: user.gamification?.totalPoints || 0,
      currentLevel: user.gamification?.currentLevel || 1,
      badgeMilestones: user.gamification?.badgeMilestones || [],
    };
  }

  @Patch('me/anonymity')
  async toggleAnonymity(@Request() req, @Body('isAnonymous') isAnonymous: boolean) {
    const user = await this.usersService.toggleAnonymity(req.user.id, isAnonymous);
    return { isAnonymous: user.isAnonymous };
  }

  @Patch('me/display-name')
  async updateDisplayName(@Request() req, @Body('name') name: string) {
    const user = await this.usersService.updateDisplayName(req.user.id, name);
    return { anonymizedDisplayName: user.anonymizedDisplayName };
  }
}
