import { Module } from '@nestjs/common';
import { ReplayController } from './replay.controller';
import { ReplayService } from './replay.service';
import { DatabaseModule } from '../database/database.module';

/**
 * ReplayModule — Pokémon Showdown replay sync and query.
 *
 * To wire this into the application add ReplayModule to AppModule imports:
 *
 *   // app.module.ts
 *   import { ReplayModule } from './replay/replay.module';
 *
 *   imports: [
 *     ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
 *     DatabaseModule,
 *     MlClientModule,
 *     PokemonModule,
 *     Engine1Module,
 *     Engine2Module,
 *     Engine3Module,
 *     AuditModule,
 *     AuthModule,
 *     ReplayModule,   // <-- add this line
 *   ],
 */
@Module({
  imports: [DatabaseModule],
  controllers: [ReplayController],
  providers: [ReplayService],
})
export class ReplayModule {}
