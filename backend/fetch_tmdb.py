"""One-time TMDB catalog fetch -> data/processed/tmdb_cache.json. Resumable.

Run from backend/:  py fetch_tmdb.py
"""

from src.data_loading import load_links
from src.tmdb import build_cache_concurrent


if __name__ == "__main__":
    links = load_links()
    print(f"fetching TMDB metadata for {links['tmdbId'].notna().sum()} movies ...")
    build_cache_concurrent(links, workers=10)
