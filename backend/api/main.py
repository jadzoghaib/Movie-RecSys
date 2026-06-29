"""FastAPI application: serves the recommenders as a JSON REST API.

Run from backend/:  py -m uvicorn api.main:app --reload --port 8000
"""

from collections import Counter
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

    prof = _compute_profiles(train, item_meta)

    # person -> movies index (top cast + director) for the person pages
    person_movies: dict[str, list[int]] = {}
    for mid_str, c in tmdb_cache.items():
        if not isinstance(c, dict) or "error" in c:
            continue
        mid = int(mid_str)
        names = list(c.get("cast", [])[:6])
        if c.get("director"):
            names.append(c["director"])
        for nm in names:
            person_movies.setdefault(nm, []).append(mid)

    STATE.update(
        ratings=ratings, train=train, test=test, models=models,
        item_meta=item_meta, tmdb_cache=tmdb_cache,
        user_counts=ratings[config.USER_COL].value_counts(),
        item_pop=train[config.ITEM_COL].value_counts().to_dict(),
        profiles=prof["curated"], all_users=prof["all"], person_movies=person_movies,
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
    """Curated viewers for the landing + the full sorted list for the 'All viewers' page."""
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
    fav_by_user = (train.sort_values(config.RATING_COL, ascending=False)
                        .groupby(config.USER_COL)[config.ITEM_COL].first().to_dict())

    def profile(u):
        fav = item_meta.get(int(fav_by_user.get(u, -1)), {})
        return {
            "user_id": int(u), "n_ratings": int(counts[u]),
            "top_genres": genres_by_user.get(u, []),
            "fav_title": fav.get("title"), "fav_poster": fav.get("poster_url"),
        }

    by_genre = {}
    for u, g in top_genre.items():
        if g not in by_genre or counts[u] > counts[by_genre[g]]:
            by_genre[g] = u
    chosen = sorted(by_genre.values(), key=lambda u: -counts[u])[:n]
    return {
        "curated": [profile(u) for u in chosen],
        "all": [profile(u) for u in sorted(counts.index)],   # sorted by viewer id
    }


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


@app.get("/api/all_users")
def all_users():
    return STATE.get("all_users", [])


def _for_you_anchored(user_id, anchor_id, n=14, alpha=0.6):
    """Personalised ranking *conditioned* on the movie being viewed:

        final = alpha * normalised(personal LTR score) + (1-alpha) * content_sim(item, anchor)

    Where 'More like this' (content_based.similar_items) is viewer-agnostic — every
    user sees the same neighbours of the anchor — this blend reweights those neighbours
    (and the viewer's wider personal pool) by who *this* viewer is, so two viewers
    looking at the same movie get different lists."""
    models = STATE["models"]
    cb = models.get("content_based")
    rr = models.get("ltr_reranked")
    if cb is None or not user_id:
        return []
    sims = dict(cb.similar_items(anchor_id, n=400))                         # {mid: cosine}  who the *movie* is
    pool = dict(rr.base.recommend(user_id, n=400)) if rr else {}            # {mid: score}   who the *viewer* is
    seen = models["most_popular"]._seen.get(user_id, set()) if "most_popular" in models else set()
    item_pop = STATE["item_pop"]
    mn = min(pool.values()) if pool else 0.0
    rng = (max(pool.values()) - mn) if pool else 1.0
    rng = rng or 1.0

    scored = []
    for mid in (set(sims) | set(pool)) - {int(anchor_id)}:
        if mid in seen:
            continue
        pers = (pool[mid] - mn) / rng if mid in pool else 0.0
        sim = sims.get(mid, 0.0)
        if pool:
            score = alpha * pers + (1 - alpha) * sim
        else:                                   # cold viewer: no personal signal -> sim + mild popularity
            score = sim + 0.001 * (item_pop.get(mid, 0) ** 0.5)
        scored.append((mid, score))
    scored.sort(key=lambda x: -x[1])
    return _enrich_list([(mid, sc) for mid, sc in scored[:n]])


@app.get("/api/movie/{movie_id}")
def movie_detail(movie_id: int, user_id: int = 0):
    meta = STATE["item_meta"].get(movie_id)
    if not meta:
        return {"error": "not found"}
    c = STATE["tmdb_cache"].get(str(movie_id)) or {}
    cb = STATE["models"].get("content_based")
    similar = _enrich_list(cb.similar_items(movie_id, n=14)) if cb else []
    for_you = _for_you_anchored(user_id, movie_id, n=14) if user_id else []
    if user_id:
        taste = user_taste(user_id, STATE["train"], STATE["item_meta"], STATE["tmdb_cache"])
        for it in (*similar, *for_you):
            it["why"] = why_recommended(it, STATE["tmdb_cache"].get(str(it["movie_id"])), taste)
    return {
        **meta,
        "year": c.get("release_year"), "runtime": c.get("runtime"),
        "vote_average": c.get("vote_average"),
        "cast": c.get("cast", []), "director": c.get("director"),
        "trailer_key": c.get("trailer_key"), "backdrop_url": c.get("backdrop_url"),
        "similar": similar,
        "for_you": for_you,
    }


@app.get("/api/person")
def person(name: str, user_id: int = 0):
    mids = STATE.get("person_movies", {}).get(name, [])
    rr = STATE["models"].get("ltr_reranked")
    pool = dict(rr.base.recommend(user_id, n=300)) if (user_id and rr) else {}
    kw, scored = Counter(), []
    for mid in mids:
        c = STATE["tmdb_cache"].get(str(mid)) or {}
        kw.update(c.get("keywords", []))
        scored.append((mid, pool.get(mid, 0.0) + (c.get("vote_average", 0) or 0) * 0.05))
    scored.sort(key=lambda x: -x[1])
    movies = [_enrich(mid) for mid, _ in scored]
    if user_id and movies:
        taste = user_taste(user_id, STATE["train"], STATE["item_meta"], STATE["tmdb_cache"])
        for it in movies:
            it["why"] = why_recommended(it, STATE["tmdb_cache"].get(str(it["movie_id"])), taste)
    return {"name": name, "n_movies": len(mids),
            "keywords": [k for k, _ in kw.most_common(10)], "movies": movies}


@app.get("/api/genres")
def genres():
    s = set()
    for m in STATE["item_meta"].values():
        s.update(m["genres"])
    return sorted(s)


@app.get("/api/home")
def home(user_id: int, explore: float = 0.4, genre: str = "", anchor: int = 0, model: str = ""):
    """One call powers the multi-rail homepage: the story-arc + several rails,
    shaped by the discovery slider (explore), an optional genre filter, an
    optional `anchor` movie that re-seeds 'Because you liked' + the arc, and an
    optional `model` that pins the Top-picks rail to a specific recommender
    (so the evaluation table can show how each model's metrics translate into
    real recommendations)."""
    models = STATE["models"]
    g = genre.strip() or None
    rr = models.get("ltr_reranked")
    rails = []

    # Top picks: by default the LTR hybrid + re-ranker (slider widens novelty),
    # but the eval table can pin any model here to make its behaviour tangible.
    chosen = models.get(model) if model else None
    if chosen is not None:
        top, top_sub = chosen.recommend(user_id, n=14), chosen.description
    elif rr:
        top, top_sub = rr.rerank(user_id, n=14, beta=0.25 + 0.7 * explore, genre=g), "Learning-to-Rank hybrid + re-ranking"
    else:
        top, top_sub = models["user_user_cf"].recommend(user_id, n=14), "User-user collaborative filtering"
    rails.append({"title": "Top picks for you", "subtitle": top_sub,
                  "active_model": chosen.label if chosen else None,
                  "items": _enrich_list(top, None if (rr and chosen is None) else g)})

    seed = STATE["item_meta"].get(anchor) if anchor else _user_seed(user_id)
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

    arc_ids = rr.build_arc(user_id, n=4, explore=explore, seed=anchor or None) if rr else []
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
