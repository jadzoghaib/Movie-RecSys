"""FastAPI application: serves the recommenders as a JSON REST API.

Run from backend/:  py -m uvicorn api.main:app --reload --port 8000
"""

from contextlib import asynccontextmanager

import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src import config
from src.data_loading import (
    load_ratings, load_items, load_links, train_test_split_ratings,
)
from src.tmdb import load_cache
from src.reranking import ReRankedRecommender
from api.registry import build_models

STATE = {}


def build_state():
    """Load data once, fit every model, and build lookup tables."""
    ratings = load_ratings()
    items = load_items()
    links = load_links()

    train, test = train_test_split_ratings(ratings, test_size=0.2)

    models = {}
    for model in build_models():
        model.fit(train, items)
        models[model.name] = model

    # re-ranked LTR reuses the already-fitted hybrid (no second LTR fit)
    if "ltr_hybrid" in models:
        rr = ReRankedRecommender(base=models["ltr_hybrid"])
        rr.fit(train, items, fit_base=False)
        models[rr.name] = rr

    if links is not None:
        items = items.merge(links[[config.ITEM_COL, "tmdbId", "imdbId"]],
                            on=config.ITEM_COL, how="left")

    tmdb_cache = load_cache()
    item_meta = {}
    for row in items.itertuples(index=False):
        tmdb = getattr(row, "tmdbId", None)
        genres = row.genres.split("|") if isinstance(row.genres, str) else []
        cd = tmdb_cache.get(str(int(row.movieId)))
        usable = cd if (cd and "error" not in cd) else {}
        item_meta[int(row.movieId)] = {
            "movie_id": int(row.movieId),
            "title": row.title,
            "genres": [g for g in genres if g and g != "(no genres listed)"],
            "poster_url": usable.get("poster_url"),
            "overview": usable.get("overview", ""),
            "tmdb_url": (f"https://www.themoviedb.org/movie/{int(tmdb)}"
                        if pd.notna(tmdb) else None),
        }

    STATE.update(
        ratings=ratings, train=train, test=test, models=models,
        item_meta=item_meta,
        user_counts=ratings[config.USER_COL].value_counts(),
    )


@asynccontextmanager
async def lifespan(app):
    build_state()
    yield


app = FastAPI(title="Movie Recommender API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _enrich(item_id, score=None):
    meta = STATE["item_meta"].get(int(item_id), {
        "movie_id": int(item_id), "title": str(item_id),
        "genres": [], "tmdb_url": None,
    })
    out = dict(meta)
    if score is not None:
        out["score"] = round(float(score), 4)
    return out


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "n_users": int(STATE["ratings"][config.USER_COL].nunique()),
        "n_items": len(STATE["item_meta"]),
        "n_ratings": int(len(STATE["ratings"])),
        "models": list(STATE["models"].keys()),
    }


@app.get("/api/models")
def models():
    return [{"id": m.name, "label": m.label, "description": m.description}
            for m in STATE["models"].values()]


@app.get("/api/users")
def users(limit: int = 30):
    """Most active users first — handy defaults for the demo selector."""
    uc = STATE["user_counts"].head(limit)
    return [{"user_id": int(u), "n_ratings": int(c)} for u, c in uc.items()]


@app.get("/api/movies")
def movies(search: str = "", limit: int = 20):
    s = search.lower().strip()
    out = []
    for meta in STATE["item_meta"].values():
        if not s or s in meta["title"].lower():
            out.append(meta)
            if len(out) >= limit:
                break
    return out


@app.get("/api/recommend")
def recommend(user_id: int, model: str = "most_popular", n: int = 10):
    m = STATE["models"].get(model)
    if m is None:
        return {"error": f"unknown model '{model}'",
                "available": list(STATE["models"].keys())}
    recs = m.recommend(user_id, n=n, exclude_seen=True)
    return {"user_id": user_id, "model": model,
            "items": [_enrich(i, s) for i, s in recs]}


@app.get("/api/similar")
def similar(movie_id: int, n: int = 10):
    """Content-based 'more like this' (falls back to genre overlap)."""
    cb = STATE["models"].get("content_based")
    if cb is not None:
        recs = cb.similar_items(movie_id, n=n)
        if recs:
            return {"movie_id": movie_id, "items": [_enrich(i, s) for i, s in recs]}
    base = STATE["item_meta"].get(movie_id)
    if not base:
        return {"movie_id": movie_id, "items": []}
    bg = set(base["genres"])
    scored = []
    for meta in STATE["item_meta"].values():
        if meta["movie_id"] == movie_id:
            continue
        g = set(meta["genres"])
        union = bg | g
        if not union:
            continue
        j = len(bg & g) / len(union)
        if j > 0:
            scored.append((j, meta))
    scored.sort(key=lambda x: -x[0])
    return {"movie_id": movie_id,
            "items": [{**m, "score": round(j, 4)} for j, m in scored[:n]]}


@app.get("/api/metrics")
def metrics():
    path = config.RESULTS_DIR / "metrics.csv"
    if not path.exists():
        return []
    return pd.read_csv(path).to_dict(orient="records")
