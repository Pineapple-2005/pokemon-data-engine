# Pokemon Data Mining — 3 Engine Dashboard

Three ML-powered engines for Pokémon team building and battle prediction.

## Architecture

```
[Next.js Frontend :3000]  →  [NestJS Backend :3001]  →  [Python FastAPI :8000]
                                        ↓
                                  [pokemon.db SQLite]
```

## Quick Start

### 1. Install Python dependencies
```bash
cd ml
pip install -r requirements.txt
```

### 2. Seed the database (runs once)
```bash
cd ml
python pipeline/run_pipeline.py --limit 151
python pipeline/generate_synthetic_battles.py --n-battles 500
```

### 3. Start the Python ML service
```bash
cd ml
uvicorn api.main:app --port 8000 --reload
```

### 4. Start the NestJS backend
```bash
cd backend
npm run start:dev
```

### 5. Start the Next.js frontend
```bash
cd frontend
npm run dev
```

Open http://localhost:3000

---

## Engines

### Engine 1 — Gym Leader Team Generator (`/engine1`)
- Pick a type theme (Electric, Dragon, Balanced, etc.) and difficulty
- Generates a 6-Pokémon team with roles (Sweeper, Tank, Wall, Support, Balanced, Ace)
- Models: K-Means + Decision Tree + Random Forest + Cosine Similarity + Gower's Distance

### Engine 2 — Counter-Pick Engine (`/engine2`)
- Enter your opponent's 6 Pokémon
- Gets the best counter team from your **assigned pool only**
- Models: Type Advantage Score + K-NN + Decision Tree
- Metric: Counter Success Rate on `/metrics`

### Engine 3 — Battle Predictor (`/engine3`)
- Enter two battlers + their teams
- **Prediction must be recorded BEFORE the battle starts**
- After the battle: record actual winner + replay link
- Models: 5-model ensemble (DT + RF + LR + NB + KNN)
- Metrics: Accuracy, Precision, Recall, F1, Brier Score, Log Loss, Confusion Matrix

---

## Assigned Pokémon CSV

When you receive your assigned CSV, place it at:
```
ml/data/csv/assigned_pokemon.csv
```
Then re-run the pipeline:
```bash
python pipeline/run_pipeline.py --limit 151
```
Engine 2 will automatically use only your assigned Pokémon.

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/engine1/generate` | Generate gym leader team |
| POST | `/api/engine2/counter` | Get counter team |
| GET | `/api/engine2/metrics` | Counter success rate |
| POST | `/api/engine3/predict` | Pre-battle prediction |
| POST | `/api/engine3/result` | Post-battle ground truth |
| GET | `/api/engine3/history` | All predictions + results |
| GET | `/api/engine3/accuracy` | Model accuracy metrics |
| GET | `/api/pokemon` | Browse Pokémon database |
| GET | `/api/pokemon/assigned` | Assigned pool only |
| GET | `/api/audit` | Audit log |

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `pokemon_data` | All Pokémon with stats, features, role labels |
| `engine_output` | All engine run results (logged automatically) |
| `prediction` | Pre-battle predictions (locked immediately) |
| `ground_truth` | Actual battle results |
| `audit_log` | Complete change history |

---

## Project Structure

```
datamining/
├── frontend/         Next.js 14 (TypeScript)
├── backend/          NestJS (TypeScript)
├── ml/
│   ├── pipeline/     ETL scripts (run once to seed DB)
│   ├── engines/      ML engine implementations
│   ├── api/          FastAPI microservice
│   ├── utils/        Type chart, feature builder, name normalizer
│   └── models/       Trained model files (auto-generated)
├── database/         schema.sql (reference DDL)
└── pokemon.db        SQLite database (auto-generated)
```
