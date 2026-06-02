import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { AuditLog, AuditAction } from '../common/interfaces/pokemon.interface';

export interface WriteAuditParams {
  user_or_group?: string;
  action_done: AuditAction;
  affected_table: string;
  affected_record: string;
  old_value?: string;
  new_value: string;
  user_id?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Persist an audit entry. Non-throwing — errors are logged but never bubble
   * up to the caller so a logging failure never breaks the main request.
   */
  writeLog(params: WriteAuditParams): void {
    this.db
      .insertAuditLog({
        user_or_group: params.user_or_group ?? 'system',
        action_done: params.action_done,
        affected_table: params.affected_table,
        affected_record: params.affected_record,
        old_value: params.old_value ?? null,
        new_value: params.new_value,
        user_id: params.user_id,
      })
      .catch((err: unknown) => {
        this.logger.error(`Failed to write audit log: ${(err as Error).message}`);
      });
  }

  /**
   * Return the most recent audit entries (default 50).
   */
  async getLogs(limit = 50): Promise<AuditLog[]> {
    return this.db.findAuditLogs(limit);
  }
}
