import { Module } from '@nestjs/common';
import { Engine5Controller } from './engine5.controller';
import { Engine5Service } from './engine5.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [Engine5Controller],
  providers: [Engine5Service],
})
export class Engine5Module {}
