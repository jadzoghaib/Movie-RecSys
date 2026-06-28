"""Content-based recommender (Sprint 4).

Item features = TF-IDF over genres (+ free-text tags from tags.csv). User
profile = Σ_i (r_ui − mean_u) · vec(i) (mean-centered, the class formula).
Recommend unseen items by cosine(profile, item). Also exposes `similar_items`
for the UI's "more like this".

Genres are coarse (EDA findings 5/6), so top-N accuracy is expected to be
modest; the value is **cold-item coverage** (works for movies with no ratings,
which CF cannot reach), the **similar-items** feature, and **explainability**.
TMDB overview/cast/keyword features (E4-2) plug into the `docs` construction
below once a key is available — no other change needed.
"""

import numpy as np
from scipy.sparse import csr_matrix
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import normalize

from .base import Recommender
from .config import USER_COL, ITEM_COL, RATING_COL, GENRES_COL
from .data_loading import load_tags


def _genre_tokens(genres):
    """'Adventure|Sci-Fi' -> 'adventure scifi' (atomic, lowercase tokens)."""
    out = []
    for g in str(genres).split("|"):
        g = g.strip()
        if g and g != "(no genres listed)":
            out.append(g.lower().replace("-", "").replace(" ", ""))
    return " ".join(out)


class ContentBasedRecommender(Recommender):
    name = "content_based"
    label = "Content-Based"
    description = "Recommends movies similar in genre & tags to the ones you rated highly (TF-IDF + cosine)."

    def __init__(self, use_tags=True):
        self.use_tags = use_tags

    def fit(self, train_df, items_df=None):
        if items_df is None:
            raise ValueError("ContentBasedRecommender requires items_df (movies)")

        items = items_df[[ITEM_COL, GENRES_COL]].copy()
        # merge first so genre/tag docs stay row-aligned
        if self.use_tags:
            tags = load_tags()
            if tags is not None:
                tag_text = (tags.groupby(ITEM_COL)["tag"]
                            .apply(lambda s: " ".join(str(t) for t in s))
                            .rename("tagtext"))
                items = items.merge(tag_text, on=ITEM_COL, how="left")
            else:
                items["tagtext"] = ""
        else:
            items["tagtext"] = ""

        genre_docs = items[GENRES_COL].apply(_genre_tokens).to_numpy()
        docs = genre_docs + " " + items["tagtext"].fillna("").to_numpy()

        self.vectorizer_ = TfidfVectorizer(lowercase=True, min_df=1)
        self.item_features_ = self.vectorizer_.fit_transform(docs)   # n_items × V (L2-normalized)
        self.item_ids_ = items[ITEM_COL].to_numpy()
        self.item_id_to_index_ = {int(m): i for i, m in enumerate(self.item_ids_)}

        self._fit_profiles(train_df)
        self._build_seen(train_df)
        return self

    def _fit_profiles(self, train_df):
        users = np.sort(train_df[USER_COL].unique())
        self.uidx_ = {int(u): i for i, u in enumerate(users)}
        user_mean = train_df.groupby(USER_COL)[RATING_COL].mean()

        rows = train_df[USER_COL].map(self.uidx_).to_numpy()
        cols_raw = train_df[ITEM_COL].map(self.item_id_to_index_)
        valid = cols_raw.notna().to_numpy()
        centered = (train_df[RATING_COL].to_numpy(float)
                    - user_mean.loc[train_df[USER_COL]].to_numpy())

        W = csr_matrix(
            (centered[valid], (rows[valid], cols_raw[valid].to_numpy().astype(int))),
            shape=(len(users), self.item_features_.shape[0]),
        )
        self.profiles_ = normalize(W @ self.item_features_)          # users × V, L2 per row

    def recommend(self, user_id, n=10, exclude_seen=True):
        u = self.uidx_.get(int(user_id))
        if u is None:
            return []
        scores = (self.item_features_ @ self.profiles_[u].T).toarray().ravel()
        if exclude_seen:
            seen_idx = [self.item_id_to_index_[int(m)] for m in self._seen_for(user_id)
                        if int(m) in self.item_id_to_index_]
            scores[seen_idx] = -np.inf
        order = np.argsort(-scores)[:n]
        return [(int(self.item_ids_[i]), float(scores[i]))
                for i in order if np.isfinite(scores[i]) and scores[i] > 0]

    def similar_items(self, item_id, n=10):
        """'More like this' — items whose feature vectors are closest."""
        j = self.item_id_to_index_.get(int(item_id))
        if j is None:
            return []
        sims = (self.item_features_ @ self.item_features_[j].T).toarray().ravel()
        sims[j] = -np.inf
        order = np.argsort(-sims)[:n]
        return [(int(self.item_ids_[i]), float(sims[i]))
                for i in order if np.isfinite(sims[i]) and sims[i] > 0]
