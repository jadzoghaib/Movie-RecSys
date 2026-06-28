"""Insider 'studio-strategy' heuristic features (E6-7) from TMDB metadata.

These translate domain intuition (commercial positioning, prestige, accessibility,
IP strength) into numeric features for the ranker. They are HEURISTICS — hypotheses
to test, not ground truth. The LightGBM feature-importance tells us whether they
earn predictive weight. Built from the extended TMDB cache
(budget/revenue/runtime/language/votes/franchise).
"""

import numpy as np

_KEYS = ["commercial_scale", "prestige", "crowdpleaser", "watchability", "franchise_ip"]


def _log1p(x):
    return float(np.log1p(max(0.0, float(x or 0))))


def insider_features(meta):
    """meta = a TMDB cache entry (dict). Returns the 5 insider scores."""
    if not meta or "runtime" not in meta:
        return {k: 0.0 for k in _KEYS}

    budget = meta.get("budget", 0) or 0
    revenue = meta.get("revenue", 0) or 0
    runtime = meta.get("runtime", 0) or 0
    va = meta.get("vote_average", 0.0) or 0.0
    vc = meta.get("vote_count", 0) or 0
    lang = meta.get("original_language", "en")
    collection = 1.0 if meta.get("collection") else 0.0
    ncomp = meta.get("n_companies", 0) or 0

    commercial_scale = (_log1p(budget) + _log1p(revenue)) / 40.0 + min(ncomp, 5) / 10.0
    prestige = ((va / 10.0) * 0.6 + min(runtime, 200) / 200.0 * 0.25
                + (0.15 if lang != "en" else 0.0) - 0.1 * collection)
    crowdpleaser = _log1p(vc) / 12.0 + (1.0 - abs(runtime - 110) / 200.0) * 0.3
    watchability = (max(0.0, 1.0 - max(0, runtime - 100) / 120.0) * 0.6
                    + min(_log1p(vc) / 12.0, 0.4))
    franchise_ip = 0.7 * collection + min(ncomp, 5) / 10.0

    return {
        "commercial_scale": round(commercial_scale, 4),
        "prestige": round(max(0.0, prestige), 4),
        "crowdpleaser": round(crowdpleaser, 4),
        "watchability": round(watchability, 4),
        "franchise_ip": round(franchise_ip, 4),
    }
