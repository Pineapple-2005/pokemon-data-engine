import { Controller, Get, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditLog } from '../common/interfaces/pokemon.interface';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  /**
   * GET /api/audit?limit=50
   * Returns the most recent audit log entries.
   */
  @Get()
  async getAuditLogs(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ): Promise<{ success: true; data: AuditLog[] }> {
    const logs = await this.auditService.getLogs(limit);
    return { success: true, data: logs };
  }
}
