import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { ReplayService, ReplaySummary, ReplayEvent } from './replay.service';

@Controller('replay')
export class ReplayController {
  constructor(private readonly replayService: ReplayService) {}

  /**
   * POST /api/replay/sync
   * Admin utility — no auth required.
   * Fetches recent gen1ou replays from Pokémon Showdown and stores new ones.
   * Optional query params:
   *   ?format=gen1ou   (default: gen1ou)
   *   ?limit=50        (default: 50)
   */
  @Post('sync')
  @HttpCode(HttpStatus.OK)
  async sync(
    @Query('format') format?: string,
    @Query('limit') limit?: string,
  ): Promise<{ success: true; data: { synced: number; skipped: number } }> {
    try {
      const parsedLimit = limit === undefined ? undefined : Number.parseInt(limit, 10);
      const data = await this.replayService.syncReplays(format, parsedLimit);
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
   * GET /api/replay/recent
   * No auth required.
   * Returns the most recently synced replays.
   * Optional query param:
   *   ?limit=20  (default: 20)
   */
  @Get('recent')
  async recent(
    @Query('limit') limit?: string,
  ): Promise<{ success: true; data: ReplaySummary[] }> {
    try {
      const parsedLimit = limit === undefined ? undefined : Number.parseInt(limit, 10);
      const data = await this.replayService.getRecentReplays(parsedLimit);
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
   * GET /api/replay/:id/timeline
   * No auth required.
   * Fetches a Pokémon Showdown replay and returns a structured event timeline.
   */
  @Get(':id/timeline')
  async timeline(
    @Param('id') id: string,
  ): Promise<{ success: true; data: ReplayEvent[] }> {
    try {
      const data = await this.replayService.getTimeline(id);
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
