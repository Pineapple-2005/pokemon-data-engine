export interface Pokemon {
  pokemon_id: number;
  pokeapi_id: number;
  name: string;
  type_1: string;
  type_2?: string;
  hp: number;
  attack: number;
  defense: number;
  special_attack: number;
  special_defense: number;
  speed: number;
  total_base_stats: number;
  role_label: string;
  speed_tier: string;
  weakness_count: number;
  resistance_count: number;
  is_assigned: number;
  user_assigned?: boolean;
  native_region?: string;
  restricted_status?: string;
}

export interface TeamSlot {
  slot: number;
  role: string;
  name: string;
  pokeapi_id?: number;
  type_1: string;
  type_2?: string;
  total_base_stats: number;
  usefulness_score: number;
  reason: string;
  native_region?: string;
  generation?: number;
  restricted_status?: string;
  loadout?: TournamentLoadout;
}

export interface TournamentLoadout {
  item: string;
  ability: string;
  evs: string;
  nature: string;
  moves: [string, string, string, string];
}

export interface Engine1Response {
  theme: string;
  difficulty: string;
  team: TeamSlot[];
  model_used: string;
  metrics: { silhouette_score: number };
  explanation: string;
  showdown_text?: string;
}

export interface CounterSlot {
  rank: number;
  name: string;
  counter_score: number;
  score_breakdown: { tcs: number; sas: number; rs: number; knn: number; dt: number };
  type_1: string;
  type_2?: string;
  reason: string;
  pokeapi_id?: number;
  role?: string;
  loadout?: TournamentLoadout;
}

export interface Engine2Response {
  opponent_team: string[];
  recommended_team: CounterSlot[];
  model_used: string;
  matchup_table: Record<string, { advantage: string; multiplier: number }>;
  opponent_team_data?: { name: string; pokeapi_id?: number; type_1?: string; type_2?: string }[];
  showdown_text?: string;
}

export interface Engine3Response {
  match_id: string;
  battler_a?: string;
  battler_b?: string;
  predicted_winner: string;
  confidence: number;
  reason: string;
  model_votes: Record<string, string>;
  features_used?: Record<string, number>;
}

export interface CounterMetrics {
  total: number;
  wins: number;
  rate: number;
  rate_pct: string;
}

export interface ModelMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  brier_score: number;
  log_loss: number;
  confusion_matrix: { tp: number; fp: number; tn: number; fn: number };
  total_battles: number;
  correct_predictions: number;
}

export interface PredictionWithResult {
  match_id: string;
  battler_a: string;
  battler_b: string;
  team_a?: string[];
  team_b?: string[];
  predicted_winner: string;
  confidence_score: number;
  actual_winner?: string;
  correct_prediction?: number;
  replay_link?: string;
  screenshot_link?: string;
  final_score?: string;
  predicted_at: string;   // view alias of prediction.timestamp
  result_at?: string;     // view alias of ground_truth.timestamp
}

export interface AuditEntry {
  audit_id: number;
  user_or_group: string;
  action_done: string;
  affected_table: string;
  affected_record: string;
  new_value: string;
  timestamp: string;
}

// Engine 4 — Archive
export interface LeaderboardEntry {
  rank: number;
  trainer: string;
  wins: number;
  losses: number;
  win_rate: number;
  total_battles: number;
  avg_confidence: number;
}

export interface ArchiveStats {
  total_battles: number;
  most_used_pokemon: string;
  most_accurate_model: string;
  overall_accuracy: number;
}

// Engine 5 — Commentator
export interface CommentaryResponse {
  match_id: string;
  commentary: string;
  model: string;
}

// Engine 6 — Pokedex AI
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
}

export interface ChatResponse {
  answer: string;
  sources: string[];
}

// Engine 9 — Scanner
export interface WeaknessEntry {
  type: string;
  avg_multiplier: number;
  classification: 'weak' | 'neutral' | 'resist';
  defending_types: Array<{ name: string; multiplier: number }>;
}

export interface ScanResult {
  team: Array<{ name: string; found: boolean }>;
  weakness_profile: WeaknessEntry[];
  offensive_coverage: string[];
  uncovered_types: string[];
  recommended_cover: string[];
}

// Engine 10 — Replay
export interface ReplayEvent {
  turn: number;
  type: 'move' | 'switch' | 'damage' | 'heal' | 'faint' | 'turn' | 'win';
  player?: 'p1' | 'p2';
  pokemon?: string;
  detail?: string;
}

// Trainer profile
export interface TrainerProfile {
  id: string;
  username: string;
  display_name: string;
  section: string;
  trainer_class: string;
  trainer_card_color: string;
  starter_pokemon: string;
  hometown: string;
  favorite_type: string;
  trainer_title: string;
  rival_name: string;
  trainer_id: string;
}
