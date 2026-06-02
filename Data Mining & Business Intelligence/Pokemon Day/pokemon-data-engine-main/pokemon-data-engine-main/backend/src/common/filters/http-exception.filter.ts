import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'object' && body !== null) {
        const bodyObj = body as Record<string, unknown>;
        const msg = bodyObj['message'];
        const err = bodyObj['error'];
        message = Array.isArray(msg) ? msg.join(', ') : (msg as string) || (err as string) || JSON.stringify(body);
      } else {
        message = body as string;
      }
    } else {
      this.logger.error(`Unhandled exception: ${String(exception)}`);
    }

    res.status(status).json({ success: false, error: message, statusCode: status });
  }
}
