import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  HttpException,
  UseGuards,
  Request,
} from '@nestjs/common';
import { IsArray, IsString, IsOptional, ArrayNotEmpty, ArrayMaxSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Engine2Service } from './engine2.service';
import { Engine2Response } from '../ml/ml-client.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';

class CounterTeamDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(4)
  @IsString({ each: true })
  opponent_team: string[];

  @IsString()
  @IsOptional()
  section?: string;

  @IsString()
  @IsOptional()
  group_name?: string;

  @IsString()
  @IsOptional()
  challenger_region?: string;
}

class CounterFromDataDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => Object)
  opponent_team: Record<string, unknown>[];

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => Object)
  pokemon_pool: Record<string, unknown>[];

  @IsString()
  @IsOptional()
  section?: string;

  @IsString()
  @IsOptional()
  group_name?: string;

  @IsString()
  @IsOptional()
  challenger_region?: string;
}

@Controller('engine2')
export class Engine2Controller {
  constructor(private readonly engine2Service: Engine2Service) {}

  /**
   * POST /api/engine2/counter
   * Returns a counter team for the given opponent team.
   */
  @UseGuards(JwtAuthGuard)
  @Post('counter')
  @HttpCode(HttpStatus.OK)
  async counter(
    @Body() dto: CounterTeamDto,
    @Request() req: { user: { userId: string; username: string } },
  ): Promise<{ success: true; data: Engine2Response }> {
    try {
      const data = await this.engine2Service.getCounterTeam({ ...dto, userId: req.user.userId });
      return { success: true, data };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new HttpException(
        { success: false, error: (err as Error).message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * POST /api/engine2/counter-from-data
   * Fully stateless counter-team endpoint — accepts both the opponent team and the
   * counter Pokémon pool as raw stat objects. No database lookups are performed.
   */
  @UseGuards(JwtAuthGuard)
  @Post('counter-from-data')
  @HttpCode(HttpStatus.OK)
  async counterFromData(
    @Body() dto: CounterFromDataDto,
    @Request() req: { user: { userId: string; username: string } },
  ): Promise<{ success: true; data: Engine2Response }> {
    try {
      const data = await this.engine2Service.getCounterTeamFromData({
        opponent_team: dto.opponent_team as any,
        pokemon_pool: dto.pokemon_pool as any,
        section: dto.section,
        group_name: dto.group_name,
        challenger_region: dto.challenger_region,
        userId: req.user.userId,
      });
      return { success: true, data };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new HttpException(
        { success: false, error: (err as Error).message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/engine2/metrics
   * Returns Counter Success Rate scoped to the authenticated user (F8 requirement).
   * Unauthenticated callers receive zero-value metrics.
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get('metrics')
  @HttpCode(HttpStatus.OK)
  async getMetrics(
    @Request() req: { user?: { userId: string; username: string } },
  ): Promise<{ success: true; data: { total: number; wins: number; rate: number; rate_pct: string } }> {
    const data = await this.engine2Service.getCounterSuccessRate(req.user?.userId);
    return { success: true, data };
  }
}
