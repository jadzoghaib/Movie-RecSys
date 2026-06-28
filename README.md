# 🎬 Movie-RecSys — A MovieLens Recommender System

Individual project for the **Recommender Systems** course (Esade, Prof. Marc Torrens).
A progressive, **agile** build of a movie-recommender prototype on the **MovieLens Latest Small**
dataset — multiple algorithms behind one clean architecture, with a polished React UI.

## Architecture (three tiers)

```
React (Vite + TS + Tailwind)  →  FastAPI REST  →  Python recommender core
```

- **`backend/src/`** — the engine; every algorithm implements one `Recommender` interface (`fit` / `recommend`).
- **`backend/api/`** — FastAPI exposing every model over REST (`/api/recommend`, `/api/similar`, `/api/metrics`, …).
- **`frontend/`** — React UI ("CineMatch"): pick a user + algorithm → movie grid, "more like this", live metrics.

The design is *registry-driven*: add a model in `src/`, register it in `api/registry.py`, and it
appears automatically in the API, the evaluation harness, and the UI — no other changes needed.

## Methods implemented

| Family | Models |
|---|---|
| Non-personalised | Most Popular · Highest Average · Bayesian Average · Random |
| Collaborative filtering | Item-Item CF · User-User CF |
| Content-based | TF-IDF over genres + tags + **TMDB** (overview/keywords/cast) · `similar_items` |
| Matrix factorization | _(in progress)_ |

## Results so far (P@10, per-user 80/20 split, k=10)

| Model | P@10 | NDCG@10 | Coverage |
|---|---|---|---|
| user_user_cf | **0.168** | **0.217** | 0.030 |
| item_item_cf | 0.137 | 0.177 | 0.148 |
| most_popular | 0.128 | 0.158 | 0.006 |
| bayesian_avg | 0.079 | 0.096 | 0.004 |
| content_based | 0.043 | 0.065 | 0.179 |
| random | 0.001 | 0.002 | 0.490 |

The spread illustrates the project's thesis — **accuracy is not everything**: the most accurate model
(user-user CF) has tiny coverage, while content-based/random reach the long tail.

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
npm run dev                                 # http://localhost:5173
```

## Dataset

MovieLens Latest Small (GroupLens), under `backend/data/raw/`.
Cite: F. M. Harper & J. A. Konstan (2015), *The MovieLens Datasets: History and Context*, ACM TiiS.

Movie posters, overviews, keywords and cast are enriched via **TMDB**.
*This product uses the TMDB API but is not endorsed or certified by TMDB.*

## Project plan

Built sprint by sprint with Agile methodology — see [`WORKPLAN.md`](WORKPLAN.md) for the backlog,
sprint plan, and design decisions.
