import {
  Controller,
  Get,
  Query,
  HttpCode,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { Engine9Service, ScanResult } from './engine9.service';

const TEAM_SIZE_LIMIT = 6;

@Controller('engine9')
export class Engine9Controller {
  constructor(private readonly engine9Service: Engine9Service) {}

  /**
   * GET /api/engine9/scan?names=pikachu,starmie,lapras
   * Public — no auth required.
   */
  @Get('scan')
  @HttpCode(HttpStatus.OK)
  async scan(
    @Query('names') namesParam?: string,
  ): Promise<{ success: true; data: ScanResult }> {
    try {
      const names = namesParam
        ? namesParam.split(',').map((n) => n.trim().toLowerCase()).filter(Boolean)
        : [];
      const data = await this.engine9Service.scanTeam(names.slice(0, TEAM_SIZE_LIMIT));
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
