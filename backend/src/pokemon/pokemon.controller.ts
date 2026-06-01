import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import { PokemonService, PokemonFilterParams } from './pokemon.service';
import { Pokemon } from '../common/interfaces/pokemon.interface';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

class ImportTeamDto {
  @IsString()
  @IsNotEmpty()
  showdown_text: string;
}

class AssignPokemonDto {
  @IsInt()
  @Min(1)
  pokemon_id: number;
}

@Controller('pokemon')
export class PokemonController {
  constructor(private readonly pokemonService: PokemonService) {}

  /**
   * GET /api/pokemon
   * Optional query params:
   *   ?role=sweeper
   *   &type=electric
   *   &is_assigned=1
   *   &native_region=Kanto
   *   &restricted_status=none   (pass 'none' to exclude legendaries/mythicals)
   */
  @Get()
  async findAll(
    @Query('role') role?: string,
    @Query('type') type?: string,
    @Query('is_assigned') is_assigned?: string,
    @Query('native_region') native_region?: string,
    @Query('restricted_status') restricted_status?: string,
  ): Promise<{ success: true; data: Pokemon[] }> {
    const filters: PokemonFilterParams = {};
    if (role) filters.role = role;
    if (type) filters.type = type;
    if (is_assigned !== undefined) filters.is_assigned = Number.parseInt(is_assigned, 10);
    if (native_region) filters.native_region = native_region;
    if (restricted_status !== undefined) filters.restricted_status = restricted_status;

    const data = await this.pokemonService.findAll(filters);
    return { success: true, data };
  }

  /**
   * GET /api/pokemon/assigned
   * Shortcut for is_assigned=1
   */
  @Get('assigned')
  async findAssigned(): Promise<{ success: true; data: Pokemon[] }> {
    const data = await this.pokemonService.findAssigned();
    return { success: true, data };
  }

  /**
   * GET /api/pokemon/by-region/:region
   * Returns all non-restricted Pokémon native to the given region.
   * MUST be declared before @Get(':name') so NestJS resolves this
   * literal segment before the dynamic :name param.
   */
  @Get('by-region/:region')
  async findByRegion(@Param('region') region: string): Promise<{ success: true; data: Pokemon[] }> {
    const data = await this.pokemonService.findByRegion(region);
    return { success: true, data };
  }

  /**
   * GET /api/pokemon/my-pool
   * Returns all Pokémon with user_assigned:boolean for the current user.
   * MUST be declared before @Get(':name').
   */
  @UseGuards(JwtAuthGuard)
  @Get('my-pool')
  async getMyPool(
    @Request() req: { user: { userId: string } },
  ): Promise<{ success: true; data: Array<Pokemon & { user_assigned: boolean }> }> {
    const data = await this.pokemonService.getMyPool(req.user.userId);
    return { success: true, data };
  }

  /**
   * POST /api/pokemon/assign
   * Add a Pokémon to the user's personal pool.
   */
  @UseGuards(JwtAuthGuard)
  @Post('assign')
  @HttpCode(HttpStatus.OK)
  async assign(
    @Body() dto: AssignPokemonDto,
    @Request() req: { user: { userId: string } },
  ): Promise<{ success: true }> {
    await this.pokemonService.assignToUser(req.user.userId, dto.pokemon_id);
    return { success: true };
  }

  /**
   * DELETE /api/pokemon/assign
   * Remove a Pokémon from the user's personal pool.
   */
  @UseGuards(JwtAuthGuard)
  @Delete('assign')
  @HttpCode(HttpStatus.OK)
  async unassign(
    @Body() dto: AssignPokemonDto,
    @Request() req: { user: { userId: string } },
  ): Promise<{ success: true }> {
    await this.pokemonService.unassignFromUser(req.user.userId, dto.pokemon_id);
    return { success: true };
  }

  /**
   * POST /api/pokemon/import-team
   * Parses a Pokémon Showdown export string and returns which Pokémon were
   * found in the database and which were not recognised.
   */
  @UseGuards(JwtAuthGuard)
  @Post('import-team')
  @HttpCode(HttpStatus.OK)
  async importTeam(
    @Body() dto: ImportTeamDto,
  ): Promise<{ success: true; data: { found: Pokemon[]; not_found: string[] } }> {
    const data = await this.pokemonService.importTeam(dto.showdown_text);
    return { success: true, data };
  }

  /**
   * GET /api/pokemon/:name
   */
  @Get(':name')
  async findOne(@Param('name') name: string): Promise<{ success: true; data: Pokemon }> {
    const data = await this.pokemonService.findOne(name.toLowerCase());
    return { success: true, data };
  }
}
