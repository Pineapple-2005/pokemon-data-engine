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
  type_1?: string;
  type_2?: string;
  total_base_stats: number;
  usefulness_score: number;
  reason: string;
}

export interface Engine1Response {
  theme: string;
  difficulty: string;
  team: TeamSlot[];
  model_used: string;
  metrics: { silhouette_score: number; cluster_count: number; pool_size: number };
  explanation: string;   // Python returns 'explanation', not 'reasoning'
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
}

export interface Engine2Response {
  opponent_team: string[];
  recommended_team: CounterRecommendation[];   // replaces stale counter_team: string[]
  model_used: string;
  matchup_table: Record<string, { advantage: string; multiplier: number }>;
  opponent_team_data?: { name: string; pokeapi_id?: number; type_1?: string; type_2?: string }[];
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
  // Private helper — exponential-backoff retry (2 retries: 500 ms, 1 000 ms)
  // -------------------------------------------------------------------------
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
  ): Promise<Engine1Response> {
    return this.withRetry(async () => {
      const body: Record<string, unknown> = {
        theme,
        difficulty,
        pokemon_pool: pokemonPool,
      };
      // Pass region through so the ML service can use it when available
      if (region !== undefined) {
        body['region'] = region;
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
        opponent_data: opponentData,
        assigned_pool: assignedPool,
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
        team_a_data: teamAData,
        team_b_data: teamBData,
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
