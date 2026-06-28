"""Data loading, EDA, and train/test splitting for MovieLens."""

import numpy as np
import pandas as pd

from .config import (
    RATINGS_PATH, ITEMS_PATH, LINKS_PATH, TAGS_PATH,
    USER_COL, ITEM_COL, RATING_COL, RANDOM_STATE,
)


def load_ratings(path=RATINGS_PATH):
    """Load user-item ratings. Validates required columns."""
    df = pd.read_csv(path)
    required = {USER_COL, ITEM_COL, RATING_COL}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"ratings file missing columns: {missing}")
    return df


def load_items(path=ITEMS_PATH):
    """Load movie metadata (movieId, title, genres)."""
    df = pd.read_csv(path)
    required = {ITEM_COL, "title", "genres"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"movies file missing columns: {missing}")
    return df


def load_links(path=LINKS_PATH):
    """Load movieId -> imdbId/tmdbId links (for posters). Optional."""
    try:
        return pd.read_csv(path)
    except FileNotFoundError:
        return None


def load_tags(path=TAGS_PATH):
    """Load user tags (userId, movieId, tag) for content features. Optional."""
    try:
        return pd.read_csv(path)
    except FileNotFoundError:
        return None


def describe_dataset(ratings, items=None, top=10, verbose=True):
    """Compute core EDA statistics and return them as a dict."""
    n_users = int(ratings[USER_COL].nunique())
    n_items = int(ratings[ITEM_COL].nunique())
    n_ratings = int(len(ratings))
    n_catalog = int(items[ITEM_COL].nunique()) if items is not None else n_items
    sparsity = 1.0 - n_ratings / (n_users * n_items)

    rating_dist = ratings[RATING_COL].value_counts().sort_index()
    most_active = ratings[USER_COL].value_counts().head(top)
    most_popular = ratings[ITEM_COL].value_counts().head(top)

    stats = {
        "n_users": n_users,
        "n_items_rated": n_items,
        "n_catalog_items": n_catalog,
        "n_ratings": n_ratings,
        "sparsity": sparsity,
        "density": 1.0 - sparsity,
        "avg_ratings_per_user": n_ratings / n_users,
        "avg_ratings_per_item": n_ratings / n_items,
        "mean_rating": float(ratings[RATING_COL].mean()),
        "rating_distribution": rating_dist.to_dict(),
        "most_active_users": most_active.to_dict(),
        "most_popular_items": most_popular.to_dict(),
    }

    if verbose:
        print("=" * 52)
        print("DATASET SUMMARY")
        print("=" * 52)
        print(f"  users                : {n_users:,}")
        print(f"  items (rated)        : {n_items:,}")
        print(f"  items (catalog)      : {n_catalog:,}")
        print(f"  ratings              : {n_ratings:,}")
        print(f"  sparsity             : {sparsity:.4%}")
        print(f"  avg ratings / user   : {stats['avg_ratings_per_user']:.1f}")
        print(f"  avg ratings / item   : {stats['avg_ratings_per_item']:.1f}")
        print(f"  mean rating          : {stats['mean_rating']:.2f}")
        print(f"  rating distribution  : {stats['rating_distribution']}")
        print("=" * 52)

    return stats


def train_test_split_ratings(ratings, test_size=0.2, random_state=RANDOM_STATE):
    """Per-user hold-out split (correct for top-N evaluation).

    For each user a fraction of their ratings is moved to the test set while
    keeping at least one rating in train, so every test user still has history
    to recommend from. Users with a single rating stay entirely in train.
    """
    rng = np.random.RandomState(random_state)
    train_idx, test_idx = [], []
    for _, grp in ratings.groupby(USER_COL):
        idx = grp.index.to_numpy()
        n = len(idx)
        if n < 2:
            train_idx.extend(idx)
            continue
        n_test = min(max(1, int(round(n * test_size))), n - 1)
        chosen = rng.choice(idx, size=n_test, replace=False)
        test_idx.extend(chosen)
        train_idx.extend(np.setdiff1d(idx, chosen, assume_unique=True))

    train = ratings.loc[train_idx].reset_index(drop=True)
    test = ratings.loc[test_idx].reset_index(drop=True)
    return train, test


def get_seen_items(ratings, user_id):
    """Set of item IDs already rated/consumed by one user."""
    return set(ratings.loc[ratings[USER_COL] == user_id, ITEM_COL])
