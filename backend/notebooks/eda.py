"""Sprint 1 — Exploratory Data Analysis.

Generates the figures and statistics that justify our modeling choices.
Run from the backend/ directory:  py notebooks/eda.py
Figures are written to results/figures/.
"""

import sys
from pathlib import Path

import matplotlib
matplotlib.use("Agg")  # headless
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))  # make src importable

from src import config
from src.data_loading import load_ratings, load_items, describe_dataset

FIGDIR = config.RESULTS_DIR / "figures"
FIGDIR.mkdir(parents=True, exist_ok=True)

plt.rcParams.update({
    "figure.dpi": 110, "savefig.bbox": "tight",
    "axes.grid": True, "grid.alpha": 0.3, "axes.axisbelow": True,
})
ACCENT = "#6366f1"


def save(fig, name):
    fig.savefig(FIGDIR / name)
    plt.close(fig)
    print(f"  saved figures/{name}")


def main():
    ratings = load_ratings()
    movies = load_items()
    describe_dataset(ratings, movies, verbose=True)

    item_counts = ratings[config.ITEM_COL].value_counts()       # desc
    user_counts = ratings[config.USER_COL].value_counts()
    sorted_counts = item_counts.values
    n_items = len(sorted_counts)
    cum = np.cumsum(sorted_counts) / sorted_counts.sum()

    def top_share(frac):
        return cum[max(1, int(frac * n_items)) - 1]

    top10, top20 = top_share(0.10), top_share(0.20)
    cold5 = float((item_counts < 5).mean())
    cold1 = float((item_counts <= 1).mean())

    print("\n--- EDA KEY STATS (for findings writeup) ---")
    print(f"median ratings/user : {int(user_counts.median())}")
    print(f"median ratings/item : {int(item_counts.median())}")
    print(f"top 10% of movies   : {top10:.1%} of all ratings")
    print(f"top 20% of movies   : {top20:.1%} of all ratings")
    print(f"movies with <5 ratings : {cold5:.1%}")
    print(f"movies with <=1 rating : {cold1:.1%}")
    print(f"share of ratings >= 4.0 : {(ratings[config.RATING_COL] >= 4.0).mean():.1%}")

    # 1 — rating distribution
    rd = ratings[config.RATING_COL].value_counts().sort_index()
    fig, ax = plt.subplots(figsize=(7, 4))
    ax.bar(rd.index.astype(str), rd.values, color=ACCENT)
    ax.set_title("Rating distribution (left-skewed toward high ratings)")
    ax.set_xlabel("rating"); ax.set_ylabel("# ratings")
    save(fig, "01_rating_distribution.png")

    # 2 — long tail
    fig, ax = plt.subplots(figsize=(7, 4))
    ax.plot(np.arange(1, n_items + 1), sorted_counts, color=ACCENT)
    ax.set_yscale("log")
    ax.axvline(0.2 * n_items, color="crimson", ls="--", lw=1)
    ax.text(0.2 * n_items, sorted_counts.max(),
            f"  top 20% of movies = {top20:.0%} of ratings",
            color="crimson", va="top", fontsize=9)
    ax.set_title("The long tail of movie popularity")
    ax.set_xlabel("movie rank (by # ratings)"); ax.set_ylabel("# ratings (log scale)")
    save(fig, "02_long_tail.png")

    # 3 — ratings per user
    fig, ax = plt.subplots(figsize=(7, 4))
    ax.hist(user_counts.values, bins=50, color=ACCENT)
    ax.axvline(user_counts.median(), color="crimson", ls="--", lw=1,
               label=f"median = {int(user_counts.median())}")
    ax.set_title("Activity per user")
    ax.set_xlabel("# ratings by a user"); ax.set_ylabel("# users"); ax.legend()
    save(fig, "03_ratings_per_user.png")

    # 4 — genre prevalence
    m = movies[movies["genres"] != "(no genres listed)"].copy()
    g = m.assign(genre=m["genres"].str.split("|")).explode("genre")
    fig, ax = plt.subplots(figsize=(7, 4.5))
    g["genre"].value_counts().sort_values().plot(kind="barh", color=ACCENT, ax=ax)
    ax.set_title("Movies per genre"); ax.set_xlabel("# movies")
    save(fig, "04_genre_prevalence.png")

    # 5 — average rating per genre
    rg = ratings.merge(movies[[config.ITEM_COL, "genres"]], on=config.ITEM_COL)
    rg = rg[rg["genres"] != "(no genres listed)"]
    rg = rg.assign(genre=rg["genres"].str.split("|")).explode("genre")
    avg_g = rg.groupby("genre")[config.RATING_COL].mean().sort_values()
    fig, ax = plt.subplots(figsize=(7, 4.5))
    avg_g.plot(kind="barh", color=ACCENT, ax=ax)
    ax.set_title("Average rating per genre"); ax.set_xlabel("mean rating")
    save(fig, "05_avg_rating_per_genre.png")

    # 6 — ratings over time
    yr = pd.to_datetime(ratings[config.TIMESTAMP_COL], unit="s").dt.year
    yc = yr.value_counts().sort_index()
    fig, ax = plt.subplots(figsize=(7, 4))
    ax.bar(yc.index.astype(int).astype(str), yc.values, color=ACCENT)
    ax.set_title("Ratings over time")
    ax.set_xlabel("year"); ax.set_ylabel("# ratings")
    for lbl in ax.get_xticklabels():
        lbl.set_rotation(90)
    save(fig, "06_ratings_over_time.png")

    print(f"\nAll figures written to {FIGDIR}")


if __name__ == "__main__":
    main()
