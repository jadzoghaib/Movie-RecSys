"""FastAPI application: serves the recommenders as a JSON REST API.

Run from backend/:  py -m uvicorn api.main:app --reload --port 8000
"""

from contextlib import asynccontextmanager

import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from src import config
from src.data_loading import (
    load_ratings, load_items, load_links, train_test_split_ratings,
)
from src.tmdb import load_cache
from src.reranking import ReRankedRecommender
from src.explain import movie_chip_map, user_taste, why_recommended
from src.gemini import parse_intent
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

    # grounded explanation chips per movie (Hidden Gem / Prestige / Comfort Watch / …)
    chip_map = movie_chip_map(item_meta, tmdb_cache, train[config.ITEM_COL].value_counts())
    for mid, ch in chip_map.items():
        item_meta[mid]["chips"] = ch

    STATE.update(
        ratings=ratings, train=train, test=test, models=models,
        item_meta=item_meta, tmdb_cache=tmdb_cache,
        user_counts=ratings[config.USER_COL].value_counts(),
        item_pop=train[config.ITEM_COL].value_counts().to_dict(),
        profiles=_compute_profiles(train, item_meta),
    )


@asynccontextmanager
async def lifespan(app):
    build_state()
    yield


app = FastAPI(title="Movie Recommender API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000",
                   "http://localhost:5173", "http://127.0.0.1:5173"],
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


def _enrich_list(recs, genre=None):
    out = []
    for item, score in recs:
        m = _enrich(item, score)
        if genre and genre not in m["genres"]:
            continue
        out.append(m)
    return out


def _compute_profiles(train, item_meta, n=8):
    """A diverse, curated set of sample viewers for the 'Who's watching?' landing —
    the most active user per dominant genre, with their favourite film + top genres."""
    from collections import Counter
    counts = train[config.USER_COL].value_counts()
    liked = train[train[config.RATING_COL] >= 4]
    top_genre, genres_by_user = {}, {}
    for u, grp in liked.groupby(config.USER_COL):
        gc = Counter()
        for mid in grp[config.ITEM_COL]:
            m = item_meta.get(int(mid))
            if m:
                gc.update(m["genres"])
        genres_by_user[u] = [g for g, _ in gc.most_common(3)]
        if gc:
            top_genre[u] = gc.most_common(1)[0][0]
    by_genre = {}
    for u, g in top_genre.items():
        if g not in by_genre or counts[u] > counts[by_genre[g]]:
            by_genre[g] = u
    chosen = sorted(by_genre.values(), key=lambda u: -counts[u])[:n]
    out = []
    for u in chosen:
        urows = train[train[config.USER_COL] == u].sort_values(config.RATING_COL, ascending=False)
        fav = item_meta.get(int(urows.iloc[0][config.ITEM_COL]), {})
        out.append({
            "user_id": int(u), "n_ratings": int(counts[u]),
            "top_genres": genres_by_user.get(u, []),
            "fav_title": fav.get("title"), "fav_poster": fav.get("poster_url"),
        })
    return out


def _user_seed(user_id):
    """The user's highest-rated training movie — seed for 'Because you liked X'."""
    tr = STATE["train"]
    rows = tr[tr[config.USER_COL] == int(user_id)]
    if rows.empty:
        return None
    mid = int(rows.sort_values(config.RATING_COL, ascending=False).iloc[0][config.ITEM_COL])
    return STATE["item_meta"].get(mid)


def _arc_caption(items):
    if len(items) < 2:
        return "Tonight's arc"
    g0 = items[0]["genres"][0] if items[0]["genres"] else "favourite"
    gl = items[-1]["genres"][0] if items[-1]["genres"] else "discovery"
    return (f"Start with a {g0} pick you'll trust, then drift toward a "
            f"lesser-known {gl} discovery.")


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


@app.get("/api/profiles")
def profiles():
    return STATE.get("profiles", [])


@app.get("/api/genres")
def genres():
    s = set()
    for m in STATE["item_meta"].values():
        s.update(m["genres"])
    return sorted(s)


@app.get("/api/home")
def home(user_id: int, explore: float = 0.4, genre: str = ""):
    """One call powers the multi-rail homepage: the story-arc + several rails,
    shaped by the discovery slider (explore) and an optional genre filter."""
    models = STATE["models"]
    g = genre.strip() or None
    rr = models.get("ltr_reranked")
    rails = []

    # Top picks now shift with the discovery slider (explore -> novelty weight)
    top = (rr.rerank(user_id, n=14, beta=0.25 + 0.7 * explore, genre=g) if rr
           else models["user_user_cf"].recommend(user_id, n=14))
    rails.append({"title": "Top picks for you", "subtitle": "Learning-to-Rank hybrid + re-ranking",
                  "items": _enrich_list(top, None if rr else g)})

    seed = _user_seed(user_id)
    if seed and "content_based" in models:
        sim = models["content_based"].similar_items(seed["movie_id"], n=14)
        rails.append({"title": f"Because you liked {seed['title']}", "subtitle": "Content similarity",
                      "items": _enrich_list(sim, g)})

    if rr:
        disc = rr.rerank(user_id, n=14, beta=0.3 + 1.4 * explore, genre=g)
        rails.append({"title": "Discover", "subtitle": "Novelty-boosted re-ranking",
                      "items": _enrich_list(disc, None)})

    pop = models["most_popular"].recommend(user_id, n=14)
    rails.append({"title": "Popular now", "subtitle": "Most popular · non-personalised",
                  "items": _enrich_list(pop, g)})

    arc_ids = rr.build_arc(user_id, n=4, explore=0.6) if rr else []
    arc_items = [_enrich(i) for i in arc_ids]
    notes = ["Trusted opener", "A step outward", "Going deeper", "The discovery"]
    for idx, it in enumerate(arc_items):
        it["arc_note"] = notes[idx] if idx < len(notes) else "Discovery"
    if len(arc_items) >= 2:
        arc_items[-1]["arc_note"] = "The discovery"

    # grounded "why this" explanation per recommendation
    taste = user_taste(user_id, STATE["train"], STATE["item_meta"], STATE["tmdb_cache"])
    cache = STATE["tmdb_cache"]

    def annotate(items):
        for it in items:
            it["why"] = why_recommended(it, cache.get(str(it["movie_id"])), taste)

    for r in rails:
        annotate(r["items"])
    annotate(arc_items)

    return {
        "user_id": user_id,
        "arc": {"caption": _arc_caption(arc_items), "items": arc_items},
        "rails": [r for r in rails if r["items"]],
    }


def _chat_recommend(user_id, intent, n=12):
    """Run our recommender under the Gemini-parsed filters (the LLM never ranks)."""
    models, item_meta, cache = STATE["models"], STATE["item_meta"], STATE["tmdb_cache"]
    item_pop = STATE["item_pop"]
    rr = models.get("ltr_reranked")
    genres = set(intent.get("genres") or [])
    excl = set(intent.get("exclude_genres") or [])
    kws = {k.lower() for k in (intent.get("keywords") or [])}
    explore = float(intent.get("explore") or 0.4)
    era = intent.get("era", "any")

    pool = dict(rr.base.recommend(user_id, n=200)) if rr else {}
    mn = min(pool.values()) if pool else 0.0
    rng = (max(pool.values()) - mn) if pool else 1.0
    rng = rng or 1.0
    seen = models["most_popular"]._seen.get(user_id, set()) if "most_popular" in models else set()

    cand = set(pool)                        # personalised pool (already vetted) bypasses quality floor
    if genres or kws:                       # broaden beyond personal pool for thematic asks
        for mid, meta in item_meta.items():
            mg = set(meta["genres"])
            if genres and not (mg & genres):
                continue
            c = cache.get(str(mid)) or {}
            if (c.get("vote_count", 0) or 0) < 40:        # quality floor for thematic adds (no noise)
                continue
            if kws and not genres and not ({k.lower() for k in c.get("keywords", [])} & kws):
                continue
            cand.add(mid)

    scored = []
    for mid in cand:
        if mid in seen:
            continue
        meta = item_meta.get(mid)
        if not meta:
            continue
        mg = set(meta["genres"])
        if excl and (mg & excl):
            continue
        c = cache.get(str(mid)) or {}
        year = c.get("release_year")
        if era == "recent" and (not year or year < 2010):
            continue
        if era == "classic" and (not year or year >= 1995):
            continue
        kw = {k.lower() for k in c.get("keywords", [])}
        va, vc = c.get("vote_average", 0.0) or 0.0, c.get("vote_count", 0) or 0
        pers = (pool[mid] - mn) / rng if mid in pool else 0.0
        nov = 1.0 / (1.0 + item_pop.get(mid, 0) ** 0.5)
        quality = (va / 10.0) if vc >= 50 else 0.0
        score = (pers + 0.8 * len(kw & kws) + 0.3 * len(mg & genres)
                 + 0.5 * quality + explore * 1.5 * nov)
        scored.append((mid, score))

    scored.sort(key=lambda x: -x[1])
    items = [_enrich(mid, sc) for mid, sc in scored[:n]]
    taste = user_taste(user_id, STATE["train"], item_meta, cache)
    for it in items:
        it["why"] = why_recommended(it, cache.get(str(it["movie_id"])), taste)
    return items


class ChatMessage(BaseModel):
    role: str
    text: str


class ChatRequest(BaseModel):
    user_id: int
    messages: list[ChatMessage]


@app.post("/api/chat")
def chat(req: ChatRequest):
    """Conversational guide: Gemini parses the request (or asks), we recommend."""
    intent = parse_intent([{"role": m.role, "text": m.text} for m in req.messages])
    if not intent:
        return {"action": "error", "reply": "The AI guide is unavailable right now.", "movies": []}
    if intent.get("action") == "ask":
        return {"action": "ask", "reply": intent.get("reply", "What are you in the mood for?"), "movies": []}
    return {
        "action": "recommend",
        "reply": intent.get("reply", "Here are a few picks:"),
        "movies": _chat_recommend(req.user_id, intent),
        "filters": {k: intent.get(k) for k in ("genres", "exclude_genres", "keywords", "explore", "era")},
    }


@app.get("/api/metrics")
def metrics():
    path = config.RESULTS_DIR / "metrics.csv"
    if not path.exists():
        return []
    return pd.read_csv(path).to_dict(orient="records")
