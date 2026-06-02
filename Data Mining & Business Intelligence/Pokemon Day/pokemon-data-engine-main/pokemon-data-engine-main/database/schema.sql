-- =============================================================================
-- Pokemon Data Mining — SQLite Schema
-- =============================================================================
-- Engine: SQLite (better-sqlite3)
-- Managed by: DatabaseService.initSchema()
-- All tables use CREATE TABLE IF NOT EXISTS for idempotent initialisation.
-- =============================================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- 1. pokemon_data
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pokemon_data (
  pokemon_id            INTEGER PRIMARY KEY AUTOINCREMENT,
  pokeapi_id            INTEGER UNIQUE NOT NULL,
  name                  TEXT    UNIQUE NOT NULL,
  type_1                TEXT    NOT NULL,
  type_2                TEXT,
  hp                    INTEGER NOT NULL,
  attack                INTEGER NOT NULL,
  defense               INTEGER NOT NULL,
  special_attack        INTEGER NOT NULL,
  special_defense       INTEGER NOT NULL,
  speed                 INTEGER NOT NULL,
  base_experience       INTEGER,
  ability_1             TEXT,
  ability_2             TEXT,
  total_base_stats      INTEGER NOT NULL,
  attack_ratio          REAL    NOT NULL,
  special_attack_ratio  REAL    NOT NULL,
  speed_tier            TEXT    NOT NULL CHECK(speed_tier IN ('slow','medium','fast')),
  speed_tier_encoded    INTEGER NOT NULL,
  weakness_count        INTEGER NOT NULL DEFAULT 0,
  resistance_count      INTEGER NOT NULL DEFAULT 0,
  type_coverage_score   INTEGER NOT NULL DEFAULT 0,
  role_label            TEXT    NOT NULL CHECK(role_label IN ('sweeper','tank','wall','support','balanced')),

  -- 18 defensive type-matchup multipliers (0.0 = immune, 0.5 = resist, 1.0 = neutral, 2.0 = weak)
  def_vs_normal   REAL,
  def_vs_fire     REAL,
  def_vs_water    REAL,
  def_vs_electric REAL,
  def_vs_grass    REAL,
  def_vs_ice      REAL,
  def_vs_fighting REAL,
  def_vs_poison   REAL,
  def_vs_ground   REAL,
  def_vs_flying   REAL,
  def_vs_psychic  REAL,
  def_vs_bug      REAL,
  def_vs_rock     REAL,
  def_vs_ghost    REAL,
  def_vs_dragon   REAL,
  def_vs_dark     REAL,
  def_vs_steel    REAL,
  def_vs_fairy    REAL,

  -- MinMax-scaled stats (0.0–1.0 range, computed by ML layer)
  hp_scaled             REAL,
  attack_scaled         REAL,
  defense_scaled        REAL,
  special_attack_scaled REAL,
  special_defense_scaled REAL,
  speed_scaled          REAL,
  total_scaled          REAL,

  -- Assignment flag: 1 = assigned to a trainer/team, 0 = available
  is_assigned           INTEGER NOT NULL DEFAULT 0 CHECK(is_assigned IN (0,1)),

  data_source           TEXT    NOT NULL DEFAULT 'pokeapi',
  created_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pokemon_data_name        ON pokemon_data(name);
CREATE INDEX IF NOT EXISTS idx_pokemon_data_type_1      ON pokemon_data(type_1);
CREATE INDEX IF NOT EXISTS idx_pokemon_data_role_label  ON pokemon_data(role_label);
CREATE INDEX IF NOT EXISTS idx_pokemon_data_speed_tier  ON pokemon_data(speed_tier);
CREATE INDEX IF NOT EXISTS idx_pokemon_data_is_assigned ON pokemon_data(is_assigned);

-- ---------------------------------------------------------------------------
-- 2. engine_output
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS engine_output (
  engine_id        INTEGER PRIMARY KEY AUTOINCREMENT,
  section          TEXT    NOT NULL,
  group_name       TEXT    NOT NULL,
  engine_type      TEXT    NOT NULL CHECK(engine_type IN ('gym_leader','counter_pick','battle_predictor')),
  model_used       TEXT    NOT NULL,
  input_data       TEXT    NOT NULL,  -- JSON blob
  generated_output TEXT    NOT NULL,  -- JSON blob or markdown
  timestamp        TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_engine_output_engine_type ON engine_output(engine_type);
CREATE INDEX IF NOT EXISTS idx_engine_output_timestamp   ON engine_output(timestamp DESC);

-- ---------------------------------------------------------------------------
-- 3. prediction  (locked before a battle begins)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS prediction (
  match_id          TEXT    PRIMARY KEY,
  battler_a         TEXT    NOT NULL,
  battler_b         TEXT    NOT NULL,
  predicted_winner  TEXT    NOT NULL,
  confidence_score  REAL    NOT NULL CHECK(confidence_score BETWEEN 0.0 AND 1.0),
  prediction_reason TEXT    NOT NULL,
  model_used        TEXT    NOT NULL DEFAULT 'ensemble',
  team_a            TEXT    NOT NULL,  -- JSON array of pokemon names
  team_b            TEXT    NOT NULL,  -- JSON array of pokemon names
  is_locked         INTEGER NOT NULL DEFAULT 0 CHECK(is_locked IN (0,1)),
  timestamp         TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_prediction_battler_a  ON prediction(battler_a);
CREATE INDEX IF NOT EXISTS idx_prediction_battler_b  ON prediction(battler_b);
CREATE INDEX IF NOT EXISTS idx_prediction_is_locked  ON prediction(is_locked);
CREATE INDEX IF NOT EXISTS idx_prediction_timestamp  ON prediction(timestamp DESC);

-- ---------------------------------------------------------------------------
-- 4. ground_truth  (actual battle outcome — recorded after battle)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ground_truth (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id           TEXT    NOT NULL UNIQUE,
  actual_winner      TEXT    NOT NULL,
  correct_prediction INTEGER NOT NULL CHECK(correct_prediction IN (0,1)),
  replay_link        TEXT,
  screenshot_link    TEXT,
  final_score        TEXT,
  num_turns          INTEGER,
  mvp_pokemon        TEXT,
  timestamp          TEXT    NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (match_id) REFERENCES prediction(match_id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ground_truth_match_id  ON ground_truth(match_id);
CREATE INDEX IF NOT EXISTS idx_ground_truth_timestamp ON ground_truth(timestamp DESC);

-- ---------------------------------------------------------------------------
-- 5. audit_log  (append-only audit trail — no UPDATE / DELETE allowed here)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  audit_id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_or_group   TEXT    NOT NULL DEFAULT 'system',
  action_done     TEXT    NOT NULL CHECK(action_done IN ('INSERT','UPDATE','DELETE','PREDICT','BATTLE_END','LOCK')),
  affected_table  TEXT    NOT NULL,
  affected_record TEXT    NOT NULL,
  old_value       TEXT,
  new_value       TEXT    NOT NULL,
  timestamp       TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_log_affected_table ON audit_log(affected_table);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp      ON audit_log(timestamp DESC);

-- ---------------------------------------------------------------------------
-- Views
-- ---------------------------------------------------------------------------

-- v_prediction_accuracy: every prediction LEFT JOINED with its ground truth result
-- Uses LEFT JOIN so pending (unfinished) battles still appear in history.
-- Includes all prediction columns so NestJS DatabaseService can query a single view.
CREATE VIEW IF NOT EXISTS v_prediction_accuracy AS
SELECT
  p.match_id,
  p.battler_a,
  p.battler_b,
  p.predicted_winner,
  p.confidence_score,
  p.prediction_reason,
  p.model_used,
  p.team_a,
  p.team_b,
  p.is_locked,
  p.timestamp         AS predicted_at,
  gt.actual_winner,
  gt.correct_prediction,
  gt.replay_link,
  gt.screenshot_link,
  gt.final_score,
  gt.num_turns,
  gt.mvp_pokemon,
  gt.timestamp        AS result_at
FROM prediction p
LEFT JOIN ground_truth gt ON gt.match_id = p.match_id;

-- v_engine_summary: aggregated counts and latest run per engine type / model
CREATE VIEW IF NOT EXISTS v_engine_summary AS
SELECT
  engine_type,
  model_used,
  COUNT(*)             AS run_count,
  MAX(timestamp)       AS last_run_at,
  COUNT(DISTINCT section) AS distinct_sections
FROM engine_output
GROUP BY engine_type, model_used;
