import { IsString, IsNumber, IsNotEmpty, Min, Max, IsOptional } from 'class-validator';

export class CreatePredictionDto {
  @IsString()
  @IsNotEmpty()
  match_id: string;

  @IsString()
  @IsNotEmpty()
  battler_a: string;

  @IsString()
  @IsNotEmpty()
  battler_b: string;

  @IsString()
  @IsNotEmpty()
  predicted_winner: string;

  @IsNumber()
  @Min(0.0)
  @Max(1.0)
  confidence_score: number;

  @IsString()
  @IsNotEmpty()
  prediction_reason: string;

  @IsString()
  @IsOptional()
  model_used?: string;

  /** JSON-serialised array of Pokémon names, e.g. '["pikachu","raichu"]' */
  @IsString()
  @IsNotEmpty()
  team_a: string;

  /** JSON-serialised array of Pokémon names */
  @IsString()
  @IsNotEmpty()
  team_b: string;

  @IsString()
  @IsOptional()
  user_id?: string;
}
