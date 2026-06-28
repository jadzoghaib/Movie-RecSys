"""Insider 'studio-strategy' + journey heuristic features (E6-7) from TMDB metadata.

These translate domain intuition (commercial positioning, prestige, accessibility,
tone, IP strength) into numeric features. They are HEURISTICS — hypotheses to test;
LightGBM feature-importance tells us which earn predictive weight. They also power
the explanation chips and the multi-step "Tonight's Arc" journeys.

Built from the extended TMDB cache (budget/revenue/runtime/language/votes/franchise)
plus the movie's genres.
"""

import numpy as np

_KEYS = [
    # studio-strategy
    "commercial_scale", "prestige", "crowdpleaser", "watchability", "franchise_ip",
    # journey / tone
    "comfort", "effort", "spectacle", "tone_darkness", "tone_warmth", "originality",
]

_WARM_GENRES = {"Comedy", "Animation", "Children", "Romance", "Musical"}
_DARK_GENRES = {"Horror", "Thriller", "Crime", "War", "Drama", "Mystery", "Film-Noir"}
_SPECTACLE_GENRES = {"Action", "Adventure", "Sci-Fi", "Fantasy", "IMAX"}


def _log1p(x):
    return float(np.log1p(max(0.0, float(x or 0))))


def _share(genres, ref):
    return len(genres & ref) / len(genres) if genres else 0.0


def insider_features(meta, genres=None):
    """meta = a TMDB cache entry (dict); genres = set of genre strings."""
    if not meta or "runtime" not in meta:
        return {k: 0.0 for k in _KEYS}

    g = set(genres) if genres else set()
    budget = meta.get("budget", 0) or 0
    revenue = meta.get("revenue", 0) or 0
    runtime = meta.get("runtime", 0) or 0
    va = meta.get("vote_average", 0.0) or 0.0
    vc = meta.get("vote_count", 0) or 0
    lang = meta.get("original_language", "en")
    collection = 1.0 if meta.get("collection") else 0.0
    ncomp = meta.get("n_companies", 0) or 0

    foreign = 1.0 if lang and lang != "en" else 0.0
    long_runtime = min(max(0.0, runtime - 100) / 120.0, 1.0) if runtime else 0.0
    short_runtime = max(0.0, 1.0 - max(0, runtime - 95) / 120.0) if runtime else 0.5

    commercial_scale = (_log1p(budget) + _log1p(revenue)) / 40.0 + min(ncomp, 5) / 10.0
    prestige = ((va / 10.0) * 0.6 + min(runtime, 200) / 200.0 * 0.25
                + 0.15 * foreign - 0.1 * collection)
    crowdpleaser = _log1p(vc) / 12.0 + (1.0 - abs(runtime - 110) / 200.0) * 0.3
    watchability = short_runtime * 0.6 + min(_log1p(vc) / 12.0, 0.4)
    franchise_ip = 0.7 * collection + min(ncomp, 5) / 10.0

    tone_warmth = _share(g, _WARM_GENRES)
    tone_darkness = _share(g, _DARK_GENRES)
    spectacle = 0.5 * min(len(g & _SPECTACLE_GENRES), 2) / 2.0 + 0.5 * min(_log1p(budget) / 20.0, 1.0)
    comfort = 0.4 * (1.0 if g & _WARM_GENRES else 0.0) + 0.3 * short_runtime + 0.3 * min(crowdpleaser, 1.0)
    effort = 0.4 * long_runtime + 0.3 * tone_darkness + 0.3 * foreign
    originality = 0.5 * (1.0 - collection) + 0.25 * (1.0 if ncomp <= 2 else 0.0) + 0.25 * foreign

    out = {
        "commercial_scale": commercial_scale, "prestige": max(0.0, prestige),
        "crowdpleaser": crowdpleaser, "watchability": watchability, "franchise_ip": franchise_ip,
        "comfort": comfort, "effort": effort, "spectacle": spectacle,
        "tone_darkness": tone_darkness, "tone_warmth": tone_warmth, "originality": originality,
    }
    return {k: round(float(v), 4) for k, v in out.items()}
