import { Module } from '@nestjs/common';
import { Engine2Controller } from './engine2.controller';
import { Engine2Service } from './engine2.service';
import { DatabaseModule } from '../database/database.module';
import { MlClientModule } from '../ml/ml-client.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [DatabaseModule, MlClientModule, AuditModule],
  controllers: [Engine2Controller],
  providers: [Engine2Service],
})
export class Engine2Module {}
