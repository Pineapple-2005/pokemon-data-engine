// =============================================================================
// Shared TypeScript interfaces — all database return types
// =============================================================================

// ---------------------------------------------------------------------------
// pokemon_data
// ---------------------------------------------------------------------------
export interface Pokemon {
  pokemon_id: number;
  pokeapi_id: number;
  name: string;
  type_1: string;
  type_2: string | null;
  hp: number;
  attack: number;
  defense: number;
  special_attack: number;
  special_defense: number;
  speed: number;
  base_experience: number | null;
  ability_1: string | null;
  ability_2: string | null;
  hidden_ability?: string | null;
  total_base_stats: number;
  attack_ratio: number;
  special_attack_ratio: number;
  speed_tier: 'slow' | 'medium' | 'fast';
  speed_tier_encoded: number;
  weakness_count: number;
  resistance_count: number;
  type_coverage_score: number;
  role_label: 'sweeper' | 'tank' | 'wall' | 'support' | 'balanced';

  // Defensive type matchups
  def_vs_normal: number | null;
  def_vs_fire: number | null;
  def_vs_water: number | null;
  def_vs_electric: number | null;
  def_vs_grass: number | null;
  def_vs_ice: number | null;
  def_vs_fighting: number | null;
  def_vs_poison: number | null;
  def_vs_ground: number | null;
  def_vs_flying: number | null;
  def_vs_psychic: number | null;
  def_vs_bug: number | null;
  def_vs_rock: number | null;
  def_vs_ghost: number | null;
  def_vs_dragon: number | null;
  def_vs_dark: number | null;
  def_vs_steel: number | null;
  def_vs_fairy: number | null;

  // Scaled stats
  hp_scaled: number | null;
  attack_scaled: number | null;
  defense_scaled: number | null;
  special_attack_scaled: number | null;
  special_defense_scaled: number | null;
  speed_scaled: number | null;
  total_scaled: number | null;

  native_region: string;
  generation: number;
  restricted_status: string;
  is_assigned: 0 | 1;
  data_source: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// engine_output
// ---------------------------------------------------------------------------
export interface EngineOutput {
  engine_id: number;
  section: string;
  group_name: string;
  engine_type: 'gym_leader' | 'counter_pick' | 'battle_predictor';
  model_used: string;
  input_data: string;
  generated_output: string;
  native_region_validation?: string;
  region?: string;
  type_specialization?: string;
  gym_leader?: string;
  metric_used?: string;
  challenger_region?: string;
  target_gym_leader?: string;
  counter_score?: number;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// prediction
// ---------------------------------------------------------------------------
export interface Prediction {
  match_id: string;
  battler_a: string;
  battler_b: string;
  predicted_winner: string;
  confidence_score: number;
  prediction_reason: string;
  model_used: string;
  team_a: string;
  team_b: string;
  is_locked: 0 | 1;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// ground_truth
// ---------------------------------------------------------------------------
export interface GroundTruth {
  id: number;
  match_id: string;
  actual_winner: string;
  correct_prediction: 0 | 1;
  replay_link: string | null;
  screenshot_link: string | null;
  final_score: string | null;
  num_turns: number | null;
  mvp_pokemon: string | null;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// v_prediction_accuracy (view)
// ---------------------------------------------------------------------------
export interface PredictionWithResult extends Prediction {
  actual_winner: string;
  correct_prediction: 0 | 1;
  final_score: string | null;
  num_turns: number | null;
  mvp_pokemon: string | null;
  predicted_at: string;
  result_at: string;
}

// ---------------------------------------------------------------------------
// audit_log
// ---------------------------------------------------------------------------
export type AuditAction =
  | 'INSERT'
  | 'UPDATE'
  | 'DELETE'
  | 'PREDICT'
  | 'BATTLE_END'
  | 'LOCK';

export interface AuditLog {
  audit_id: number;
  user_or_group: string;
  action_done: AuditAction;
  affected_table: string;
  affected_record: string;
  old_value: string | null;
  new_value: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Aggregated metrics shapes
// ---------------------------------------------------------------------------
export interface PredictionAccuracy {
  total: number;
  correct: number;
  accuracy: number;
}

export interface ConfusionMatrix {
  tp: number;
  fp: number;
  tn: number;
  fn: number;
}
