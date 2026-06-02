import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { MlClientService, Engine2Response } from '../ml/ml-client.service';
import { AuditService } from '../audit/audit.service';
import { Pokemon } from '../common/interfaces/pokemon.interface';
import { recommendCounterTournamentLoadouts } from '../pokemon/battle-loadout';
import { formatShowdownTeam } from '../pokemon/showdown.parser';

export interface CounterTeamParams {
  opponent_team: string[];
  section?: string;
  group_name?: string;
  challenger_region?: string;
  userId?: string;
}

export interface CounterTeamFromDataParams {
  opponent_team: Pokemon[];
  pokemon_pool: Pokemon[];
  section?: string;
  group_name?: string;
  challenger_region?: string;
  userId?: string;
}

@Injectable()
export class Engine2Service {
  private readonly logger = new Logger(Engine2Service.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly ml: MlClientService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Returns the initial candidate pool before fallback/supplement logic is applied.
   * Uses the user's personal pool (legendary-filtered) when available, otherwise
   * falls back to the global is_assigned pool. Both paths respect challenger_region.
   */
  private async selectInitialPool(userId: string | undefined, challenger_region: string | undefined): Promise<Pokemon[]> {
    if (userId) {
      const userPool = (await this.db.getUserAssignedPokemon(userId))
        .filter((p) => (p.restricted_status ?? 'none') === 'none');
      if (userPool.length > 0) {
        return challenger_region
          ? userPool.filter((p) => p.native_region?.toLowerCase() === challenger_region.toLowerCase())
          : userPool;
      }
    }
    const f: Parameters<typeof this.db.findAllPokemon>[0] = { is_assigned: 1, restricted_status: 'none' };
    if (challenger_region) f.native_region = challenger_region;
    return this.db.findAllPokemon(f);
  }

  /** Merges unique extras into pool, keyed by lowercased name. */
  private mergeExtras(pool: Pokemon[], extras: Pokemon[]): Pokemon[] {
    const seen = new Set(pool.map((p) => p.name.toLowerCase()));
    return [...pool, ...extras.filter((p) => !seen.has(p.name.toLowerCase()))];
  }

  /**
   * Builds the non-restricted Pokémon pool for Engine 2 counter-pick scoring.
   *
   * Priority order:
   *   1. User's personal pool (legendary-filtered), optionally narrowed by region.
   *   2. Global is_assigned pool, optionally narrowed by region.
   *   3. All non-restricted Pokémon narrowed by region (if is_assigned yields nothing).
   *   4. All non-restricted Pokémon with no region constraint (last resort).
   *
   * After the above, if fewer than 6 candidates remain, the pool is supplemented
   * so the ML engine can always return 6 counters.
   */
  private async resolveCounterPool(userId: string | undefined, challenger_region: string | undefined): Promise<Pokemon[]> {
    let pool = await this.selectInitialPool(userId, challenger_region);

    // Fallback: no is_assigned rows seeded — use all non-restricted Pokémon
    if (pool.length === 0) {
      const f: Parameters<typeof this.db.findAllPokemon>[0] = { restricted_status: 'none' };
      if (challenger_region) f.native_region = challenger_region;
      pool = await this.db.findAllPokemon(f);
    }
    // Last resort: drop region constraint entirely
    if (pool.length === 0) {
      pool = await this.db.findAllPokemon({ restricted_status: 'none' });
    }

    // Supplement to guarantee at least 6 candidates for ML scoring
    if (pool.length < 6) {
      const f: Parameters<typeof this.db.findAllPokemon>[0] = { restricted_status: 'none' };
      if (challenger_region) f.native_region = challenger_region;
      pool = this.mergeExtras(pool, await this.db.findAllPokemon(f));
    }
    if (pool.length < 6) {
      pool = this.mergeExtras(pool, await this.db.findAllPokemon({ restricted_status: 'none' }));
    }

    return pool;
  }

  async getCounterTeam(params: CounterTeamParams): Promise<Engine2Response> {
    const {
      opponent_team,
      section = '3ISC',
      group_name = '',
      challenger_region,
      userId,
    } = params;

    // 1. Fetch opponent Pokémon data
    const opponentData = await this.db.findPokemonByNames(opponent_team);
    if (opponentData.length === 0) {
      throw new BadRequestException({
        success: false,
        error: 'None of the opponent Pokémon were found in the database.',
      });
    }

    // 2. Resolve counter-team candidate pool
    const assignedPool = await this.resolveCounterPool(userId, challenger_region);

    this.logger.log(
      `Engine2: opponent=${opponentData.length}, assigned_pool=${assignedPool.length}` +
        (challenger_region ? ` (challenger_region: ${challenger_region})` : ''),
    );

    // 3. Call ML service
    const result = await this.ml.getCounterTeam(opponent_team, opponentData, assignedPool);

    // Enrich recommended_team with pokeapi_id for frontend sprites
    const poolById = new Map(assignedPool.map((p) => [p.name.toLowerCase(), p.pokeapi_id]));
    result.recommended_team.forEach((c) => {
      c.pokeapi_id = poolById.get(c.name.toLowerCase());
    });
    result.recommended_team = await recommendCounterTournamentLoadouts(result.recommended_team, assignedPool);
    result.showdown_text = formatShowdownTeam(result.recommended_team);

    // Enrich opponent_team_data for VS table sprites
    result.opponent_team_data = opponentData.map((p) => ({
      name: p.name,
      pokeapi_id: p.pokeapi_id,
      type_1: p.type_1 ?? undefined,
      type_2: p.type_2 ?? undefined,
    }));

    // 4. Persist to engine_output
    const nativeRegionNote = challenger_region
      ? `Challenger pool filtered to ${challenger_region}`
      : 'No region filter applied';

    try {
      await this.db.insertEngineOutput({
        section,
        group_name,
        engine_type: 'counter_pick',
        model_used: result.model_used ?? 'ml-service',
        input_data: JSON.stringify({ opponent_team }),
        generated_output: JSON.stringify(result),
        native_region_validation: nativeRegionNote,
        challenger_region,
        target_gym_leader: group_name || 'opponent',
        metric_used: 'counter_success_rate',
        user_id: userId,
      });
    } catch (err) {
      this.logger.error(`Engine2: failed to save engine output — ${(err as Error).message}`);
    }

    // 5. Audit log
    this.audit.writeLog({
      user_or_group: group_name,
      action_done: 'INSERT',
      affected_table: 'engine_output',
      affected_record: `engine2:${opponent_team.join(',')}`,
      new_value: JSON.stringify({ recommended_team: result.recommended_team }),
    });

    return result;
  }

  async getCounterTeamFromData(params: CounterTeamFromDataParams): Promise<Engine2Response> {
    const {
      opponent_team,
      pokemon_pool,
      section = '3ISC',
      group_name = '',
      challenger_region,
      userId,
    } = params;

    // opponent_team and pokemon_pool are already validated as non-empty by the DTO,
    // but guard here too so the service is safe to call directly.
    if (opponent_team.length === 0) {
      throw new BadRequestException({
        success: false,
        error: 'opponent_team must not be empty.',
      });
    }
    if (pokemon_pool.length === 0) {
      throw new BadRequestException({
        success: false,
        error: 'pokemon_pool must not be empty.',
      });
    }

    const opponentNames = opponent_team.map((p) => p.name);

    this.logger.log(
      `Engine2 (from-data): opponent=${opponent_team.length}, pool=${pokemon_pool.length}` +
        (challenger_region ? ` (challenger_region: ${challenger_region})` : ''),
    );

    // Call ML service with caller-supplied data — no DB lookup required
    const result = await this.ml.getCounterTeam(opponentNames, opponent_team, pokemon_pool);

    // Enrich sprites
    const fromDataPoolById = new Map(pokemon_pool.map((p) => [p.name.toLowerCase(), p.pokeapi_id]));
    result.recommended_team.forEach((c) => { c.pokeapi_id = fromDataPoolById.get(c.name.toLowerCase()); });
    result.recommended_team = await recommendCounterTournamentLoadouts(result.recommended_team, pokemon_pool);
    result.showdown_text = formatShowdownTeam(result.recommended_team);
    result.opponent_team_data = opponent_team.map((p) => ({
      name: p.name,
      pokeapi_id: p.pokeapi_id,
      type_1: p.type_1 ?? undefined,
      type_2: p.type_2 ?? undefined,
    }));

    // Persist to engine_output
    const nativeRegionNote = challenger_region
      ? `Challenger pool filtered to ${challenger_region}`
      : 'No region filter applied';

    try {
      await this.db.insertEngineOutput({
        section,
        group_name,
        engine_type: 'counter_pick',
        model_used: result.model_used ?? 'ml-service',
        input_data: JSON.stringify({ opponent_team: opponentNames }),
        generated_output: JSON.stringify(result),
        native_region_validation: nativeRegionNote,
        challenger_region,
        target_gym_leader: group_name || 'opponent',
        metric_used: 'counter_success_rate',
        user_id: userId,
      });
    } catch (err) {
      this.logger.error(`Engine2 (from-data): failed to save engine output — ${(err as Error).message}`);
    }

    // Audit log
    this.audit.writeLog({
      user_or_group: group_name,
      action_done: 'INSERT',
      affected_table: 'engine_output',
      affected_record: `engine2:${opponentNames.join(',')}`,
      new_value: JSON.stringify({ recommended_team: result.recommended_team }),
    });

    return result;
  }

  // F8: Counter Success Rate — scoped to userId when provided
  async getCounterSuccessRate(userId?: string): Promise<{ total: number; wins: number; rate: number; rate_pct: string }> {
    const { total, wins, rate } = await this.db.getCounterSuccessRate(userId);
    return { total, wins, rate, rate_pct: `${(rate * 100).toFixed(1)}%` };
  }
}
