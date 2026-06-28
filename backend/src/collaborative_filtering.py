"""Collaborative filtering recommenders (Sprint 3).

Item-item (primary) + user-user (comparison), both using adjusted / Pearson
cosine on **user-mean-centered** ratings with **top-k** neighbourhoods.

Design note — ranking vs rating prediction:
For top-N ranking we score a candidate by the *accumulated* weighted sum of the
user's centered ratings over the neighbourhood (evidence accumulation), NOT the
normalised rating-prediction formula  Σ sim·r / Σ|sim|. The normalised form has
a well-known degeneracy on sparse data — a cold item with a single similar rated
neighbour inherits that neighbour's rating and floods the top of the list (this
is what made a previous item-item build score ~0). Accumulation rewards items
that are similar to *many* highly-rated items and naturally demotes the cold tail.
`predict_score` keeps the normalised formula for rating-prediction use.
"""

import numpy as np
from scipy.sparse import csr_matrix
from sklearn.metrics.pairwise import cosine_similarity

from .base import Recommender
from .config import USER_COL, ITEM_COL, RATING_COL


def _build_centered_matrix(train, items_subset=None):
    """Sparse users×items matrix of user-mean-centered ratings (+ index maps)."""
    users = np.sort(train[USER_COL].unique())
    uidx = {u: i for i, u in enumerate(users)}
    if items_subset is not None:
        items = np.sort(np.asarray(list(items_subset)))
        sub = train[train[ITEM_COL].isin(set(items.tolist()))]
    else:
        items = np.sort(train[ITEM_COL].unique())
        sub = train
    iidx = {m: i for i, m in enumerate(items)}
    user_mean = train.groupby(USER_COL)[RATING_COL].mean()
    rows = sub[USER_COL].map(uidx).to_numpy()
    cols = sub[ITEM_COL].map(iidx).to_numpy()
    centered = sub[RATING_COL].to_numpy(dtype=float) - user_mean.loc[sub[USER_COL]].to_numpy()
    R = csr_matrix((centered, (rows, cols)), shape=(len(users), len(items)))
    return R, users, items, uidx, iidx, user_mean


def _top_k_sparse(sim, k):
    """Keep the top-k positive entries per row of a dense similarity matrix → CSR."""
    n = sim.shape[0]
    np.fill_diagonal(sim, 0.0)
    k = min(k, n - 1)
    idx = np.argpartition(-sim, kth=k, axis=1)[:, :k]
    rows = np.repeat(np.arange(n), k)
    cols = idx.ravel()
    vals = sim[rows, cols]
    pos = vals > 0
    return csr_matrix((vals[pos], (rows[pos], cols[pos])), shape=(n, n))


class ItemItemCollaborativeFiltering(Recommender):
    name = "item_item_cf"
    label = "Item-Item CF"
    description = "Recommends movies similar to ones you rated, from co-rating patterns across users (adjusted cosine)."

    def __init__(self, k=40, min_support=5, similarity="cosine"):
        self.k = k
        self.min_support = min_support      # ignore cold items (<min_support ratings)
        self.similarity = similarity

    def fit(self, train_df, items_df=None):
        counts = train_df[ITEM_COL].value_counts()
        kept = counts[counts >= self.min_support].index
        R, users, items, uidx, iidx, user_mean = _build_centered_matrix(train_df, kept)
        sim = cosine_similarity(R.T, dense_output=True)     # items × items
        self.S_ = _top_k_sparse(sim, self.k)
        del sim
        self.R_, self.items_, self.uidx_, self.user_mean_ = R, items, uidx, user_mean
        self._build_seen(train_df)
        return self

    def recommend(self, user_id, n=10, exclude_seen=True):
        u = self.uidx_.get(user_id)
        if u is None:
            return []
        user_vec = self.R_[u]                               # 1 × items (centered)
        scores = (self.S_ @ user_vec.T).toarray().ravel()   # accumulate over neighbours
        if exclude_seen:
            scores[user_vec.indices] = -np.inf
        order = np.argsort(-scores)[:n]
        return [(int(self.items_[i]), float(scores[i]))
                for i in order if np.isfinite(scores[i]) and scores[i] > 0]


class UserUserCollaborativeFiltering(Recommender):
    name = "user_user_cf"
    label = "User-User CF"
    description = "Recommends movies liked by the users whose taste is most similar to yours (Pearson / centred cosine)."

    def __init__(self, k=40, similarity="cosine"):
        self.k = k
        self.similarity = similarity

    def fit(self, train_df, items_df=None):
        R, users, items, uidx, iidx, user_mean = _build_centered_matrix(train_df)
        sim = cosine_similarity(R, dense_output=True)       # users × users
        self.W_ = _top_k_sparse(sim, self.k)
        del sim
        self.R_, self.items_, self.uidx_, self.user_mean_ = R, items, uidx, user_mean
        self._build_seen(train_df)
        return self

    def recommend(self, user_id, n=10, exclude_seen=True):
        u = self.uidx_.get(user_id)
        if u is None:
            return []
        w = self.W_[u]                                      # 1 × users (neighbour weights)
        scores = (w @ self.R_).toarray().ravel()            # weighted sum of neighbours' centered ratings
        if exclude_seen:
            scores[self.R_[u].indices] = -np.inf
        order = np.argsort(-scores)[:n]
        return [(int(self.items_[i]), float(scores[i]))
                for i in order if np.isfinite(scores[i]) and scores[i] > 0]
