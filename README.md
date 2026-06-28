# 🎬 Movie-RecSys — A MovieLens Recommender System

Individual project for the **Recommender Systems** course (Esade, Prof. Marc Torrens).
A progressive, **agile** build of a movie-recommender prototype on the **MovieLens Latest Small**
dataset — multiple algorithms behind one clean architecture, with a polished React UI.

## Architecture (three tiers)

```
Next.js (React + TS + Tailwind)  →  FastAPI REST  →  Python recommender core
```

- **`backend/src/`** — the engine; every algorithm implements one `Recommender` interface (`fit` / `recommend`).
- **`backend/api/`** — FastAPI exposing every model over REST (`/api/home`, `/api/recommend`, `/api/similar`, `/api/metrics`, …).
- **`frontend/`** — Next.js UI ("CineMatch"): `/` "Who's watching?" landing → `/u/[id]` Netflix-style home (hero, **Tonight's Arc**, rails, "why this" explanations, discovery slider) → `/evaluation` the metrics lab → `/u/[id]/chat` the **conversational AI guide**.

The design is *registry-driven*: add a model in `src/`, register it in `api/registry.py`, and it
appears automatically in the API, the evaluation harness, and the UI — no other changes needed.

### Project structure — clear separation of concerns

```
backend/
├── src/                          # the recommender CORE (models · data · evaluation · features)
│   ├── base.py                   #   shared Recommender interface (fit / recommend)
│   ├── data_loading.py           #   load · validate · EDA stats · train/test split
│   ├── baselines.py · collaborative_filtering.py · content_based.py
│   ├── matrix_factorization.py · learning_to_rank.py · reranking.py   # the models
│   ├── evaluation.py             #   OFFLINE EVALUATION (P@K · NDCG · diversity · novelty · …)
│   ├── insider.py · explain.py   #   feature engineering + grounded explanations
│   └── tmdb.py · gemini.py       #   external enrichment (metadata) + LLM intent parsing
├── main.py                       # MODEL TRAINING + EVALUATION pipeline -> results/metrics.csv
├── api/                          # APP LOGIC — FastAPI serving the core over REST
└── notebooks/eda.py              # exploratory data analysis -> results/figures/
frontend/                         # APP LOGIC — Next.js UI (decoupled from the core)
```

- **Model training** → the model classes in `src/*.py`, orchestrated by `main.py`.
- **Offline evaluation** → `src/evaluation.py`, run via `main.py`.
- **App logic** → `api/` (REST) + `frontend/` (UI), fully decoupled from the recommender core.

## Methods implemented

| Family | Models |
|---|---|
| Non-personalised | Most Popular · Highest Average · Bayesian Average · Random |
| Collaborative filtering | Item-Item CF · User-User CF |
| Content-based | TF-IDF over genres + tags + **TMDB** (overview/keywords/cast) · `similar_items` |
| Matrix factorization | Truncated-SVD latent factors |
| **Hybrid (Learning-to-Rank)** | LightGBM LambdaRank over all generators + insider studio-strategy features · MMR re-ranker (diversity/novelty/trust) |
| **Conversational (LLM)** | Gemini parses a free-text vibe → structured filters → our recommender ranks → grounded reply |

## Results so far (P@10, per-user 80/20 split, k=10)

| Model | P@10 | NDCG@10 | Coverage |
|---|---|---|---|
| **ltr_hybrid** | **0.172** | **0.219** | 0.051 |
| user_user_cf | 0.168 | 0.217 | 0.030 |
| ltr_reranked | 0.164 | 0.209 | 0.059 |
| item_item_cf | 0.137 | 0.177 | 0.148 |
| most_popular | 0.128 | 0.158 | 0.006 |
| bayesian_avg | 0.079 | 0.096 | 0.004 |
| content_based | 0.043 | 0.065 | 0.179 |
| random | 0.001 | 0.002 | 0.490 |

The spread illustrates the project's thesis — **accuracy is not everything**: the LTR hybrid leads on
accuracy, but content-based / random reach the long tail (coverage), and the re-ranker trades a little
precision for the best diversity & serendipity.

## Each model — purpose & limitation

| Model | Purpose | Key limitation |
|---|---|---|
| Most Popular | Cold-start floor; needs zero personal history | One list for everyone; severe popularity bias |
| Highest Average | Surfaces top-rated films | Hard min-vote cutoff discards the long tail |
| Bayesian Average | Shrinks ratings toward the global mean by vote count | Still non-personalised |
| Random | Honest lower bound + maximal coverage | ≈ 0 relevance |
| Item-Item CF | "More like the films you rated" | Fragile on 98.3% sparsity (cold items) |
| User-User CF | "What similar viewers loved" | Strong accuracy, narrow coverage; O(users²) |
| Content-based | Reaches cold items via genres + TMDB text | Coarse features → low precision; no collaborative signal |
| Matrix Factorization | Latent factors generalise through sparsity | Vanilla SVD; cold users need a fallback |
| **LTR Hybrid** | Learns to combine every generator (LambdaRank) | Generators see only 75% of train (for leakage-free labels) |
| **Re-ranker** | Injects diversity / novelty / trust (greedy MMR) | Deliberately trades a little precision |
| **AI Guide (Gemini)** | Natural language → intent; conversational steering | LLM only parses & explains — never ranks; needs API quota |

## Run it

**Backend**
```bash
cd backend
pip install -r requirements.txt
py main.py                                  # offline evaluation -> results/metrics.csv
py -m uvicorn api.main:app --port 8000      # REST API (http://127.0.0.1:8000/docs)
```

**Frontend**
```bash
cd frontend
npm install
npm run dev                                 # http://localhost:3000
```

Open **http://localhost:3000** → "Who's watching?" → pick a viewer.

**Optional — external enrichment** (the app runs without these and falls back gracefully):
create `backend/.env` with `TMDB_API_KEY=…` (posters + metadata) and `GEMINI_API_KEY=…` (the AI guide).

## Dataset

MovieLens Latest Small (GroupLens), under `backend/data/raw/`.
Cite: F. M. Harper & J. A. Konstan (2015), *The MovieLens Datasets: History and Context*, ACM TiiS.

Movie posters, overviews, keywords and cast are enriched via **TMDB**.
*This product uses the TMDB API but is not endorsed or certified by TMDB.*

## Project plan

Built sprint by sprint with Agile methodology — see [`WORKPLAN.md`](WORKPLAN.md) for the backlog,
sprint plan, and design decisions.
