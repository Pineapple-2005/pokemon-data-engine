import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance, AxiosError } from 'axios';
import { Pokemon } from '../common/interfaces/pokemon.interface';

// ---------------------------------------------------------------------------
// ML Service response shapes
// ---------------------------------------------------------------------------
export interface TeamSlot {
  slot: number;
  role: string;
  name: string;
  pokeapi_id?: number;
  type_1?: string;
  type_2?: string;
  total_base_stats: number;
  usefulness_score: number;
  reason: string;
  loadout?: TournamentLoadout;
}

export interface TournamentLoadout {
  item: string;
  ability: string;
  evs: string;
  nature: string;
  moves: [string, string, string, string];
}

export interface Engine1Response {
  theme: string;
  difficulty: string;
  team: TeamSlot[];
  model_used: string;
  metrics: { silhouette_score: number; cluster_count: number; pool_size: number };
  explanation: string;   // Python returns 'explanation', not 'reasoning'
  showdown_text?: string;
}

export interface CounterScoreBreakdown {
  tcs: number;
  sas: number;
  rs: number;
  knn: number;
  dt: number;
}

export interface CounterRecommendation {
  rank: number;
  name: string;
  counter_score: number;
  score_breakdown: CounterScoreBreakdown;
  type_1?: string;
  type_2?: string;
  total_base_stats: number;
  reason: string;
  pokeapi_id?: number;
  role?: string;
  loadout?: TournamentLoadout;
}

export interface Engine2Response {
  opponent_team: string[];
  recommended_team: CounterRecommendation[];   // replaces stale counter_team: string[]
  model_used: string;
  matchup_table: Record<string, { advantage: string; multiplier: number }>;
  opponent_team_data?: { name: string; pokeapi_id?: number; type_1?: string; type_2?: string }[];
  showdown_text?: string;
}

export interface Engine3PredictResponse {
  predicted_winner: string;
  confidence: number;           // ML service returns 'confidence', not 'confidence_score'
  reason: string;               // ML service returns 'reason', not 'prediction_reason'
  model_used: string;
  model_votes?: Record<string, string>;
  features_used?: Record<string, number>;
}

export interface TrainingMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  training_samples: number;
}

/** Shape returned by Python FastAPI GET /engine3/metrics */
export interface MlModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  brier_score: number;
  log_loss: number;
  confusion_matrix: { tp: number; fp: number; tn: number; fn: number };
  per_model: Record<string, number>;
  n_test_samples: number;
}

export interface RetrainData {
  match_id: string;
  winner: 'A' | 'B';   // "A" or "B" — Python looks up stats and computes features
  team_a: string[];
  team_b: string[];
}

export interface RetrainResult {
  success: boolean;
  message: string;
  new_accuracy?: number;
}

export interface ModelMetrics {
  accuracy: number;
  total_predictions: number;
  correct_predictions: number;
  f1_score: number;
  model_version: string;
}

// ---------------------------------------------------------------------------
// ML payload projection — strips columns the Python engines never read.
// Reduces JSON body size significantly (drops ~18 def_vs_* columns plus
// metadata columns that are irrelevant to the ML algorithms).
// Fields kept: all stats, scaled stats, typing, region/generation/status,
// role, assignment flag, and identifiers needed for output enrichment.
// ---------------------------------------------------------------------------
interface MlPokemonPayload {
  pokemon_id: number;
  pokeapi_id: number;
  name: string;
  type_1: string;
  type_2: string | null;
  hp: number;
  attack: number;
  defense: number;
  sp_atk: number;
  sp_def: number;
  speed: number;
  total_base_stats: number;
  native_region: string;
  generation: number;
  restricted_status: string;
  role_label: string;
  is_assigned: 0 | 1;
  hp_scaled: number | null;
  attack_scaled: number | null;
  defense_scaled: number | null;
  special_attack_scaled: number | null;
  special_defense_scaled: number | null;
  speed_scaled: number | null;
  total_scaled: number | null;
}

function toMlPayload(p: Pokemon): MlPokemonPayload {
  return {
    pokemon_id:            p.pokemon_id,
    pokeapi_id:            p.pokeapi_id,
    name:                  p.name,
    type_1:                p.type_1,
    type_2:                p.type_2,
    hp:                    p.hp,
    attack:                p.attack,
    defense:               p.defense,
    sp_atk:                p.special_attack,
    sp_def:                p.special_defense,
    speed:                 p.speed,
    total_base_stats:      p.total_base_stats,
    native_region:         p.native_region,
    generation:            p.generation,
    restricted_status:     p.restricted_status,
    role_label:            p.role_label,
    is_assigned:           p.is_assigned,
    hp_scaled:             p.hp_scaled ?? null,
    attack_scaled:         p.attack_scaled ?? null,
    defense_scaled:        p.defense_scaled ?? null,
    special_attack_scaled: p.special_attack_scaled ?? null,
    special_defense_scaled: p.special_defense_scaled ?? null,
    speed_scaled:          p.speed_scaled ?? null,
    total_scaled:          p.total_scaled ?? null,
  };
}

// ---------------------------------------------------------------------------
// MlClientService
// ---------------------------------------------------------------------------
@Injectable()
export class MlClientService {
  private readonly logger = new Logger(MlClientService.name);
  private readonly http: AxiosInstance;
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get<string>('ML_SERVICE_URL', 'http://localhost:8000');

    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: 30_000, // 30 s
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // -------------------------------------------------------------------------
  // Private helpers — retry, error extraction
  // -------------------------------------------------------------------------

  /** Resolve a human-readable message from a FastAPI error detail field. */
  private resolveErrorMessage(err: AxiosError): string {
    const detail = (err.response?.data as Record<string, unknown> | undefined)?.detail;
    if (typeof detail === 'string') {
      return detail;
    }
    if (Array.isArray(detail)) {
      return detail.map((entry: Record<string, unknown>) => entry['msg'] ?? JSON.stringify(entry)).join('; ');
    }
    return err.message;
  }

  /**
   * When the ML service replies with a 4xx status, surface the error
   * immediately as an HttpException (no retry — the request itself is bad).
   */
  private throwIfClientError(err: AxiosError): void {
    const status = err.response?.status;
    if (status !== undefined && status >= 400 && status < 500) {
      throw new HttpException(
        { success: false, error: this.resolveErrorMessage(err) },
        status,
      );
    }
  }

  /** Exponential-backoff retry (2 retries: 500 ms, 1 000 ms). */
  private async withRetry<T>(
    fn: () => Promise<T>,
    retries = 2,
    delaysMs = [500, 1000],
  ): Promise<T> {
    let lastError: Error = new Error('ML service unavailable');

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err as Error;
        if (axios.isAxiosError(err)) {
          this.throwIfClientError(err);
        }
        if (attempt < retries) {
          const delay = delaysMs[attempt] ?? 1000;
          this.logger.warn(
            `ML service call failed (attempt ${attempt + 1}/${retries + 1}). Retrying in ${delay} ms — ${(err as AxiosError).message}`,
          );
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }

    this.logger.error(`ML service unreachable after ${retries + 1} attempts: ${lastError.message}`);
    throw new HttpException(
      { success: false, error: 'ML service is unavailable. Please try again later.' },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  // -------------------------------------------------------------------------
  // Engine 1 — Gym-leader team generation
  // -------------------------------------------------------------------------
  async generateGymLeaderTeam(
    theme: string,
    difficulty: string,
    pokemonPool: Pokemon[],
    region?: string,
    previousTeam: string[] = [],
    previousLineups: string[][] = [],
    variationSeed?: number,
    themes?: string[],
  ): Promise<Engine1Response> {
    return this.withRetry(async () => {
      const body: Record<string, unknown> = {
        theme,
        difficulty,
        pokemon_pool: pokemonPool.map(toMlPayload),
        previous_team: previousTeam,
        previous_lineups: previousLineups,
      };
      // Multi-type selection: include themes when provided (overrides theme on the Python side)
      if (themes !== undefined && themes.length > 0) {
        body['themes'] = themes;
      }
      // Pass region through so the ML service can use it when available
      if (region !== undefined) {
        body['region'] = region;
      }
      if (variationSeed !== undefined) {
        body['variation_seed'] = variationSeed;
      }
      const { data } = await this.http.post<Engine1Response>('/engine1/generate', body);
      return data;
    });
  }

  // -------------------------------------------------------------------------
  // Engine 2 — Counter-team selection
  // -------------------------------------------------------------------------
  async getCounterTeam(
    opponentTeam: string[],
    opponentData: Pokemon[],
    assignedPool: Pokemon[],
  ): Promise<Engine2Response> {
    return this.withRetry(async () => {
      const { data } = await this.http.post<Engine2Response>('/engine2/counter', {
        opponent_team: opponentTeam,
        opponent_data: opponentData.map(toMlPayload),
        assigned_pool: assignedPool.map(toMlPayload),
      });
      return data;
    });
  }

  // -------------------------------------------------------------------------
  // Engine 3 — Battle prediction
  // -------------------------------------------------------------------------
  async predictBattle(
    battlerA: string,
    battlerB: string,
    teamAData: Pokemon[],
    teamBData: Pokemon[],
  ): Promise<Engine3PredictResponse> {
    return this.withRetry(async () => {
      const { data } = await this.http.post<Engine3PredictResponse>('/engine3/predict', {
        battler_a: battlerA,
        battler_b: battlerB,
        team_a_data: teamAData.map(toMlPayload),
        team_b_data: teamBData.map(toMlPayload),
      });
      return data;
    });
  }

  // -------------------------------------------------------------------------
  // Engine 3 — Train from CSV
  // -------------------------------------------------------------------------
  async trainEngine3(battlesCsvPath: string): Promise<TrainingMetrics> {
    return this.withRetry(async () => {
      const { data } = await this.http.post<TrainingMetrics>('/engine3/train', {
        battles_csv_path: battlesCsvPath,
      });
      return data;
    });
  }

  // -------------------------------------------------------------------------
  // Engine 3 — Incremental retrain from single ground-truth record
  // -------------------------------------------------------------------------
  async retrainEngine3(groundTruth: RetrainData): Promise<RetrainResult> {
    return this.withRetry(async () => {
      const { data } = await this.http.post<RetrainResult>('/engine3/retrain', groundTruth);
      return data;
    });
  }

  // -------------------------------------------------------------------------
  // Engine 3 — Model performance metrics
  // -------------------------------------------------------------------------
  async getEngine3Metrics(): Promise<MlModelMetrics> {
    return this.withRetry(async () => {
      const { data } = await this.http.get<MlModelMetrics>('/engine3/metrics');
      return data;
    });
  }

  // -------------------------------------------------------------------------
  // Health check
  // -------------------------------------------------------------------------
  async healthCheck(): Promise<{ status: string; models_loaded: boolean }> {
    return this.withRetry(async () => {
      const { data } = await this.http.get<{ status: string; models_loaded: boolean }>('/health');
      return data;
    });
  }
}
