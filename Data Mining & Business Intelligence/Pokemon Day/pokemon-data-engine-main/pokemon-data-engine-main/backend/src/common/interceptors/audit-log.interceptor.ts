import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { AuditService } from '../../audit/audit.service';

/**
 * AuditLogInterceptor
 *
 * Automatically records a LOCK audit-log entry for every POST request that
 * completes successfully. Engine services may write their own, more descriptive
 * entries; this interceptor acts as a safety net to guarantee audit coverage.
 *
 * Attach at controller level with @UseInterceptors(AuditLogInterceptor) or
 * register globally in AppModule.
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req: Request = context.switchToHttp().getRequest();

    // Only audit mutating requests
    if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'PATCH') {
      return next.handle();
    }

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: (responseBody: unknown) => {
          const duration = Date.now() - startTime;
          this.auditService.writeLog({
            user_or_group: (req.headers['x-user'] as string) ?? 'anonymous',
            action_done: 'INSERT',
            affected_table: this.resolveTable(req.path),
            affected_record: req.path,
            new_value: JSON.stringify({
              method: req.method,
              path: req.path,
              body: req.body,
              duration_ms: duration,
            }),
          });
        },
        error: (err: Error) => {
          this.logger.debug(`Skipping audit log for failed request to ${req.path}: ${err.message}`);
        },
      }),
    );
  }

  /** Derive a human-readable table name from the route path. */
  private resolveTable(path: string): string {
    if (path.includes('engine1')) return 'engine_output';
    if (path.includes('engine2')) return 'engine_output';
    if (path.includes('engine3/predict')) return 'prediction';
    if (path.includes('engine3/result')) return 'ground_truth';
    if (path.includes('pokemon')) return 'pokemon_data';
    return 'unknown';
  }
}
