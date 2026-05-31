import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { MlClientService, Engine3PredictResponse, MlModelMetrics } from '../ml/ml-client.service';
import { AuditService } from '../audit/audit.service';
import {
  GroundTruth,
  PredictionWithResult,
} from '../common/interfaces/pokemon.interface';
import { normalizePokemonName } from '../pokemon/showdown.parser';

/** Flat metrics shape consumed by the frontend ModelMetrics interface */
export interface FlatModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  brier_score: number;
  log_loss: number;
  confusion_matrix: { tp: number; fp: number; tn: number; fn: number };
  total_battles: number;
  correct_predictions: number;
}

/**
 * Frontend-friendly prediction response.
 * Translates ML positional labels ("A"/"B") to actual battler names,
 * aliases DB column names to frontend-expected names, and includes
 * model_votes (available from ML service but not persisted to DB).
 */
export interface PredictResponse {
  match_id: string;
  battler_a: string;
  battler_b: string;
  predicted_winner: string;   // resolved to actual trainer name
  confidence: number;         // aliased from confidence_score
  reason: string;             // aliased from prediction_reason
  model_used: string;
  model_votes: Record<string, string>;  // values resolved to trainer names
  is_locked: 0 | 1;
  timestamp: string;
}

export interface PredictParams {
  match_id: string;
  battler_a: string;
  battler_b: string;
  team_a: string[];
  team_b: string[];
  userId?: string;
}

export interface RecordResultParams {
  match_id: string;
  actual_winner: string;
  replay_link?: string;
  screenshot_link?: string;
  final_score?: string;
  num_turns?: number;
  mvp_pokemon?: string;
  userId?: string;
}

// AccuracyResult replaced by FlatModelMetrics — single flat shape for the frontend

@Injectable()
export class Engine3Service {
  private readonly logger = new Logger(Engine3Service.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly ml: MlClientService,
    private readonly audit: AuditService,
  ) {}

  // -------------------------------------------------------------------------
  // POST /api/engine3/predict
  // -------------------------------------------------------------------------
  async predict(params: PredictParams): Promise<PredictResponse> {
    const { match_id, battler_a, battler_b, team_a, team_b, userId } = params;

    // Verify match_id is unique — predictions are immutable once created
    const existing = await this.db.findPredictionById(match_id);
    if (existing !== undefined) {
      throw new ConflictException({
        success: false,
        error: `A prediction for match_id "${match_id}" already exists and is locked.`,
      });
    }

    const normalizedTeamA = team_a.map(normalizePokemonName).filter(Boolean);
    const normalizedTeamB = team_b.map(normalizePokemonName).filter(Boolean);
    if (normalizedTeamA.length === 0 || normalizedTeamB.length === 0) {
      throw new BadRequestException({
        success: false,
        error: 'Each team needs at least one valid Pokémon name.',
      });
    }

    // Reject imported names that cannot be resolved before calling the ML service.
    const teamAData = await this.db.findPokemonByNames(normalizedTeamA);
    const teamBData = await this.db.findPokemonByNames(normalizedTeamB);
    const foundA = new Set(teamAData.map((pokemon) => pokemon.name.toLowerCase()));
    const foundB = new Set(teamBData.map((pokemon) => pokemon.name.toLowerCase()));
    const missingA = normalizedTeamA.filter((name) => !foundA.has(name));
    const missingB = normalizedTeamB.filter((name) => !foundB.has(name));
    if (missingA.length > 0 || missingB.length > 0) {
      const details = [
        missingA.length > 0 ? `Team A: ${missingA.join(', ')}` : '',
        missingB.length > 0 ? `Team B: ${missingB.join(', ')}` : '',
      ].filter(Boolean);
      throw new BadRequestException({
        success: false,
        error: `Unknown Pokémon name${missingA.length + missingB.length === 1 ? '' : 's'}: ${details.join('; ')}`,
      });
    }

    this.logger.log(
      `Engine3.predict: match=${match_id} teamA=${teamAData.length} teamB=${teamBData.length}`,
    );

    // Call ML service
    const mlResult: Engine3PredictResponse = await this.ml.predictBattle(
      battler_a,
      battler_b,
      teamAData,
      teamBData,
    );

    // Translate ML positional labels ("A"/"B") to actual trainer names
    const resolveLabel = (label: string): string => {
      if (label === 'A') return battler_a;
      if (label === 'B') return battler_b;
      return label;
    };

    const winnerName = resolveLabel(mlResult.predicted_winner);

    // Translate model_votes values from "A"/"B" to trainer names
    const translatedVotes: Record<string, string> = {};
    for (const [model, vote] of Object.entries(mlResult.model_votes ?? {})) {
      translatedVotes[model] = resolveLabel(vote);
    }

    // Persist prediction with resolved trainer name (not "A"/"B")
    await this.db.insertPrediction({
      match_id,
      battler_a,
      battler_b,
      predicted_winner: winnerName,
      confidence_score: mlResult.confidence,
      prediction_reason: mlResult.reason,
      model_used: mlResult.model_used ?? 'ml-service',
      team_a: JSON.stringify(normalizedTeamA),
      team_b: JSON.stringify(normalizedTeamB),
      user_id: userId,
    });

    // Lock immediately — predictions cannot be edited after creation
    await this.db.lockPrediction(match_id);

    // Retrieve the persisted record for the timestamp
    const persisted = await this.db.findPredictionById(match_id);

    // Audit log
    this.audit.writeLog({
      action_done: 'PREDICT',
      affected_table: 'prediction',
      affected_record: match_id,
      new_value: JSON.stringify({
        predicted_winner: winnerName,
        confidence: mlResult.confidence,
      }),
    });

    // Second audit entry: LOCK
    this.audit.writeLog({
      action_done: 'LOCK',
      affected_table: 'prediction',
      affected_record: match_id,
      new_value: JSON.stringify({ is_locked: 1 }),
    });

    // Return frontend-friendly shape: resolved names, aliased fields, model votes included
    return {
      match_id,
      battler_a,
      battler_b,
      predicted_winner: winnerName,
      confidence: mlResult.confidence,
      reason: mlResult.reason,
      model_used: mlResult.model_used ?? 'ml-service',
      model_votes: translatedVotes,
      is_locked: persisted.is_locked,
      timestamp: persisted.timestamp,
    };
  }

  // -------------------------------------------------------------------------
  // POST /api/engine3/result
  // -------------------------------------------------------------------------
  async recordResult(params: RecordResultParams): Promise<GroundTruth> {
    const {
      match_id,
      actual_winner,
      replay_link,
      screenshot_link,
      final_score,
      num_turns,
      mvp_pokemon,
      userId,
    } = params;

    // Find the locked prediction
    const prediction = await this.db.findPredictionById(match_id);
    if (prediction === undefined) {
      throw new NotFoundException({
        success: false,
        error: `No prediction found for match_id "${match_id}".`,
      });
    }

    // Compute correctness
    const correct_prediction: 0 | 1 =
      actual_winner.toLowerCase() === prediction.predicted_winner.toLowerCase() ? 1 : 0;

    // Persist ground truth (optional fields passed as undefined when absent —
    // DatabaseService coalesces them to null internally)
    await this.db.insertGroundTruth({
      match_id,
      actual_winner,
      correct_prediction,
      replay_link,
      screenshot_link,
      final_score,
      num_turns,
      mvp_pokemon,
    });

    // Retrieve persisted record to return to caller
    const groundTruth = await this.db.findGroundTruthByMatchId(match_id);

    // Audit
    this.audit.writeLog({
      action_done: 'BATTLE_END',
      affected_table: 'ground_truth',
      affected_record: match_id,
      new_value: JSON.stringify({ actual_winner, correct_prediction }),
      user_id: userId,
    });

    // Trigger ML retrain with this new ground truth
    // Map actual_winner trainer name → "A" or "B" for the ML service
    const winner_side: 'A' | 'B' =
      actual_winner.toLowerCase() === prediction.battler_a.toLowerCase() ? 'A' : 'B';

    try {
      await this.ml.retrainEngine3({
        match_id,
        winner: winner_side,
        team_a: JSON.parse(prediction.team_a) as string[],
        team_b: JSON.parse(prediction.team_b) as string[],
      });
      this.logger.log(`Engine3: retrain triggered for match ${match_id}`);
    } catch (err) {
      // Non-fatal — retrain failure must not fail the ground-truth write
      this.logger.warn(`Engine3: retrain failed for match ${match_id}: ${(err as Error).message}`);
    }

    return groundTruth;
  }

  // -------------------------------------------------------------------------
  // GET /api/engine3/history
  // -------------------------------------------------------------------------
  async getHistory(userId?: string): Promise<PredictionWithResult[]> {
    return await this.db.findAllPredictions(userId);
  }

  // -------------------------------------------------------------------------
  // GET /api/engine3/accuracy
  // -------------------------------------------------------------------------
  async getAccuracy(userId?: string): Promise<FlatModelMetrics> {
    const dbAccuracy = await this.db.getPredictionAccuracy(userId);
    const dbCm      = await this.db.getConfusionMatrix(userId);

    let ml: MlModelMetrics | null = null;
    try {
      ml = await this.ml.getEngine3Metrics();
    } catch (err) {
      this.logger.warn(`Engine3: failed to fetch ML metrics — ${(err as Error).message}`);
    }

    return {
      // Prefer ML-service values; fall back to DB-computed values when unavailable
      accuracy:          ml?.accuracy   ?? dbAccuracy.accuracy,
      precision:         ml?.precision  ?? 0,
      recall:            ml?.recall     ?? 0,
      f1:                ml?.f1         ?? 0,
      brier_score:       ml?.brier_score ?? 0,
      log_loss:          ml?.log_loss   ?? 0,
      confusion_matrix:  ml?.confusion_matrix ?? dbCm,
      // Always from the DB — these are the ground-truth record counts
      total_battles:      dbAccuracy.total,
      correct_predictions: dbAccuracy.correct,
    };
  }
}
