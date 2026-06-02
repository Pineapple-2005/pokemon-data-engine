import { Module } from '@nestjs/common';
import { Engine9Controller } from './engine9.controller';
import { Engine9Service } from './engine9.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [Engine9Controller],
  providers: [Engine9Service],
})
export class Engine9Module {}
