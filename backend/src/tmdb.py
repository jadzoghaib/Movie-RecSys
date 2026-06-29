"""TMDB metadata enrichment (E4-2).

Fetches poster + overview + keywords + cast per movie (joined via links.csv
tmdbId) and caches to data/processed/tmdb_cache.json, so the app runs offline
after a one-time fetch. The API key is read from backend/.env (gitignored).
"""

import json
import os
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

from . import config

CACHE_PATH = config.PROCESSED_DATA_DIR / "tmdb_cache.json"
IMAGE_BASE = "https://image.tmdb.org/t/p/w342"


def load_env(path=config.PROJECT_ROOT / ".env"):
    """Minimal .env loader (no extra dependency)."""
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())


def api_key():
    load_env()
    return os.environ.get("TMDB_API_KEY")


def poster_url(poster_path):
    return f"{IMAGE_BASE}{poster_path}" if poster_path else None


def _load_cache():
    if CACHE_PATH.exists():
        return json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    return {}


def _save_cache(cache):
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(json.dumps(cache), encoding="utf-8")


def fetch_one(tmdb_id, key, retries=2):
    url = (f"https://api.themoviedb.org/3/movie/{int(tmdb_id)}"
           f"?api_key={key}&append_to_response=keywords,credits,videos")
    for attempt in range(retries + 1):
        try:
            with urllib.request.urlopen(url, timeout=15) as r:
                d = json.load(r)
            return {
                "tmdb_id": int(tmdb_id),
                "poster_url": poster_url(d.get("poster_path")),
                "overview": d.get("overview") or "",
                "keywords": [k["name"] for k in d.get("keywords", {}).get("keywords", [])],
                "cast": [c["name"] for c in d.get("credits", {}).get("cast", [])[:8]],
                # extended fields for the insider studio-strategy features
                "runtime": d.get("runtime") or 0,
                "original_language": d.get("original_language") or "",
                "vote_average": d.get("vote_average") or 0.0,
                "vote_count": d.get("vote_count") or 0,
                "budget": d.get("budget") or 0,
                "revenue": d.get("revenue") or 0,
                "release_year": int(d["release_date"][:4]) if d.get("release_date") else None,
                "collection": bool(d.get("belongs_to_collection")),
                "n_companies": len(d.get("production_companies", [])),
                # for movie-detail + person pages
                "director": next((c["name"] for c in d.get("credits", {}).get("crew", [])
                                  if c.get("job") == "Director"), None),
                "backdrop_url": (f"https://image.tmdb.org/t/p/w1280{d['backdrop_path']}"
                                 if d.get("backdrop_path") else None),
                "trailer_key": next((v["key"] for v in d.get("videos", {}).get("results", [])
                                     if v.get("site") == "YouTube" and v.get("type") == "Trailer"),
                                    next((v["key"] for v in d.get("videos", {}).get("results", [])
                                          if v.get("site") == "YouTube"), None)),
            }
        except Exception:
            if attempt == retries:
                raise
            time.sleep(0.5 * (attempt + 1))   # backoff on transient errors / 429


def load_cache():
    """Public read-only accessor (movieId str -> metadata dict)."""
    return _load_cache()


def build_cache(links_df, item_col=config.ITEM_COL, max_movies=None, sleep=0.0):
    """Fetch + cache metadata for every movie with a tmdbId. Resumable."""
    key = api_key()
    if not key:
        raise RuntimeError("No TMDB_API_KEY found (expected in backend/.env)")
    cache = _load_cache()
    rows = links_df.dropna(subset=["tmdbId"])
    fetched = 0
    for mid, tmdb in zip(rows[item_col], rows["tmdbId"]):
        key_id = str(int(mid))
        if key_id in cache and "error" not in cache[key_id]:
            continue
        try:
            cache[key_id] = fetch_one(int(tmdb), key)
            fetched += 1
        except Exception as e:  # noqa: BLE001 - record + continue
            cache[key_id] = {"error": str(e)[:100], "tmdb_id": int(tmdb)}
        if fetched and fetched % 200 == 0:
            _save_cache(cache)
            print(f"  fetched {fetched} (cache size {len(cache)})", flush=True)
        if sleep:
            time.sleep(sleep)
        if max_movies and fetched >= max_movies:
            break
    _save_cache(cache)
    ok = sum(1 for v in cache.values() if "error" not in v)
    print(f"done: {fetched} newly fetched; {ok}/{len(cache)} usable in cache", flush=True)
    return cache


def build_cache_concurrent(links_df, item_col=config.ITEM_COL, workers=10):
    """Parallel fetch (ThreadPool) — much faster. Resumable via the cache."""
    key = api_key()
    if not key:
        raise RuntimeError("No TMDB_API_KEY found (expected in backend/.env)")
    cache = _load_cache()
    rows = links_df.dropna(subset=["tmdbId"])
    todo = [(str(int(m)), int(t)) for m, t in zip(rows[item_col], rows["tmdbId"])
            if str(int(m)) not in cache or "error" in cache.get(str(int(m)), {})
            or "director" not in cache.get(str(int(m)), {})]   # re-fetch to add new fields
    print(f"{len(todo)} movies to fetch with {workers} workers", flush=True)
    done = 0
    with ThreadPoolExecutor(max_workers=workers) as ex:
        futs = {ex.submit(fetch_one, t, key): m for m, t in todo}
        for fut in as_completed(futs):
            mid = futs[fut]
            try:
                cache[mid] = fut.result()
            except Exception as e:  # noqa: BLE001
                cache[mid] = {"error": str(e)[:100]}
            done += 1
            if done % 500 == 0:
                _save_cache(cache)
                print(f"  {done}/{len(todo)}", flush=True)
    _save_cache(cache)
    ok = sum(1 for v in cache.values() if "error" not in v)
    print(f"done: {ok}/{len(cache)} usable in cache", flush=True)
    return cache
