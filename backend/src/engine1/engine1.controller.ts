import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Header,
  HttpCode,
  HttpStatus,
  HttpException,
  UseGuards,
  Request,
} from '@nestjs/common';
import { IsString, IsNotEmpty, IsIn, IsOptional, IsArray, IsInt, ArrayMaxSize } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { Engine1Service } from './engine1.service';
import { Engine1Response } from '../ml/ml-client.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { parseShowdownTeam } from '../pokemon/showdown.parser';

class GenerateTeamDto {
  @IsString()
  @IsOptional()
  theme?: string;

  // Multi-type selection: when non-empty, overrides `theme`.
  // Example: ["steel", "water"] — team includes Steel OR Water type Pokémon.
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  themes?: string[];

  @IsString()
  @IsIn(['easy', 'medium', 'hard'])
  difficulty: 'easy' | 'medium' | 'hard';

  @IsString()
  @IsOptional()
  section?: string;

  @IsString()
  @IsOptional()
  group_name?: string;

  @IsString()
  @IsOptional()
  region?: string;

  @IsString()
  @IsOptional()
  gym_leader_name?: string;

  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @IsOptional()
  previous_team?: string[];

  @IsArray()
  @ArrayMaxSize(6)
  @IsOptional()
  previous_lineups?: string[][];

  @IsInt()
  @IsOptional()
  variation_seed?: number;
}

@Controller('engine1')
export class Engine1Controller {
  constructor(private readonly engine1Service: Engine1Service) {}

  /**
   * POST /api/engine1/generate
   * Generates a gym-leader team from the Pokémon pool using the ML service.
   */
  @Throttle({ ml: { limit: 10, ttl: 60_000 } })
  @UseGuards(JwtAuthGuard)
  @Post('generate')
  @HttpCode(HttpStatus.OK)
  async generate(
    @Body() dto: GenerateTeamDto,
    @Request() req: { user: { userId: string; username: string } },
  ): Promise<{ success: true; data: Engine1Response }> {
    try {
      const data = await this.engine1Service.generateTeam({ ...dto, userId: req.user.userId });
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
   * GET /api/engine1/showdown-export?match_id=<engine_id>
   * Returns the most recent gym_leader team (or the one identified by match_id)
   * formatted as Pokémon Showdown-compatible plain text.
   */
  @Get('showdown-export')
  @Header('Content-Type', 'text/plain')
  async showdownExport(@Query('match_id') matchId?: string): Promise<string> {
    const id = matchId === undefined ? undefined : Number.parseInt(matchId, 10);
    try {
      return await this.engine1Service.getShowdownExport(id);
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new HttpException(
        { success: false, error: (err as Error).message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/engine1/showdown-export-json?match_id=<engine_id>
   * Returns the PS-format team text alongside parsed team names and a link
   * to the Pokémon Showdown teambuilder.
   */
  @Get('showdown-export-json')
  async showdownExportJson(
    @Query('match_id') matchId?: string,
  ): Promise<{ success: true; data: { text: string; team_names: string[]; ps_link: string } }> {
    const id = matchId === undefined ? undefined : Number.parseInt(matchId, 10);
    try {
      const text = await this.engine1Service.getShowdownExport(id);
      const team_names = parseShowdownTeam(text);
      return {
        success: true,
        data: {
          text,
          team_names,
          ps_link: 'https://play.pokemonshowdown.com/teambuilder',
        },
      };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new HttpException(
        { success: false, error: (err as Error).message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
