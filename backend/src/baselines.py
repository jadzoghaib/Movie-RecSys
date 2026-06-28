"""Non-personalised baseline recommenders.

Sprint 0 ships Most Popular + Highest Average Rating so the end-to-end
pipeline has real (non-dummy) recommendations. These are refined and joined
by the Random baseline + Bayesian correction in Sprint 2.
"""

import numpy as np

from .base import Recommender
from .config import ITEM_COL, RATING_COL, RANDOM_STATE


class MostPopularRecommender(Recommender):
    """Recommend the most frequently rated movies (cold-start friendly)."""

    name = "most_popular"
    label = "Most Popular"
    description = "Most frequently rated movies. Strong cold-start baseline; ignores personal taste."

    def fit(self, train_df, items_df=None):
        self.counts_ = train_df[ITEM_COL].value_counts()  # movieId -> count, desc
        self._build_seen(train_df)
        return self

    def recommend(self, user_id, n=10, exclude_seen=True):
        seen = self._seen_for(user_id) if exclude_seen else set()
        out = []
        for item, count in self.counts_.items():
            if item in seen:
                continue
            out.append((int(item), float(count)))
            if len(out) >= n:
                break
        return out


class HighestAverageRatingRecommender(Recommender):
    """Highest mean rating with a minimum number of ratings (bias-guarded)."""

    name = "highest_avg"
    label = "Highest Rated"
    description = "Highest average rating with a minimum vote count, so a 5.0-from-2-users can't beat a 4.5-from-thousands."

    def __init__(self, min_ratings=20):
        self.min_ratings = min_ratings

    def fit(self, train_df, items_df=None):
        agg = train_df.groupby(ITEM_COL)[RATING_COL].agg(["mean", "count"])
        agg = agg[agg["count"] >= self.min_ratings].sort_values("mean", ascending=False)
        self.ranking_ = agg
        self._build_seen(train_df)
        return self

    def recommend(self, user_id, n=10, exclude_seen=True):
        seen = self._seen_for(user_id) if exclude_seen else set()
        out = []
        for item, row in self.ranking_.iterrows():
            if item in seen:
                continue
            out.append((int(item), float(row["mean"])))
            if len(out) >= n:
                break
        return out


class BayesianAverageRatingRecommender(Recommender):
    """Average rating shrunk toward the global mean by vote count (IMDB-style).

    Motivated by the EDA long-tail finding (62.5% of movies have <5 ratings):
    a hard min-ratings cutoff throws those films away; Bayesian shrinkage keeps
    them but pulls a 5.0-from-2-voters down toward the 3.5 global mean.
        score(i) = (n_i * mean_i + C * global_mean) / (n_i + C)
    where C ("prior strength", in virtual votes) defaults to the mean votes/item.
    """

    name = "bayesian_avg"
    label = "Bayesian Rating"
    description = ("Average rating shrunk toward the global mean by vote count "
                   "(IMDB weighted rating) so sparsely-rated films can't fluke to the top.")

    def __init__(self, prior_strength=None):
        self.prior_strength = prior_strength

    def fit(self, train_df, items_df=None):
        agg = train_df.groupby(ITEM_COL)[RATING_COL].agg(["mean", "count"])
        global_mean = float(train_df[RATING_COL].mean())
        C = self.prior_strength if self.prior_strength is not None else float(agg["count"].mean())
        agg["score"] = (agg["count"] * agg["mean"] + C * global_mean) / (agg["count"] + C)
        self.ranking_ = agg.sort_values("score", ascending=False)
        self.global_mean_ = global_mean
        self.prior_strength_ = C
        self._build_seen(train_df)
        return self

    def recommend(self, user_id, n=10, exclude_seen=True):
        seen = self._seen_for(user_id) if exclude_seen else set()
        out = []
        for item, row in self.ranking_.iterrows():
            if item in seen:
                continue
            out.append((int(item), float(row["score"])))
            if len(out) >= n:
                break
        return out


class RandomRecommender(Recommender):
    """Random unseen movies — the sanity-check lower bound every method must beat."""

    name = "random"
    label = "Random"
    description = "Random unseen movies. The lower-bound baseline every real recommender must beat."

    def __init__(self, random_state=RANDOM_STATE):
        self.random_state = random_state

    def fit(self, train_df, items_df=None):
        self.items_ = train_df[ITEM_COL].unique()
        self._build_seen(train_df)
        return self

    def recommend(self, user_id, n=10, exclude_seen=True):
        rng = np.random.RandomState(self.random_state + int(user_id))  # reproducible per user
        seen = self._seen_for(user_id) if exclude_seen else set()
        out = []
        for item in rng.permutation(self.items_):
            item = int(item)
            if item in seen:
                continue
            out.append((item, round(1.0 - len(out) / max(n, 1), 3)))  # descending display score
            if len(out) >= n:
                break
        return out
