import { IsString, IsNotEmpty, IsIn, IsOptional, IsNumber } from 'class-validator';

export type EngineType = 'gym_leader' | 'counter_pick' | 'battle_predictor';

export class CreateEngineOutputDto {
  @IsString()
  @IsNotEmpty()
  section: string;

  @IsString()
  @IsNotEmpty()
  group_name: string;

  @IsString()
  @IsIn(['gym_leader', 'counter_pick', 'battle_predictor'])
  engine_type: EngineType;

  @IsString()
  @IsNotEmpty()
  model_used: string;

  /** JSON-serialised input payload sent to the engine */
  @IsString()
  @IsNotEmpty()
  input_data: string;

  /** Raw text or JSON response produced by the engine */
  @IsString()
  @IsNotEmpty()
  generated_output: string;

  /** Optional validation note for native region rules */
  @IsOptional()
  @IsString()
  native_region_validation?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  type_specialization?: string;

  @IsOptional()
  @IsString()
  gym_leader?: string;

  @IsOptional()
  @IsString()
  metric_used?: string;

  @IsOptional()
  @IsString()
  challenger_region?: string;

  @IsOptional()
  @IsString()
  target_gym_leader?: string;

  @IsOptional()
  @IsNumber()
  counter_score?: number;

  @IsOptional()
  @IsString()
  user_id?: string;
}
