import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Feature modules
import { DatabaseModule } from './database/database.module';
import { MlClientModule } from './ml/ml-client.module';
import { PokemonModule } from './pokemon/pokemon.module';
import { Engine1Module } from './engine1/engine1.module';
import { Engine2Module } from './engine2/engine2.module';
import { Engine3Module } from './engine3/engine3.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { ReplayModule } from './replay/replay.module';
import { ArchiveModule } from './archive/archive.module';
import { Engine5Module } from './engine5/engine5.module';
import { Engine6Module } from './engine6/engine6.module';
import { Engine9Module } from './engine9/engine9.module';

@Module({
  imports: [
    // Load .env variables globally — all modules can inject ConfigService
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Infrastructure
    DatabaseModule,

    // ML proxy client
    MlClientModule,

    // Feature modules
    PokemonModule,
    Engine1Module,
    Engine2Module,
    Engine3Module,
    AuditModule,
    AuthModule,
    ReplayModule,
    ArchiveModule,
    Engine5Module,
    Engine6Module,
    Engine9Module,
  ],
})
export class AppModule {}
