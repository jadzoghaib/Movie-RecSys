"""Configuration: paths, column names, and project constants."""

from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]   # -> backend/
DATA_DIR = PROJECT_ROOT / "data"
RAW_DATA_DIR = DATA_DIR / "raw"
PROCESSED_DATA_DIR = DATA_DIR / "processed"
RESULTS_DIR = PROJECT_ROOT / "results"

# MovieLens Latest Small files.
RATINGS_PATH = RAW_DATA_DIR / "ratings.csv"
ITEMS_PATH = RAW_DATA_DIR / "movies.csv"
LINKS_PATH = RAW_DATA_DIR / "links.csv"
TAGS_PATH = RAW_DATA_DIR / "tags.csv"

# Column names.
USER_COL = "userId"
ITEM_COL = "movieId"
RATING_COL = "rating"
TIMESTAMP_COL = "timestamp"
TITLE_COL = "title"
GENRES_COL = "genres"

# Defaults.
TOP_K = 10
RANDOM_STATE = 42
# A held-out item counts as "relevant" (the user liked it) if rated >= this.
RELEVANCE_THRESHOLD = 3.5
