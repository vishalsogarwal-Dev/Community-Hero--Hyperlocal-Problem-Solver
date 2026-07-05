import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserGamification } from './entities/user-gamification.entity';
import * as crypto from 'crypto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(UserGamification)
    private gamificationRepository: Repository<UserGamification>,
  ) {}

  hashIdentifier(val: string): string | null {
    if (!val) return null;
    return crypto.createHash('sha256').update(val).digest('hex');
  }

  async findByHash(emailHash?: string | null, phoneHash?: string | null): Promise<User | null> {
    if (!emailHash && !phoneHash) return null;
    const query = this.usersRepository.createQueryBuilder('user')
      .leftJoinAndSelect('user.gamification', 'gamification');
    
    if (emailHash) {
      query.orWhere('user.email_hash = :emailHash', { emailHash });
    }
    if (phoneHash) {
      query.orWhere('user.phone_hash = :phoneHash', { phoneHash });
    }
    
    return query.getOne();
  }

  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { id },
      relations: { gamification: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async createUser(email?: string, phone?: string): Promise<User> {
    const emailHash = email ? this.hashIdentifier(email) : null;
    const phoneHash = phone ? this.hashIdentifier(phone) : null;

    const existing = await this.findByHash(emailHash, phoneHash);
    if (existing) {
      throw new ConflictException('User with this email or phone already exists');
    }

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const anonymizedDisplayName = `Hero#${randomSuffix}`;

    const user = new User();
    user.emailHash = emailHash;
    user.phoneHash = phoneHash;
    user.anonymizedDisplayName = anonymizedDisplayName;

    const gamification = new UserGamification();
    gamification.totalPoints = 0;
    gamification.currentLevel = 1;
    gamification.badgeMilestones = [];
    user.gamification = gamification;

    return this.usersRepository.save(user);
  }

  async toggleAnonymity(userId: string, isAnonymous: boolean): Promise<User> {
    const user = await this.findById(userId);
    user.isAnonymous = isAnonymous;
    return this.usersRepository.save(user);
  }

  async updateDisplayName(userId: string, name: string): Promise<User> {
    const user = await this.findById(userId);
    user.anonymizedDisplayName = name;
    return this.usersRepository.save(user);
  }
}
