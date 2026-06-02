import { Module } from '@nestjs/common';
import { Engine3Controller } from './engine3.controller';
import { Engine3Service } from './engine3.service';
import { DatabaseModule } from '../database/database.module';
import { MlClientModule } from '../ml/ml-client.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [DatabaseModule, MlClientModule, AuditModule],
  controllers: [Engine3Controller],
  providers: [Engine3Service],
})
export class Engine3Module {}
