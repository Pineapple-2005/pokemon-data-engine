import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  NotFoundException,
} from '@nestjs/common';
import { IsString, IsNotEmpty, MinLength, IsOptional } from 'class-validator';
import { AuthService, TrainerAuthResponse } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { DatabaseService } from '../database/database.service';

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

class RegisterDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password: string;

  @IsString()
  @IsOptional()
  section?: string;

  // Trainer customisation fields — all optional at registration
  @IsString()
  @IsOptional()
  display_name?: string;

  @IsString()
  @IsOptional()
  trainer_class?: string;

  @IsString()
  @IsOptional()
  trainer_card_color?: string;

  @IsString()
  @IsOptional()
  starter_pokemon?: string;

  @IsString()
  @IsOptional()
  hometown?: string;

  @IsString()
  @IsOptional()
  favorite_type?: string;

  @IsString()
  @IsOptional()
  trainer_title?: string;

  @IsString()
  @IsOptional()
  rival_name?: string;

  @IsString()
  @IsOptional()
  trainer_id?: string;
}

class LoginDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

class UpdateProfileDto {
  @IsString()
  @IsOptional()
  display_name?: string;

  @IsString()
  @IsOptional()
  trainer_class?: string;

  @IsString()
  @IsOptional()
  trainer_card_color?: string;

  @IsString()
  @IsOptional()
  starter_pokemon?: string;

  @IsString()
  @IsOptional()
  hometown?: string;

  @IsString()
  @IsOptional()
  favorite_type?: string;

  @IsString()
  @IsOptional()
  trainer_title?: string;

  @IsString()
  @IsOptional()
  rival_name?: string;

  @IsString()
  @IsOptional()
  trainer_id?: string;
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly db: DatabaseService,
  ) {}

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
  ): Promise<{ success: true; data: TrainerAuthResponse }> {
    const { username, password, section, ...trainerFields } = dto;
    const result = await this.authService.register(username, password, section, trainerFields);
    return { success: true, data: result };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
  ): Promise<{ success: true; data: TrainerAuthResponse }> {
    const result = await this.authService.login(dto.username, dto.password);
    return { success: true, data: result };
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(
    @Request() req: { user: { userId: string; username: string } },
  ): Promise<{ success: true; data: Omit<TrainerAuthResponse, 'access_token'> }> {
    const user = await this.db.findUserById(req.user.userId);
    if (!user) throw new NotFoundException('User not found');
    return { success: true, data: { ...user, section: user.section ?? '3ISC' } };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  async updateProfile(
    @Request() req: { user: { userId: string; username: string } },
    @Body() dto: UpdateProfileDto,
  ): Promise<{ success: true; data: Omit<TrainerAuthResponse, 'access_token'> }> {
    const updated = await this.db.updateTrainerProfile(req.user.userId, dto);
    return { success: true, data: { ...updated, section: updated.section ?? '3ISC' } };
  }

  @Get('profile/:username')
  async getPublicProfile(
    @Param('username') username: string,
  ): Promise<{ success: true; data: Record<string, unknown> }> {
    const user = await this.db.findUserByUsername(username);
    if (!user) throw new NotFoundException('User not found');

    // Strip password_hash before returning
    const { password_hash: _ph, ...profile } = user;
    return { success: true, data: profile };
  }
}
