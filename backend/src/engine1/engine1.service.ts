import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { MlClientService, Engine1Response } from '../ml/ml-client.service';
import { AuditService } from '../audit/audit.service';
import type { EngineOutput } from '../common/interfaces/pokemon.interface';
import { formatShowdownTeam } from '../pokemon/showdown.parser';
import { recommendTournamentLoadouts } from '../pokemon/battle-loadout';

export interface GenerateTeamParams {
  theme: string;
  difficulty: 'easy' | 'medium' | 'hard';
  section?: string;
  group_name?: string;
  region?: string;
  gym_leader_name?: string;
  userId?: string;
  previous_team?: string[];
  previous_lineups?: string[][];
  variation_seed?: number;
}

@Injectable()
export class Engine1Service {
  private readonly logger = new Logger(Engine1Service.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly ml: MlClientService,
    private readonly audit: AuditService,
  ) {}

  async generateTeam(params: GenerateTeamParams): Promise<Engine1Response> {
    const {
      theme,
      difficulty,
      section = '3ISC',
      group_name = '',
      region,
      gym_leader_name,
      userId,
      previous_team = [],
      previous_lineups = [],
      variation_seed,
    } = params;

    // 1. Load non-restricted Pokémon pool (excludes legendaries and mythicals).
    //    When a region is specified, filter to Pokémon native to that region.
    const poolFilter: Parameters<DatabaseService['findAllPokemon']>[0] = {
      restricted_status: 'none',
    };
    if (region) {
      poolFilter.native_region = region;
    }
    const pokemonPool = await this.db.findAllPokemon(poolFilter);
    this.logger.log(
      `Engine1: loaded ${pokemonPool.length} Pokémon for team generation` +
        (region ? ` (region: ${region})` : ''),
    );

    // 2. Call ML service — pass region through so the Python service can use it
    const result = await this.ml.generateGymLeaderTeam(
      theme,
      difficulty,
      pokemonPool,
      region,
      previous_team,
      previous_lineups,
      variation_seed,
    );
    result.team = await recommendTournamentLoadouts(result.team, pokemonPool);
    result.showdown_text = formatShowdownTeam(result.team, result.theme, result.difficulty);

    // 3. Persist to engine_output
    const nativeRegionNote = region
      ? `All Pokémon native to ${region}`
      : 'All Pokémon are native Kanto (Gen 1)';

    try {
      await this.db.insertEngineOutput({
        section,
        group_name,
        engine_type: 'gym_leader',
        model_used: result.model_used ?? 'ml-service',
        input_data: JSON.stringify({ theme, difficulty, pool_size: pokemonPool.length }),
        generated_output: JSON.stringify(result),
        native_region_validation: nativeRegionNote,
        region,
        gym_leader: gym_leader_name,
        type_specialization: theme,
        metric_used: 'silhouette_score',
        user_id: userId,
      });
    } catch (err) {
      this.logger.error(`Engine1: failed to save engine output — ${(err as Error).message}`);
    }

    // 4. Audit log
    this.audit.writeLog({
      user_or_group: group_name,
      action_done: 'INSERT',
      affected_table: 'engine_output',
      affected_record: `engine1:${theme}:${difficulty}`,
      new_value: JSON.stringify({ theme, difficulty, team: result.team }),
    });

    return result;
  }

  /**
   * Looks up the most recent gym_leader engine_output (or a specific one by
   * engine_id when match_id is provided) and formats the team as plain text.
   */
  async getShowdownExport(matchId?: number): Promise<string> {
    const output: EngineOutput = await this.resolveEngineOutput(matchId);

    // Parse the stored JSON — generated_output contains Engine1Response
    let parsed: Engine1Response;
    try {
      parsed = JSON.parse(output.generated_output) as Engine1Response;
    } catch {
      throw new NotFoundException({
        success: false,
        error: 'Engine output JSON is malformed and cannot be parsed.',
      });
    }

    const team = Array.isArray(parsed.team) ? parsed.team : [];
    const pokemonPool = await this.db.findPokemonByNames(team.map((slot) => slot.name));
    const enrichedTeam = await recommendTournamentLoadouts(team, pokemonPool);
    return formatShowdownTeam(enrichedTeam, parsed.theme, parsed.difficulty);
  }

  private async resolveEngineOutput(matchId?: number): Promise<EngineOutput> {
    if (matchId === undefined) {
      const rows = await this.db.findEngineOutputs('gym_leader');
      if (rows.length === 0) {
        throw new NotFoundException({
          success: false,
          error: 'No gym_leader engine output found.',
        });
      }
      return rows[0]; // already ordered timestamp DESC
    }

    const found = await this.db.findEngineOutputById(matchId);
    if (found === undefined) {
      throw new NotFoundException({
        success: false,
        error: `Engine output with id ${matchId} not found.`,
      });
    }
    return found;
  }
}
