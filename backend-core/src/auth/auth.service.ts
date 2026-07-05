import { Injectable, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async validateOrRegisterUser(email?: string, phone?: string) {
    if (!email && !phone) {
      throw new BadRequestException('Please provide email or phone number');
    }

    const emailHash = email ? this.usersService.hashIdentifier(email) : null;
    const phoneHash = phone ? this.usersService.hashIdentifier(phone) : null;

    let user = await this.usersService.findByHash(emailHash, phoneHash);

    if (!user) {
      user = await this.usersService.createUser(email, phone);
    }

    return this.login(user);
  }

  async login(user: any) {
    const payload = { sub: user.id, emailHash: user.emailHash };
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        anonymizedDisplayName: user.anonymizedDisplayName,
        isAnonymous: user.isAnonymous,
      },
    };
  }
}
