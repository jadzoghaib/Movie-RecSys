"""Explanation chips — small, grounded labels per movie ("why this?").

Derived entirely from features we already compute (insider scores + popularity +
TMDB vote signals), NOT from an LLM. Thresholds are data-driven (per-dimension
quantiles across the catalog) so the chips stay meaningful as the data changes.
"""

from collections import Counter

import numpy as np
import pandas as pd

from .config import USER_COL, ITEM_COL, RATING_COL
from .insider import insider_features

_THR_DIMS = ["prestige", "comfort", "spectacle"]


def _thresholds(insider_by, q=0.80):
    thr = {}
    for d in _THR_DIMS:
        vals = [v.get(d, 0.0) for v in insider_by.values()]
        thr[d] = float(np.quantile(vals, q)) if vals else 1.0
    return thr


def _chips(ins, vote_avg, n_ratings, pop_pct, collection, thr):
    chips = []
    if pop_pct <= 0.15 and n_ratings >= 2:
        chips.append("Hidden Gem")
    if vote_avg >= 7.8 and n_ratings >= 10:
        chips.append("Acclaimed")
    if ins.get("prestige", 0) >= thr["prestige"]:
        chips.append("Prestige")
    if ins.get("spectacle", 0) >= thr["spectacle"]:
        chips.append("Spectacle")
    if ins.get("comfort", 0) >= thr["comfort"]:
        chips.append("Comfort Watch")
    if collection and len(chips) < 2:
        chips.append("Franchise")
    seen, out = set(), []
    for c in chips:
        if c not in seen:
            seen.add(c)
            out.append(c)
    return out[:2]


def movie_chip_map(item_meta, tmdb_cache, counts):
    """Return {movie_id: [chips]}. counts = pandas Series movieId -> #ratings."""
    counts = counts if isinstance(counts, pd.Series) else pd.Series(counts)
    pct = counts.rank(pct=True).to_dict()
    insider_by = {
        mid: (insider_features(tmdb_cache.get(str(mid)), set(meta.get("genres", [])))
              if tmdb_cache.get(str(mid)) else {})
        for mid, meta in item_meta.items()
    }
    thr = _thresholds(insider_by)
    out = {}
    for mid, meta in item_meta.items():
        c = tmdb_cache.get(str(mid)) or {}
        out[mid] = _chips(insider_by[mid], c.get("vote_average", 0.0),
                          int(counts.get(mid, 0)), float(pct.get(mid, 0.5)),
                          bool(c.get("collection", False)), thr)
    return out


def user_taste(user_id, train, item_meta, tmdb_cache):
    """A user's taste profile (top genres / keywords / cast) from films rated >= 4."""
    rows = train[(train[USER_COL] == int(user_id)) & (train[RATING_COL] >= 4)]
    genres, kws, cast = Counter(), Counter(), Counter()
    for mid in rows[ITEM_COL]:
        meta = item_meta.get(int(mid))
        if meta:
            genres.update(meta.get("genres", []))
        c = tmdb_cache.get(str(int(mid)))
        if c and "error" not in c:
            kws.update(c.get("keywords", []))
            cast.update(c.get("cast", []))
    return {
        "genres": [g for g, _ in genres.most_common(3)],
        "keywords": {k for k, _ in kws.most_common(50)},
        "cast": {c for c, _ in cast.most_common(30)},
    }


def why_recommended(meta, cache_entry, taste):
    """A short, grounded 'why this' sentence tied to the user's actual taste."""
    cache_entry = cache_entry or {}
    parts = []
    shared_g = [g for g in meta.get("genres", []) if g in taste["genres"]]
    if shared_g:
        parts.append(f"matches your taste for {' & '.join(shared_g[:2])}")
    shared_cast = [a for a in cache_entry.get("cast", []) if a in taste["cast"]]
    shared_kw = [k for k in cache_entry.get("keywords", []) if k in taste["keywords"]]
    if shared_cast:
        parts.append(f"features {shared_cast[0]}, who you've enjoyed")
    elif shared_kw:
        parts.append(f"shares {', '.join(shared_kw[:2])} with films you rated highly")
    if parts:
        return "Because it " + " and ".join(parts) + "."
    chips = meta.get("chips", [])
    if "Hidden Gem" in chips:
        return "A hidden-gem discovery beyond your usual watches."
    if "Prestige" in chips:
        return "A prestige pick with strong critical signals."
    if "Acclaimed" in chips:
        return "Broadly acclaimed and widely loved."
    return "A popular pick worth exploring."
