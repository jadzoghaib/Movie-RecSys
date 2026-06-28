"""Explanation chips — small, grounded labels per movie ("why this?").

Derived entirely from features we already compute (insider scores + popularity +
TMDB vote signals), NOT from an LLM. Thresholds are data-driven (per-dimension
quantiles across the catalog) so the chips stay meaningful as the data changes.
"""

import numpy as np
import pandas as pd

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
