import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body('email') email?: string, @Body('phone') phone?: string) {
    return this.authService.validateOrRegisterUser(email, phone);
  }
}
