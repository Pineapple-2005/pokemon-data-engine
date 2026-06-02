import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';

/**
 * DatabaseModule is decorated with @Global so that DatabaseService is
 * available across the entire application without needing to re-import
 * this module in every feature module.
 *
 * Usage in any feature module:
 *   Just inject DatabaseService — no imports[] needed.
 *
 * Usage in AppModule:
 *   imports: [DatabaseModule, ...]
 */
@Global()
@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
})
export class DatabaseModule {}
