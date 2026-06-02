import { IsString, IsNumber, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class CreateGroundTruthDto {
  @IsString()
  @IsNotEmpty()
  match_id: string;

  @IsString()
  @IsNotEmpty()
  actual_winner: string;

  /** 1 = prediction was correct, 0 = incorrect */
  @IsNumber()
  @IsIn([0, 1])
  correct_prediction: 0 | 1;

  @IsString()
  @IsOptional()
  replay_link?: string;

  @IsString()
  @IsOptional()
  screenshot_link?: string;

  @IsString()
  @IsOptional()
  final_score?: string;

  @IsNumber()
  @IsOptional()
  num_turns?: number;

  @IsString()
  @IsOptional()
  mvp_pokemon?: string;
}
