# Pokémon Data Engine

A full-stack ML-powered battle platform built on Gen 1 Pokémon data. 10 engines covering team generation, counter-picking, battle prediction, AI commentary, Pokédex Q&A, and live analytics — with full user authentication and a customizable trainer profile system.

## Architecture

```
[Next.js 14 :3000]  ──►  [NestJS :3001]  ──►  [Python FastAPI :8000]
                               │
                         [Supabase PostgreSQL]
```

## Quick Start

### 1. Install dependencies

```bash
# Python ML service
cd ml && pip install -r requirements.txt

# Backend
cd backend && npm install

# Frontend
cd frontend && npm install
```

### 2. Configure environment

```bash
# backend/.env
DB_HOST=your-supabase-host
DB_USER=postgres
DB_PASSWORD=your-password
DB_NAME=postgres
ML_SERVICE_URL=http://localhost:8000
JWT_SECRET=your-jwt-secret
JWT_EXPIRES_IN=7d
ANTHROPIC_API_KEY=your-anthropic-key   # Required for Engines 5 & 6
CORS_ORIGIN=http://localhost:3000
PORT=3001
```

### 3. Seed the database (run once)

```bash
cd ml
python pipeline/run_pipeline.py --limit 151
python pipeline/generate_synthetic_battles.py --n-battles 500
```

### 4. Start all services

```bash
# Terminal 1 — ML service
cd ml && uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2 — Backend
cd backend && npm run start:dev

# Terminal 3 — Frontend
cd frontend && npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## The 10 Engines

| # | Name | Route | Type | Description |
|---|------|-------|------|-------------|
| 01 | **The Forge** | `/engine1` | Required | Gym Leader Team Generator |
| 02 | **The Counter** | `/engine2` | Required | Challenger Selection Engine |
| 03 | **The Oracle** | `/engine3` | Required | Battle Predictor + Ground Truth Logger |
| 04 | **The Archive** | `/archive` | Required (Bonus) | Post-Battle Analytics + Live Leaderboard |
| 05 | **The Commentator** | `/engine5` | Bonus — AI | AI Post-Battle Analysis via Anthropic Claude |
| 06 | **The Pokedex AI** | `/engine6` | Bonus — RAG | RAG-powered Pokémon Q&A with Professor Oak |
| 07 | **The Exporter** | `/engine7` | Bonus — Utility | One-click Showdown Team Formatter |
| 08 | **The Wall** | `/wall` | Bonus — Display | Fullscreen Live Leaderboard for projection |
| 09 | **The Scanner** | `/engine9` | Bonus — Analytics | Team Weakness Radar + Coverage Audit |
| 10 | **The Replay** | `/engine10` | Bonus — Visualizer | Battle Replay Timeline Parser |

---

## Engine Summaries

### Engine 01 — The Forge
Generates a 6-Pokémon Gym Leader team using ML clustering. Pick a type specialty (Fire, Water, Psychic, etc.), difficulty (Easy/Medium/Hard), region, and gym leader name. Models: K-Means, Decision Tree, Random Forest, Cosine Similarity, Gower's Distance. Outputs team with roles, BST, silhouette score.

### Engine 02 — The Counter
Given an opponent's team, recommends the best counter team from the user's assigned Pokémon pool. Falls back to the global assigned pool if the user has no personal pool. Models: Type Advantage Score, K-NN, Decision Tree. Metric: Counter Success Rate.

### Engine 03 — The Oracle
Pre-battle prediction engine. Enter two trainers + their teams before the battle starts. The prediction is locked immediately. After the battle, record the actual winner + optional replay link. 5-model ensemble: Decision Tree, Random Forest, Logistic Regression, Naïve Bayes, K-NN. Metrics: Accuracy, Precision, Recall, F1, Brier Score, Log Loss, Confusion Matrix.

### Engine 04 — The Archive
Live leaderboard ranking all trainers by win rate, W/L record, and average confidence. Global stats: total battles, most-used Pokémon, most accurate model, overall accuracy. Also accessible as the main panel on the dashboard Pokédex card.

### Engine 05 — The Commentator
AI-generated post-battle commentary powered by Anthropic Claude (claude-sonnet-4-6). Select a completed battle; the engine builds a structured prompt from the team data, prediction, and actual result, then generates 3 paragraphs of dramatic anime-style commentary.

### Engine 06 — The Pokedex AI
RAG-powered chat with Professor Oak. Uses keyword filtering on all 151 Pokémon rows to select the 10 most relevant as context, then calls Claude to answer the question in Professor Oak's voice. No vector database required — structured data approach.

### Engine 07 — The Exporter
Standalone import/export tool for Pokémon Showdown. Paste a PS team text to import Pokémon into the system, or build a team from your pool and export in PS-importable format with one click.

### Engine 08 — The Wall
Fullscreen live leaderboard at `/wall` with no navigation bar — designed for projector display in a classroom. Polls the leaderboard every 10 seconds with large-format trainer names and animated rank changes.

### Engine 09 — The Scanner
Team weakness radar and coverage audit. Enter up to 4 Pokémon names; the system aggregates all `def_vs_*` multipliers across the team and renders a pure SVG 18-axis radar chart. Highlights weaknesses, resistances, and recommends types to add.

### Engine 10 — The Replay
Battle replay timeline parser. Enter a Pokémon Showdown replay ID; the backend fetches the replay JSON, parses `|move|`, `|damage|`, `|switch|`, `|faint|`, `|win|` log events, and returns a structured turn-by-turn timeline displayed in the viewer.

---

## Authentication

All engine POST endpoints require a JWT. Register or log in at `/login`. The 2-step registration includes trainer customization (sprite, card color, starter Pokémon, hometown, trainer title). Login returns the full trainer profile which is stored in localStorage.

---

## Pokémon Showdown Integration

- **Export team** (Engine 01): "EXPORT FOR SHOWDOWN" copies a PS-importable team text. "Open in Showdown ↗" copies the team then opens PS teambuilder — paste using "Import from text or URL".
- **Import team** (Engine 02): "IMPORT FROM SHOWDOWN" button opens a modal where you paste a PS team text and map it to your assigned pool.
- **Replay sync** (`POST /api/replay/sync`): Syncs recent Gen 1 OU replays from the PS replay API into the local database.

---

## API Reference

### Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | None | Register + trainer customization |
| POST | `/api/auth/login` | None | Login → returns full trainer profile |
| GET | `/api/auth/profile` | JWT | Get current user's trainer profile |
| PATCH | `/api/auth/profile` | JWT | Update trainer customization |
| GET | `/api/auth/profile/:username` | None | Public trainer card view |

### Engines
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/engine1/generate` | JWT | Generate gym leader team |
| GET | `/api/engine1/showdown-export-json` | None | Last team in PS format |
| POST | `/api/engine2/counter` | JWT | Get counter team (uses personal pool) |
| POST | `/api/engine2/counter-from-data` | JWT | Stateless counter (caller supplies data) |
| GET | `/api/engine2/metrics` | Optional | Counter success rate |
| POST | `/api/engine3/predict` | JWT | Pre-battle prediction (locks immediately) |
| POST | `/api/engine3/result` | JWT | Record actual battle result |
| GET | `/api/engine3/history` | Optional | Battle predictions + results |
| GET | `/api/engine3/accuracy` | Optional | Model accuracy metrics |
| POST | `/api/engine5/comment` | JWT | Generate AI commentary for a match |
| POST | `/api/engine6/chat` | None | Ask Professor Oak a question |
| GET | `/api/engine9/scan` | None | `?names=pikachu,starmie,...` → weakness radar |
| GET | `/api/replay/:id/timeline` | None | PS replay event timeline |

### Pokémon & Data
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/pokemon` | None | All Pokémon (filterable) |
| GET | `/api/pokemon/my-pool` | JWT | 151 rows with user_assigned boolean |
| POST | `/api/pokemon/assign` | JWT | Add Pokémon to personal pool |
| DELETE | `/api/pokemon/assign` | JWT | Remove from personal pool |
| POST | `/api/pokemon/import-team` | JWT | Parse PS text → matched Pokémon |
| GET | `/api/archive/leaderboard` | None | Trainer rankings |
| GET | `/api/archive/stats` | None | Global battle statistics |
| POST | `/api/replay/sync` | None | Sync Gen 1 OU replays from PS |
| GET | `/api/replay/recent` | None | Recently synced replays |
| GET | `/api/audit` | None | Audit log |

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `users` | Trainer accounts + full customization profile |
| `pokemon_data` | 151 Gen 1 Pokémon with stats, features, role labels, type matchups |
| `user_pokemon_assignment` | Per-user Pokémon pool (join table) |
| `engine_output` | All engine run results logged automatically |
| `prediction` | Pre-battle predictions (locked on creation) |
| `ground_truth` | Actual battle results + correctness flag |
| `audit_log` | Complete timestamped change history |
| `showdown_replay` | Synced PS replays for Engine 10 |

---

## Project Structure

```
datamining/
├── frontend/               Next.js 14 (TypeScript)
│   └── src/
│       ├── app/            Pages (one per engine + dashboard/login/profile/wall)
│       ├── components/ui/  Shared components (Navbar, TrainerCard, PokemonAutocomplete, ...)
│       ├── lib/            api.ts · auth.ts · pokemon-ids.ts
│       ├── hooks/          usePokemonSearch
│       └── types/          index.ts (all interfaces)
├── backend/                NestJS (TypeScript) — port 3001
│   └── src/
│       ├── auth/           JWT auth + trainer profile endpoints
│       ├── engine1–3/      Core ML engine controllers + services
│       ├── engine5,6,9/    Bonus engine controllers + services
│       ├── archive/        Leaderboard + global stats
│       ├── pokemon/        Pokémon DB + pool management + Showdown parser
│       ├── replay/         PS replay sync + timeline parser
│       ├── database/       DatabaseService (Supabase PostgreSQL via pg)
│       └── ml/             HTTP client to FastAPI ML service
├── ml/                     Python FastAPI — port 8000
│   ├── pipeline/           ETL scripts (run once to seed DB)
│   ├── engines/            ML engine implementations
│   ├── api/                FastAPI routes + schemas
│   ├── utils/              Type chart, feature builder, name normalizer
│   └── models/             Trained model files (.pkl, auto-generated)
└── database/               schema.sql (reference DDL)
```
