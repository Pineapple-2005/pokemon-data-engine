import { Module } from '@nestjs/common';
import { Engine6Controller } from './engine6.controller';
import { Engine6Service } from './engine6.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [Engine6Controller],
  providers: [Engine6Service],
})
export class Engine6Module {}
