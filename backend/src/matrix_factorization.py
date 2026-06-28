"""Matrix factorization recommender (Sprint 5).

Truncated SVD on the user-mean-centered user×item matrix (scipy.sparse.linalg.svds),
matching the class approach. Unobserved cells are 0 after centering (= the user's
average), so reconstruction = user_mean + low-rank taste deviation. This generalises
through the 98.3% sparsity (EDA) where neighbourhood CF struggles.

The learned factors double as embeddings: U_ (users×k), Vt_.T (items×k). The predicted
score U_[u] · Vt_[:, i] is exactly the `mf_score` feature + the user/item embeddings the
Learning-to-Rank hybrid (Sprint 6) consumes.
"""

import numpy as np
from scipy.sparse import csr_matrix
from scipy.sparse.linalg import svds

from .base import Recommender
from .config import USER_COL, ITEM_COL, RATING_COL


class MatrixFactorizationRecommender(Recommender):
    name = "matrix_factorization"
    label = "Matrix Factorization"
    description = "Latent-factor model (truncated SVD) that generalises through sparsity to score unseen films."

    def __init__(self, n_factors=50, random_state=42):
        self.n_factors = n_factors
        self.random_state = random_state

    def fit(self, train_df, items_df=None):
        users = np.sort(train_df[USER_COL].unique())
        items = np.sort(train_df[ITEM_COL].unique())
        self.uidx_ = {int(u): i for i, u in enumerate(users)}
        self.iidx_ = {int(m): i for i, m in enumerate(items)}
        self.items_ = items

        user_mean = train_df.groupby(USER_COL)[RATING_COL].mean()
        rows = train_df[USER_COL].map(self.uidx_).to_numpy()
        cols = train_df[ITEM_COL].map(self.iidx_).to_numpy()
        centered = (train_df[RATING_COL].to_numpy(float)
                    - user_mean.loc[train_df[USER_COL]].to_numpy())
        R = csr_matrix((centered, (rows, cols)), shape=(len(users), len(items)))

        k = min(self.n_factors, min(R.shape) - 1)
        U, s, Vt = svds(R, k=k)               # singular values ascending
        order = np.argsort(-s)
        self.U_ = U[:, order] * s[order]      # users × k (sigma folded in)
        self.Vt_ = Vt[order]                  # k × items
        self.user_mean_ = user_mean.loc[users].to_numpy()
        self._build_seen(train_df)
        return self

    def predict_scores(self, user_id):
        u = self.uidx_.get(int(user_id))
        if u is None:
            return None
        return self.U_[u] @ self.Vt_ + self.user_mean_[u]

    def recommend(self, user_id, n=10, exclude_seen=True):
        scores = self.predict_scores(user_id)
        if scores is None:
            return []
        scores = np.asarray(scores, dtype=float)
        if exclude_seen:
            seen = [self.iidx_[int(m)] for m in self._seen_for(user_id) if int(m) in self.iidx_]
            scores[seen] = -np.inf
        order = np.argsort(-scores)[:n]
        return [(int(self.items_[i]), float(scores[i])) for i in order if np.isfinite(scores[i])]
