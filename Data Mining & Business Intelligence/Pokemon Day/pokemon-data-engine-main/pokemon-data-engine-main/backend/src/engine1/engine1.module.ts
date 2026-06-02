import { Module } from '@nestjs/common';
import { Engine1Controller } from './engine1.controller';
import { Engine1Service } from './engine1.service';
import { DatabaseModule } from '../database/database.module';
import { MlClientModule } from '../ml/ml-client.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [DatabaseModule, MlClientModule, AuditModule],
  controllers: [Engine1Controller],
  providers: [Engine1Service],
})
export class Engine1Module {}
