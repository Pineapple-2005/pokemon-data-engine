import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  HttpException,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ArrayNotEmpty,
  ArrayMaxSize,
  IsNumber,
  Min,
} from 'class-validator';
import { Engine3Service, FlatModelMetrics, PredictResponse } from './engine3.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import {
  GroundTruth,
  PredictionWithResult,
} from '../common/interfaces/pokemon.interface';

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------
class PredictDto {
  @IsString()
  @IsNotEmpty()
  match_id: string;

  @IsString()
  @IsNotEmpty()
  battler_a: string;

  @IsString()
  @IsNotEmpty()
  battler_b: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(4)
  @IsString({ each: true })
  team_a: string[];

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(4)
  @IsString({ each: true })
  team_b: string[];
}

class RecordResultDto {
  @IsString()
  @IsNotEmpty()
  match_id: string;

  @IsString()
  @IsNotEmpty()
  actual_winner: string;

  @IsString()
  @IsOptional()
  replay_link?: string;

  @IsString()
  @IsOptional()
  screenshot_link?: string;

  @IsString()
  @IsOptional()
  final_score?: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  num_turns?: number;

  @IsString()
  @IsOptional()
  mvp_pokemon?: string;
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------
@Controller('engine3')
export class Engine3Controller {
  constructor(private readonly engine3Service: Engine3Service) {}

  /**
   * POST /api/engine3/predict
   * Pre-battle prediction — result is locked immediately.
   */
  @UseGuards(JwtAuthGuard)
  @Post('predict')
  @HttpCode(HttpStatus.OK)
  async predict(
    @Body() dto: PredictDto,
    @Request() req: { user: { userId: string; username: string } },
  ): Promise<{ success: true; data: PredictResponse }> {
    try {
      const data = await this.engine3Service.predict({ ...dto, userId: req.user.userId });
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
   * POST /api/engine3/result
   * Post-battle ground truth recording.
   */
  @UseGuards(JwtAuthGuard)
  @Post('result')
  @HttpCode(HttpStatus.OK)
  async recordResult(
    @Body() dto: RecordResultDto,
    @Request() req: { user: { userId: string; username: string } },
  ): Promise<{ success: true; data: GroundTruth }> {
    try {
      const data = await this.engine3Service.recordResult({ ...dto, userId: req.user.userId });
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
   * GET /api/engine3/history
   * Returns predictions scoped to the authenticated user.
   * Unauthenticated callers receive an empty list.
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get('history')
  async getHistory(
    @Request() req: { user?: { userId: string; username: string } },
  ): Promise<{ success: true; data: PredictionWithResult[] }> {
    const data = await this.engine3Service.getHistory(req.user?.userId);
    return { success: true, data };
  }

  /**
   * GET /api/engine3/accuracy
   * Returns accuracy metrics scoped to the authenticated user.
   * Unauthenticated callers receive zero-value metrics.
   */
  @UseGuards(OptionalJwtAuthGuard)
  @Get('accuracy')
  async getAccuracy(
    @Request() req: { user?: { userId: string; username: string } },
  ): Promise<{ success: true; data: FlatModelMetrics }> {
    try {
      const data = await this.engine3Service.getAccuracy(req.user?.userId);
      return { success: true, data };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new HttpException(
        { success: false, error: (err as Error).message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
