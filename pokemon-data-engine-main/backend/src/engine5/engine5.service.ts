import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { DatabaseService } from '../database/database.service';

export interface CommentaryResponse {
  match_id: string;
  commentary: string;
  model: string;
}

@Injectable()
export class Engine5Service {
  private readonly logger = new Logger(Engine5Service.name);
  private readonly anthropic: Anthropic;

  constructor(private readonly db: DatabaseService) {
    this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async generateCommentary(matchId: string): Promise<CommentaryResponse> {
    // Fetch prediction
    const prediction = await this.db.findPredictionById(matchId);
    if (!prediction) {
      throw new NotFoundException({
        success: false,
        error: `No prediction found for match_id "${matchId}".`,
      });
    }

    // Fetch ground truth (may not exist yet)
    const groundTruth = await this.db.findGroundTruthByMatchId(matchId);

    // Parse team arrays (stored as JSON strings)
    let teamANames: string[] = [];
    let teamBNames: string[] = [];
    try {
      teamANames = JSON.parse(prediction.team_a) as string[];
    } catch {
      teamANames = [];
    }
    try {
      teamBNames = JSON.parse(prediction.team_b) as string[];
    } catch {
      teamBNames = [];
    }

    const actualWinner = groundTruth?.actual_winner ?? 'Battle not yet concluded';
    const confidencePct = (prediction.confidence_score * 100).toFixed(1);

    const prompt = `You are a Pokemon battle announcer. Given this battle:
Team A (trainer: ${prediction.battler_a}) had [${teamANames.join(', ')}].
Team B (trainer: ${prediction.battler_b}) had [${teamBNames.join(', ')}].
Predicted winner: ${prediction.predicted_winner} with ${confidencePct}% confidence.
Actual winner: ${actualWinner}.

Write a 3-paragraph dramatic post-battle commentary in the style of the Pokemon anime. Include specific Pokemon names, mention type advantages, and explain why the winner succeeded. If the prediction was wrong, acknowledge the upset dramatically. Keep each paragraph to 2-3 sentences.`;

    this.logger.log(`Engine5: generating commentary for match ${matchId}`);

    const message = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const commentary =
      message.content[0].type === 'text' ? message.content[0].text : '';

    return {
      match_id: matchId,
      commentary,
      model: 'claude-sonnet-4-6',
    };
  }
}
