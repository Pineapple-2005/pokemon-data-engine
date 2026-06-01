import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { ArchiveService, LeaderboardEntry, ArchiveStats } from './archive.service';

@Controller('archive')
export class ArchiveController {
  constructor(private readonly archiveService: ArchiveService) {}

  /**
   * GET /api/archive/leaderboard
   * Public — no auth required.
   */
  @Get('leaderboard')
  @HttpCode(HttpStatus.OK)
  async getLeaderboard(): Promise<{ success: true; data: LeaderboardEntry[] }> {
    try {
      const data = await this.archiveService.getLeaderboard();
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
   * GET /api/archive/stats
   * Public — no auth required.
   */
  @Get('stats')
  @HttpCode(HttpStatus.OK)
  async getStats(): Promise<{ success: true; data: ArchiveStats }> {
    try {
      const data = await this.archiveService.getStats();
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
