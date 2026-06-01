import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface LeaderboardEntry {
  rank: number;
  trainer: string;
  wins: number;
  losses: number;
  win_rate: number;
  total_battles: number;
  avg_confidence: number;
}

export interface ArchiveStats {
  total_battles: number;
  most_used_pokemon: string;
  most_accurate_model: string;
  overall_accuracy: number;
}

@Injectable()
export class ArchiveService {
  private readonly logger = new Logger(ArchiveService.name);

  constructor(private readonly db: DatabaseService) {}

  // ---------------------------------------------------------------------------
  // GET /api/archive/leaderboard
  // ---------------------------------------------------------------------------
  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    const sql = `
      WITH battler_stats AS (
        SELECT p.battler_a AS trainer, p.confidence_score, gt.actual_winner
        FROM prediction p
        LEFT JOIN ground_truth gt ON gt.match_id = p.match_id
        UNION ALL
        SELECT p.battler_b AS trainer, p.confidence_score, gt.actual_winner
        FROM prediction p
        LEFT JOIN ground_truth gt ON gt.match_id = p.match_id
      )
      SELECT
        trainer,
        COUNT(*) AS total_battles,
        SUM(CASE WHEN actual_winner = trainer THEN 1 ELSE 0 END) AS wins,
        SUM(CASE WHEN actual_winner IS NOT NULL AND actual_winner != trainer THEN 1 ELSE 0 END) AS losses,
        ROUND(
          CASE
            WHEN SUM(CASE WHEN actual_winner IS NOT NULL THEN 1 ELSE 0 END) = 0 THEN 0
            ELSE CAST(SUM(CASE WHEN actual_winner = trainer THEN 1 ELSE 0 END) AS NUMERIC)
                 / NULLIF(SUM(CASE WHEN actual_winner IS NOT NULL THEN 1 ELSE 0 END), 0)
          END, 4
        ) AS win_rate,
        ROUND(AVG(confidence_score)::NUMERIC, 4) AS avg_confidence
      FROM battler_stats
      GROUP BY trainer
      ORDER BY win_rate DESC, wins DESC
    `;

    const result = await this.db.query(sql, []);
    return (result.rows as Array<Record<string, string>>).map((row, index) => ({
      rank: index + 1,
      trainer: row.trainer,
      wins: Number.parseInt(row.wins, 10),
      losses: Number.parseInt(row.losses, 10),
      win_rate: Number.parseFloat(row.win_rate),
      total_battles: Number.parseInt(row.total_battles, 10),
      avg_confidence: Number.parseFloat(row.avg_confidence),
    }));
  }

  // ---------------------------------------------------------------------------
  // GET /api/archive/stats
  // ---------------------------------------------------------------------------
  async getStats(): Promise<ArchiveStats> {
    // Total battles from ground_truth
    const totalResult = await this.db.query(
      'SELECT COUNT(*) AS total FROM ground_truth',
      [],
    );
    const total_battles = Number.parseInt((totalResult.rows[0] as { total: string }).total, 10);

    // Most used Pokemon — pure SQL via json_array_elements_text
    let most_used_pokemon = 'N/A';
    try {
      const pokemonResult = await this.db.query(
        `SELECT pname, COUNT(*) AS usage_count
         FROM (
           SELECT json_array_elements_text(team_a::json) AS pname FROM prediction
           UNION ALL
           SELECT json_array_elements_text(team_b::json) AS pname FROM prediction
         ) sub
         GROUP BY pname
         ORDER BY usage_count DESC
         LIMIT 1`,
        [],
      );
      if (pokemonResult.rows.length > 0) {
        most_used_pokemon = (pokemonResult.rows[0] as { pname: string }).pname;
      }
    } catch (err) {
      this.logger.warn(`most_used_pokemon query failed: ${(err as Error).message}`);
    }

    // Most accurate model
    let most_accurate_model = 'N/A';
    try {
      const modelResult = await this.db.query(
        `SELECT p.model_used,
                ROUND(
                  CAST(SUM(gt.correct_prediction) AS NUMERIC) / NULLIF(COUNT(*), 0),
                  4
                ) AS accuracy
         FROM prediction p
         INNER JOIN ground_truth gt ON gt.match_id = p.match_id
         GROUP BY p.model_used
         ORDER BY accuracy DESC
         LIMIT 1`,
        [],
      );
      if (modelResult.rows.length > 0) {
        most_accurate_model = (modelResult.rows[0] as { model_used: string }).model_used;
      }
    } catch (err) {
      this.logger.warn(`most_accurate_model query failed: ${(err as Error).message}`);
    }

    // Overall accuracy
    let overall_accuracy = 0;
    try {
      const accuracyResult = await this.db.query(
        `SELECT
           CASE WHEN COUNT(*) = 0 THEN 0
           ELSE ROUND(CAST(SUM(correct_prediction) AS NUMERIC) / COUNT(*), 4)
           END AS accuracy
         FROM ground_truth`,
        [],
      );
      overall_accuracy = Number.parseFloat(
        (accuracyResult.rows[0] as { accuracy: string }).accuracy ?? '0',
      );
    } catch (err) {
      this.logger.warn(`overall_accuracy query failed: ${(err as Error).message}`);
    }

    return {
      total_battles,
      most_used_pokemon,
      most_accurate_model,
      overall_accuracy,
    };
  }
}
