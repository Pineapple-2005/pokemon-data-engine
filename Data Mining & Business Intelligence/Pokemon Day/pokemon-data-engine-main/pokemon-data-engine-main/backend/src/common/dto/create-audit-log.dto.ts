import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';
import { AuditAction } from '../interfaces/pokemon.interface';

export class CreateAuditLogDto {
  @IsString()
  @IsOptional()
  user_or_group?: string;

  @IsString()
  @IsIn(['INSERT', 'UPDATE', 'DELETE', 'PREDICT', 'BATTLE_END', 'LOCK'])
  action_done: AuditAction;

  @IsString()
  @IsNotEmpty()
  affected_table: string;

  @IsString()
  @IsNotEmpty()
  affected_record: string;

  @IsString()
  @IsOptional()
  old_value?: string;

  @IsString()
  @IsNotEmpty()
  new_value: string;

  @IsString()
  @IsOptional()
  user_id?: string;
}
