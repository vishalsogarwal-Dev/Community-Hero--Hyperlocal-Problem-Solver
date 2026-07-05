import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { GamificationModule } from './gamification/gamification.module';
import { User } from './users/entities/user.entity';
import { UserGamification } from './users/entities/user-gamification.entity';
import { IssueReport } from './reports/entities/issue-report.entity';
import { Comment } from './reports/entities/comment.entity';
import { UpvoteValidation } from './reports/entities/upvote-validation.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST') || 'localhost',
        port: configService.get<number>('DB_PORT') || 5432,
        username: configService.get<string>('DB_USERNAME') || 'hero_user',
        password: configService.get<string>('DB_PASSWORD') || 'hero_password',
        database: configService.get<string>('DB_DATABASE') || 'community_hero',
        entities: [User, UserGamification, IssueReport, Comment, UpvoteValidation],
        synchronize: true, // Automatically synchronize schema on development.
      }),
    }),
    UsersModule,
    AuthModule,
    GamificationModule,
  ],
})
export class AppModule {}
