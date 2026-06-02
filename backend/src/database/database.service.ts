import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Pool } from 'pg';

import {
  Pokemon,
  EngineOutput,
  Prediction,
  GroundTruth,
  PredictionWithResult,
  AuditLog,
  PredictionAccuracy,
  ConfusionMatrix,
} from '../common/interfaces/pokemon.interface';

import { CreatePredictionDto } from '../common/dto/create-prediction.dto';
import { CreateGroundTruthDto } from '../common/dto/create-ground-truth.dto';
import { CreateEngineOutputDto } from '../common/dto/create-engine-output.dto';
import { CreateAuditLogDto } from '../common/dto/create-audit-log.dto';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool;

  // ---------------------------------------------------------------------------
  // In-memory TTL cache for findAllPokemon — avoids redundant full table scans
  // on concurrent ML requests. TTL: 5 minutes. Invalidated on any write to
  // pokemon_data (is_assigned updates) via clearPokemonCache().
  // ---------------------------------------------------------------------------
  private readonly pokemonCache = new Map<string, { rows: Pokemon[]; ts: number }>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async onModuleInit(): Promise<void> {
    this.pool = new Pool({
      host:     process.env.DB_HOST     || 'aws-0-ap-southeast-2.pooler.supabase.com',
      port:     Number(process.env.DB_PORT)   || 6543,
      user:     process.env.DB_USER     || 'postgres',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME     || 'postgres',
      ssl: { rejectUnauthorized: false }, // Supabase CA not in Node default store
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    // Test connection
    const client = await this.pool.connect();
    client.release();
    this.logger.log('Connected to Supabase PostgreSQL');

    await this.initSchema();
    this.logger.log('Schema verified.');
  }

  // ---------------------------------------------------------------------------
  // Schema initialisation — only runs idempotent migrations (ADD COLUMN IF NOT EXISTS)
  // Tables already exist in Supabase; skip CREATE TABLE blocks entirely.
  // ---------------------------------------------------------------------------

  private async initSchema(): Promise<void> {
    await this.createShowdownReplayTable();
    // ── Idempotent column migrations ──
    await this.runMigration(`ALTER TABLE pokemon_data ADD COLUMN IF NOT EXISTS native_region TEXT NOT NULL DEFAULT 'Kanto'`);
    await this.runMigration(`ALTER TABLE pokemon_data ADD COLUMN IF NOT EXISTS generation INTEGER NOT NULL DEFAULT 1`);
    await this.runMigration(`ALTER TABLE pokemon_data ADD COLUMN IF NOT EXISTS restricted_status TEXT NOT NULL DEFAULT 'none'`);
    await this.runMigration(`ALTER TABLE engine_output ADD COLUMN IF NOT EXISTS native_region_validation TEXT`);
    await this.runMigration(`ALTER TABLE engine_output ADD COLUMN IF NOT EXISTS region TEXT`);
    await this.runMigration(`ALTER TABLE engine_output ADD COLUMN IF NOT EXISTS type_specialization TEXT`);
    await this.runMigration(`ALTER TABLE engine_output ADD COLUMN IF NOT EXISTS gym_leader TEXT`);
    await this.runMigration(`ALTER TABLE engine_output ADD COLUMN IF NOT EXISTS metric_used TEXT`);
    await this.runMigration(`ALTER TABLE engine_output ADD COLUMN IF NOT EXISTS challenger_region TEXT`);
    await this.runMigration(`ALTER TABLE engine_output ADD COLUMN IF NOT EXISTS target_gym_leader TEXT`);
    await this.runMigration(`ALTER TABLE engine_output ADD COLUMN IF NOT EXISTS counter_score DOUBLE PRECISION`);
    await this.runMigration(`ALTER TABLE engine_output ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL`);
    await this.runMigration(`ALTER TABLE prediction ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL`);
    await this.runMigration(`ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL`);

    // ── Trainer customization columns ──
    await this.runMigration(`ALTER TABLE users ADD COLUMN IF NOT EXISTS trainer_class TEXT DEFAULT 'youngster'`);
    await this.runMigration(`ALTER TABLE users ADD COLUMN IF NOT EXISTS trainer_card_color TEXT DEFAULT 'red'`);
    await this.runMigration(`ALTER TABLE users ADD COLUMN IF NOT EXISTS starter_pokemon TEXT DEFAULT 'charmander'`);
    await this.runMigration(`ALTER TABLE users ADD COLUMN IF NOT EXISTS hometown TEXT DEFAULT 'Pallet Town'`);
    await this.runMigration(`ALTER TABLE users ADD COLUMN IF NOT EXISTS favorite_type TEXT DEFAULT 'Normal'`);
    await this.runMigration(`ALTER TABLE users ADD COLUMN IF NOT EXISTS trainer_title TEXT DEFAULT 'Trainer'`);
    await this.runMigration(`ALTER TABLE users ADD COLUMN IF NOT EXISTS rival_name TEXT DEFAULT ''`);
    await this.runMigration(`ALTER TABLE users ADD COLUMN IF NOT EXISTS trainer_id TEXT DEFAULT ''`);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS user_pokemon_assignment (
        id         SERIAL PRIMARY KEY,
        user_id    UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        pokemon_id INTEGER NOT NULL REFERENCES pokemon_data(pokemon_id) ON DELETE CASCADE,
        assigned_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (user_id, pokemon_id)
      )
    `);
    this.logger.log('Migration: user_pokemon_assignment table ensured');

    // ── Seed restricted_status for Gen 1 legendaries/mythicals ──
    await this.pool.query(`
      UPDATE pokemon_data SET restricted_status = 'legendary'
      WHERE pokeapi_id IN (144, 145, 146, 150) AND restricted_status = 'none'
    `);
    await this.pool.query(`
      UPDATE pokemon_data SET restricted_status = 'mythical'
      WHERE pokeapi_id = 151 AND restricted_status = 'none'
    `);

    // ── Region / generation migrations (Gen 2–9) ──
    await this.pool.query(`
      UPDATE pokemon_data SET native_region = 'Johto', generation = 2
      WHERE pokeapi_id BETWEEN 152 AND 251 AND native_region = 'Kanto'
    `);
    await this.pool.query(`
      UPDATE pokemon_data SET native_region = 'Hoenn', generation = 3
      WHERE pokeapi_id BETWEEN 252 AND 386 AND native_region = 'Kanto'
    `);
    await this.pool.query(`
      UPDATE pokemon_data SET native_region = 'Sinnoh', generation = 4
      WHERE pokeapi_id BETWEEN 387 AND 493 AND native_region = 'Kanto'
    `);
    await this.pool.query(`
      UPDATE pokemon_data SET native_region = 'Unova', generation = 5
      WHERE pokeapi_id BETWEEN 494 AND 649 AND native_region = 'Kanto'
    `);
    await this.pool.query(`
      UPDATE pokemon_data SET native_region = 'Kalos', generation = 6
      WHERE pokeapi_id BETWEEN 650 AND 721 AND native_region = 'Kanto'
    `);
    await this.pool.query(`
      UPDATE pokemon_data SET native_region = 'Alola', generation = 7
      WHERE pokeapi_id BETWEEN 722 AND 809 AND native_region = 'Kanto'
    `);
    await this.pool.query(`
      UPDATE pokemon_data SET native_region = 'Galar', generation = 8
      WHERE pokeapi_id BETWEEN 810 AND 905 AND native_region = 'Kanto'
    `);
    await this.pool.query(`
      UPDATE pokemon_data SET native_region = 'Paldea', generation = 9
      WHERE pokeapi_id BETWEEN 906 AND 1025 AND native_region = 'Kanto'
    `);
    this.logger.log('Migration: region/generation seeds applied');

    // ── Seed restricted_status for Gen 2–9 legendaries/mythicals ──
    await this.pool.query(`
      UPDATE pokemon_data SET restricted_status = 'legendary'
      WHERE pokeapi_id IN (243, 244, 245, 249, 250) AND restricted_status = 'none'
    `);
    await this.pool.query(`
      UPDATE pokemon_data SET restricted_status = 'mythical'
      WHERE pokeapi_id IN (251) AND restricted_status = 'none'
    `);
    await this.pool.query(`
      UPDATE pokemon_data SET restricted_status = 'legendary'
      WHERE pokeapi_id IN (377, 378, 379, 380, 381, 382, 383, 384) AND restricted_status = 'none'
    `);
    await this.pool.query(`
      UPDATE pokemon_data SET restricted_status = 'mythical'
      WHERE pokeapi_id IN (385, 386) AND restricted_status = 'none'
    `);
    await this.pool.query(`
      UPDATE pokemon_data SET restricted_status = 'legendary'
      WHERE pokeapi_id IN (480, 481, 482, 483, 484, 485, 486, 487, 488) AND restricted_status = 'none'
    `);
    await this.pool.query(`
      UPDATE pokemon_data SET restricted_status = 'mythical'
      WHERE pokeapi_id IN (489, 490, 491, 492, 493) AND restricted_status = 'none'
    `);
    await this.pool.query(`
      UPDATE pokemon_data SET restricted_status = 'legendary'
      WHERE pokeapi_id IN (494, 638, 639, 640, 641, 642, 643, 644, 645, 646) AND restricted_status = 'none'
    `);
    await this.pool.query(`
      UPDATE pokemon_data SET restricted_status = 'mythical'
      WHERE pokeapi_id IN (647, 648, 649) AND restricted_status = 'none'
    `);
    await this.pool.query(`
      UPDATE pokemon_data SET restricted_status = 'legendary'
      WHERE pokeapi_id IN (716, 717, 718) AND restricted_status = 'none'
    `);
    await this.pool.query(`
      UPDATE pokemon_data SET restricted_status = 'mythical'
      WHERE pokeapi_id IN (719, 720, 721) AND restricted_status = 'none'
    `);
    await this.pool.query(`
      UPDATE pokemon_data SET restricted_status = 'legendary'
      WHERE pokeapi_id IN (785, 786, 787, 788, 789, 791, 792, 793, 794, 795, 796, 797, 798, 799, 800) AND restricted_status = 'none'
    `);
    await this.pool.query(`
      UPDATE pokemon_data SET restricted_status = 'mythical'
      WHERE pokeapi_id IN (801, 802) AND restricted_status = 'none'
    `);
    await this.pool.query(`
      UPDATE pokemon_data SET restricted_status = 'legendary'
      WHERE pokeapi_id IN (888, 889, 890, 894, 895, 896, 897, 898) AND restricted_status = 'none'
    `);
    await this.pool.query(`
      UPDATE pokemon_data SET restricted_status = 'mythical'
      WHERE pokeapi_id IN (891, 892, 893) AND restricted_status = 'none'
    `);
    await this.pool.query(`
      UPDATE pokemon_data SET restricted_status = 'legendary'
      WHERE pokeapi_id IN (1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009, 1010) AND restricted_status = 'none'
    `);
    await this.pool.query(`
      UPDATE pokemon_data SET restricted_status = 'mythical'
      WHERE pokeapi_id IN (1011, 1012, 1013, 1014, 1015, 1016, 1017, 1018, 1019, 1020, 1021, 1022, 1023, 1024, 1025) AND restricted_status = 'none'
    `);
    this.logger.log('Migration: Gen 2-9 restricted_status seeds applied');
  }

  async createShowdownReplayTable(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS showdown_replay (
        replay_id   TEXT    PRIMARY KEY,
        format      TEXT    NOT NULL,
        p1          TEXT    NOT NULL,
        p2          TEXT    NOT NULL,
        winner      TEXT,
        upload_time INTEGER NOT NULL,
        synced_at   TEXT    NOT NULL
      )
    `);
    this.logger.log('Migration: showdown_replay table ensured');
  }

  private async runMigration(sql: string): Promise<void> {
    await this.pool.query(sql);
    this.logger.log(`Migration: ${sql.slice(0, 60)}`);
  }

  // ---------------------------------------------------------------------------
  // Pokémon queries
  // ---------------------------------------------------------------------------

  async findAllPokemon(filters?: {
    is_assigned?: number;
    role_label?: string;
    type_1?: string;
    native_region?: string;
    restricted_status?: string;
  }): Promise<Pokemon[]> {
    // Cache key uniquely identifies the filter combination so different filter
    // sets (e.g. region=Kanto vs region=Johto) get their own cache entries.
    const cacheKey = JSON.stringify(filters ?? {});
    const cached = this.pokemonCache.get(cacheKey);
    const now = Date.now();

    if (cached !== undefined && now - cached.ts < this.CACHE_TTL_MS) {
      return cached.rows;
    }

    let sql = 'SELECT * FROM pokemon_data WHERE 1=1';
    const params: unknown[] = [];
    let idx = 1;

    if (filters) {
      if (filters.is_assigned !== undefined) {
        sql += ` AND is_assigned = $${idx++}`;
        params.push(filters.is_assigned);
      }
      if (filters.role_label) {
        sql += ` AND role_label = $${idx++}`;
        params.push(filters.role_label);
      }
      if (filters.type_1) {
        sql += ` AND type_1 = $${idx++}`;
        params.push(filters.type_1);
      }
      if (filters.native_region) {
        sql += ` AND native_region = $${idx++}`;
        params.push(filters.native_region);
      }
      if (filters.restricted_status !== undefined) {
        if (filters.restricted_status === 'none') {
          sql += ` AND (restricted_status = $${idx++} OR restricted_status IS NULL)`;
          params.push(filters.restricted_status);
        } else {
          sql += ` AND restricted_status = $${idx++}`;
          params.push(filters.restricted_status);
        }
      }
    }

    sql += ' ORDER BY total_base_stats DESC';

    const rows = (await this.pool.query(sql, params)).rows as Pokemon[];
    this.pokemonCache.set(cacheKey, { rows, ts: now });
    return rows;
  }

  /** Evict all cached pokemon pool entries (call after any write to pokemon_data). */
  clearPokemonCache(): void {
    this.pokemonCache.clear();
  }

  async findPokemonByName(name: string): Promise<Pokemon | undefined> {
    const result = await this.pool.query(
      'SELECT * FROM pokemon_data WHERE name = $1',
      [name],
    );
    return result.rows[0] as Pokemon | undefined;
  }

  async findAssignedPokemon(): Promise<Pokemon[]> {
    return (
      await this.pool.query(
        'SELECT * FROM pokemon_data WHERE is_assigned = 1 ORDER BY name',
      )
    ).rows as Pokemon[];
  }

  async findPokemonByNames(names: string[]): Promise<Pokemon[]> {
    if (!names.length) return [];
    // Build a parameterised ANY clause — PostgreSQL supports array parameters
    const result = await this.pool.query(
      `SELECT * FROM pokemon_data WHERE name = ANY($1) ORDER BY total_base_stats DESC`,
      [names],
    );
    return result.rows as Pokemon[];
  }

  // Returns only the Pokémon in the user's personal pool
  async getUserAssignedPokemon(userId: string): Promise<Pokemon[]> {
    const result = await this.pool.query(
      `SELECT pd.* FROM pokemon_data pd
       INNER JOIN user_pokemon_assignment upa ON upa.pokemon_id = pd.pokemon_id
       WHERE upa.user_id = $1
       ORDER BY pd.total_base_stats DESC`,
      [userId],
    );
    return result.rows as Pokemon[];
  }

  // Returns ALL Pokémon with a user_assigned boolean added
  async getPokemonWithUserPool(userId: string): Promise<Array<Pokemon & { user_assigned: boolean }>> {
    const result = await this.pool.query(
      `SELECT pd.*,
         (EXISTS (
           SELECT 1 FROM user_pokemon_assignment upa
           WHERE upa.user_id = $1 AND upa.pokemon_id = pd.pokemon_id
         )) AS user_assigned
       FROM pokemon_data pd
       ORDER BY pd.total_base_stats DESC`,
      [userId],
    );
    return result.rows as Array<Pokemon & { user_assigned: boolean }>;
  }

  // Add a Pokémon to the user's pool (idempotent)
  async assignPokemonToUser(userId: string, pokemonId: number): Promise<void> {
    await this.pool.query(
      `INSERT INTO user_pokemon_assignment (user_id, pokemon_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, pokemon_id) DO NOTHING`,
      [userId, pokemonId],
    );
  }

  // Remove a Pokémon from the user's pool
  async unassignPokemonFromUser(userId: string, pokemonId: number): Promise<void> {
    await this.pool.query(
      `DELETE FROM user_pokemon_assignment
       WHERE user_id = $1 AND pokemon_id = $2`,
      [userId, pokemonId],
    );
  }

  // ---------------------------------------------------------------------------
  // Users
  // ---------------------------------------------------------------------------

  async findUserByUsername(username: string): Promise<{
    id: string;
    username: string;
    password_hash: string;
    display_name?: string;
    section?: string;
    trainer_class: string;
    trainer_card_color: string;
    starter_pokemon: string;
    hometown: string;
    favorite_type: string;
    trainer_title: string;
    rival_name: string;
    trainer_id: string;
  } | undefined> {
    const result = await this.pool.query(
      `SELECT id, username, password_hash, display_name, section,
              trainer_class, trainer_card_color, starter_pokemon, hometown,
              favorite_type, trainer_title, rival_name, trainer_id
       FROM users WHERE username = $1`,
      [username],
    );
    return result.rows[0] as {
      id: string;
      username: string;
      password_hash: string;
      display_name?: string;
      section?: string;
      trainer_class: string;
      trainer_card_color: string;
      starter_pokemon: string;
      hometown: string;
      favorite_type: string;
      trainer_title: string;
      rival_name: string;
      trainer_id: string;
    } | undefined;
  }

  async findUserById(id: string): Promise<{
    id: string;
    username: string;
    display_name: string;
    section?: string;
    trainer_class: string;
    trainer_card_color: string;
    starter_pokemon: string;
    hometown: string;
    favorite_type: string;
    trainer_title: string;
    rival_name: string;
    trainer_id: string;
  } | undefined> {
    const result = await this.pool.query(
      `SELECT id, username, display_name, section,
              trainer_class, trainer_card_color, starter_pokemon, hometown,
              favorite_type, trainer_title, rival_name, trainer_id
       FROM users WHERE id = $1`,
      [id],
    );
    return result.rows[0] as {
      id: string;
      username: string;
      display_name: string;
      section?: string;
      trainer_class: string;
      trainer_card_color: string;
      starter_pokemon: string;
      hometown: string;
      favorite_type: string;
      trainer_title: string;
      rival_name: string;
      trainer_id: string;
    } | undefined;
  }

  async createUser(
    username: string,
    passwordHash: string,
    displayName?: string,
    section?: string,
    trainerFields?: {
      trainer_class?: string;
      trainer_card_color?: string;
      starter_pokemon?: string;
      hometown?: string;
      favorite_type?: string;
      trainer_title?: string;
      rival_name?: string;
      trainer_id?: string;
    },
  ): Promise<{
    id: string;
    username: string;
    display_name: string;
    trainer_class: string;
    trainer_card_color: string;
    starter_pokemon: string;
    hometown: string;
    favorite_type: string;
    trainer_title: string;
    rival_name: string;
    trainer_id: string;
  }> {
    const result = await this.pool.query(
      `INSERT INTO users (
         username, password_hash, display_name, section,
         trainer_class, trainer_card_color, starter_pokemon, hometown,
         favorite_type, trainer_title, rival_name, trainer_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, username, display_name,
                 trainer_class, trainer_card_color, starter_pokemon, hometown,
                 favorite_type, trainer_title, rival_name, trainer_id`,
      [
        username,
        passwordHash,
        displayName ?? username,
        section ?? '3ISC',
        trainerFields?.trainer_class    ?? 'youngster',
        trainerFields?.trainer_card_color ?? 'red',
        trainerFields?.starter_pokemon  ?? 'charmander',
        trainerFields?.hometown         ?? 'Pallet Town',
        trainerFields?.favorite_type    ?? 'Normal',
        trainerFields?.trainer_title    ?? 'Trainer',
        trainerFields?.rival_name       ?? '',
        trainerFields?.trainer_id       ?? '',
      ],
    );
    return result.rows[0] as {
      id: string;
      username: string;
      display_name: string;
      trainer_class: string;
      trainer_card_color: string;
      starter_pokemon: string;
      hometown: string;
      favorite_type: string;
      trainer_title: string;
      rival_name: string;
      trainer_id: string;
    };
  }

  async updateTrainerProfile(
    userId: string,
    fields: {
      display_name?: string;
      trainer_class?: string;
      trainer_card_color?: string;
      starter_pokemon?: string;
      hometown?: string;
      favorite_type?: string;
      trainer_title?: string;
      rival_name?: string;
      trainer_id?: string;
    },
  ): Promise<{
    id: string;
    username: string;
    display_name: string;
    section?: string;
    trainer_class: string;
    trainer_card_color: string;
    starter_pokemon: string;
    hometown: string;
    favorite_type: string;
    trainer_title: string;
    rival_name: string;
    trainer_id: string;
  }> {
    const allowed = [
      'display_name', 'trainer_class', 'trainer_card_color', 'starter_pokemon',
      'hometown', 'favorite_type', 'trainer_title', 'rival_name', 'trainer_id',
    ] as const;

    const setClauses: string[] = [];
    const params: unknown[] = [];

    for (const key of allowed) {
      if (fields[key] !== undefined) {
        params.push(fields[key]);
        setClauses.push(`${key} = $${params.length}`);
      }
    }

    if (setClauses.length === 0) {
      // Nothing to update — return current row
      const current = await this.findUserById(userId);
      if (!current) throw new Error('User not found');
      return current;
    }

    params.push(userId);
    const result = await this.pool.query(
      `UPDATE users SET ${setClauses.join(', ')}
       WHERE id = $${params.length}
       RETURNING id, username, display_name, section,
                 trainer_class, trainer_card_color, starter_pokemon, hometown,
                 favorite_type, trainer_title, rival_name, trainer_id`,
      params,
    );
    return result.rows[0] as {
      id: string;
      username: string;
      display_name: string;
      section?: string;
      trainer_class: string;
      trainer_card_color: string;
      starter_pokemon: string;
      hometown: string;
      favorite_type: string;
      trainer_title: string;
      rival_name: string;
      trainer_id: string;
    };
  }

  // ---------------------------------------------------------------------------
  // Engine output
  // ---------------------------------------------------------------------------

  async insertEngineOutput(data: CreateEngineOutputDto): Promise<void> {
    await this.pool.query(
      `INSERT INTO engine_output
        (section, group_name, engine_type, model_used, input_data, generated_output,
         native_region_validation, region, type_specialization, gym_leader, metric_used,
         challenger_region, target_gym_leader, counter_score, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        data.section,
        data.group_name,
        data.engine_type,
        data.model_used,
        data.input_data,
        data.generated_output,
        data.native_region_validation ?? null,
        data.region ?? null,
        data.type_specialization ?? null,
        data.gym_leader ?? null,
        data.metric_used ?? null,
        data.challenger_region ?? null,
        data.target_gym_leader ?? null,
        data.counter_score ?? null,
        data.user_id ?? null,
      ],
    );
  }

  async findEngineOutputs(engine_type?: string): Promise<EngineOutput[]> {
    if (engine_type) {
      return (
        await this.pool.query(
          'SELECT * FROM engine_output WHERE engine_type = $1 ORDER BY timestamp DESC',
          [engine_type],
        )
      ).rows as EngineOutput[];
    }
    return (
      await this.pool.query('SELECT * FROM engine_output ORDER BY timestamp DESC')
    ).rows as EngineOutput[];
  }

  async findEngineOutputById(engine_id: number): Promise<EngineOutput | undefined> {
    const result = await this.pool.query(
      'SELECT * FROM engine_output WHERE engine_id = $1',
      [engine_id],
    );
    return result.rows[0] as EngineOutput | undefined;
  }

  // ---------------------------------------------------------------------------
  // Prediction
  // ---------------------------------------------------------------------------

  async insertPrediction(data: CreatePredictionDto): Promise<void> {
    await this.pool.query(
      `INSERT INTO prediction
        (match_id, battler_a, battler_b, predicted_winner, confidence_score,
         prediction_reason, model_used, team_a, team_b, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        data.match_id,
        data.battler_a,
        data.battler_b,
        data.predicted_winner,
        data.confidence_score,
        data.prediction_reason,
        data.model_used ?? 'ensemble',
        data.team_a,
        data.team_b,
        data.user_id ?? null,
      ],
    );
  }

  async findPredictionById(match_id: string): Promise<Prediction | undefined> {
    const result = await this.pool.query(
      'SELECT * FROM prediction WHERE match_id = $1',
      [match_id],
    );
    return result.rows[0] as Prediction | undefined;
  }

  async lockPrediction(match_id: string): Promise<void> {
    const result = await this.pool.query(
      `UPDATE prediction SET is_locked = 1
       WHERE match_id = $1 AND is_locked = 0`,
      [match_id],
    );

    if (result.rowCount === 0) {
      throw new Error(
        `Prediction '${match_id}' not found or is already locked.`,
      );
    }
  }

  async findAllPredictions(userId?: string): Promise<PredictionWithResult[]> {
    if (!userId) return [];
    return (
      await this.pool.query(
        `SELECT * FROM v_prediction_accuracy
         WHERE match_id IN (SELECT match_id FROM prediction WHERE user_id = $1)
         ORDER BY predicted_at DESC`,
        [userId],
      )
    ).rows as PredictionWithResult[];
  }

  // ---------------------------------------------------------------------------
  // Ground truth
  // ---------------------------------------------------------------------------

  async insertGroundTruth(data: CreateGroundTruthDto): Promise<void> {
    await this.pool.query(
      `INSERT INTO ground_truth
        (match_id, actual_winner, correct_prediction, replay_link,
         screenshot_link, final_score, num_turns, mvp_pokemon)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        data.match_id,
        data.actual_winner,
        data.correct_prediction,
        data.replay_link ?? null,
        data.screenshot_link ?? null,
        data.final_score ?? null,
        data.num_turns ?? null,
        data.mvp_pokemon ?? null,
      ],
    );
  }

  async findGroundTruthByMatchId(match_id: string): Promise<GroundTruth | undefined> {
    const result = await this.pool.query(
      'SELECT * FROM ground_truth WHERE match_id = $1',
      [match_id],
    );
    return result.rows[0] as GroundTruth | undefined;
  }

  // ---------------------------------------------------------------------------
  // Metrics
  // ---------------------------------------------------------------------------

  async getPredictionAccuracy(userId?: string): Promise<PredictionAccuracy> {
    if (!userId) return { total: 0, correct: 0, accuracy: 0 };
    const result = await this.pool.query(
      `SELECT
        COUNT(*)                                                                      AS total,
        COALESCE(SUM(gt.correct_prediction), 0)                                      AS correct,
        CASE
          WHEN COUNT(*) = 0 THEN 0.0
          ELSE ROUND(CAST(SUM(gt.correct_prediction) AS NUMERIC) / COUNT(*), 4)
        END                                                                           AS accuracy
       FROM prediction p
       LEFT JOIN ground_truth gt ON gt.match_id = p.match_id
       WHERE p.user_id = $1`,
      [userId],
    );
    const row = result.rows[0] as { total: string; correct: string; accuracy: string };
    // pg returns numeric aggregates as strings — parse them explicitly
    return {
      total: parseInt(row.total, 10),
      correct: parseInt(row.correct, 10),
      accuracy: parseFloat(row.accuracy),
    };
  }

  /**
   * Confusion matrix treating "predicted_winner = battler_a" as the positive
   * class and "actual_winner = battler_a" as the true positive reference.
   */
  async getConfusionMatrix(userId?: string): Promise<ConfusionMatrix> {
    if (!userId) return { tp: 0, fp: 0, tn: 0, fn: 0 };
    const result = await this.pool.query(
      `SELECT
        SUM(CASE WHEN p.predicted_winner = gt.actual_winner AND p.predicted_winner = p.battler_a THEN 1 ELSE 0 END) AS tp,
        SUM(CASE WHEN p.predicted_winner != gt.actual_winner AND p.predicted_winner = p.battler_a THEN 1 ELSE 0 END) AS fp,
        SUM(CASE WHEN p.predicted_winner = gt.actual_winner AND p.predicted_winner = p.battler_b THEN 1 ELSE 0 END) AS tn,
        SUM(CASE WHEN p.predicted_winner != gt.actual_winner AND p.predicted_winner = p.battler_b THEN 1 ELSE 0 END) AS fn
       FROM prediction p
       INNER JOIN ground_truth gt ON gt.match_id = p.match_id
       WHERE p.user_id = $1`,
      [userId],
    );
    const row = result.rows[0] as { tp: string | null; fp: string | null; tn: string | null; fn: string | null };

    return {
      tp: row.tp !== null ? parseInt(row.tp, 10) : 0,
      fp: row.fp !== null ? parseInt(row.fp, 10) : 0,
      tn: row.tn !== null ? parseInt(row.tn, 10) : 0,
      fn: row.fn !== null ? parseInt(row.fn, 10) : 0,
    };
  }

  // ---------------------------------------------------------------------------
  // Audit log
  // ---------------------------------------------------------------------------

  async insertAuditLog(data: CreateAuditLogDto): Promise<void> {
    await this.pool.query(
      `INSERT INTO audit_log
        (user_or_group, action_done, affected_table, affected_record, old_value, new_value, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        data.user_or_group ?? 'system',
        data.action_done,
        data.affected_table,
        data.affected_record,
        data.old_value ?? null,
        data.new_value,
        data.user_id ?? null,
      ],
    );
  }

  async findAuditLogs(limit = 100): Promise<AuditLog[]> {
    return (
      await this.pool.query(
        'SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT $1',
        [limit],
      )
    ).rows as AuditLog[];
  }

  // ---------------------------------------------------------------------------
  // Counter Success Rate (F8 requirement)
  // ---------------------------------------------------------------------------

  async getCounterSuccessRate(userId?: string): Promise<{ total: number; wins: number; rate: number }> {
    if (!userId) return { total: 0, wins: 0, rate: 0 };
    const result = await this.pool.query(
      `SELECT
         COUNT(DISTINCT eo.engine_id)                                         AS total,
         SUM(CASE WHEN gt.correct_prediction = 1 THEN 1 ELSE 0 END)          AS wins
       FROM engine_output eo
       JOIN prediction  p  ON (p.battler_a = eo.group_name OR p.battler_b = eo.group_name)
       JOIN ground_truth gt ON gt.match_id = p.match_id
       WHERE eo.engine_type = 'counter_pick' AND eo.user_id = $1`,
      [userId],
    );
    const row = result.rows[0] as { total: string | null; wins: string | null } | undefined;

    const total = row?.total !== null && row?.total !== undefined ? parseInt(row.total, 10) : 0;
    const wins  = row?.wins  !== null && row?.wins  !== undefined ? parseInt(row.wins, 10)  : 0;
    return { total, wins, rate: total > 0 ? wins / total : 0 };
  }

  // ---------------------------------------------------------------------------
  // Showdown replays
  // ---------------------------------------------------------------------------

  async insertReplay(replay: {
    replay_id: string;
    format: string;
    p1: string;
    p2: string;
    winner: string | null;
    upload_time: number;
    synced_at: string;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO showdown_replay (replay_id, format, p1, p2, winner, upload_time, synced_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (replay_id) DO NOTHING`,
      [
        replay.replay_id,
        replay.format,
        replay.p1,
        replay.p2,
        replay.winner,
        replay.upload_time,
        replay.synced_at,
      ],
    );
  }

  async replayExists(replayId: string): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT 1 FROM showdown_replay WHERE replay_id = $1',
      [replayId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async findRecentReplays(limit: number): Promise<Array<{
    replay_id: string;
    format: string;
    p1: string;
    p2: string;
    winner: string | null;
    upload_time: number;
    synced_at: string;
  }>> {
    const result = await this.pool.query(
      'SELECT * FROM showdown_replay ORDER BY upload_time DESC LIMIT $1',
      [limit],
    );
    return result.rows as Array<{
      replay_id: string;
      format: string;
      p1: string;
      p2: string;
      winner: string | null;
      upload_time: number;
      synced_at: string;
    }>;
  }

  // ---------------------------------------------------------------------------
  // Generic query — used by archive, engine9, and other ad-hoc SQL modules
  // ---------------------------------------------------------------------------
  async query(sql: string, params: unknown[]): Promise<{ rows: unknown[] }> {
    return this.pool.query(sql, params);
  }
}
