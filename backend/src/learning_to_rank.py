"""Learning-to-Rank hybrid (Sprint 6) — the headline model.

3-stage: candidate generation (existing recommenders) -> LightGBM LambdaRank.
(Diversity/novelty re-ranking is layered on separately.)

LEAKAGE-SAFE BY CONSTRUCTION:
- train is split per-user into GEN (fit candidate generators) and LABEL (ranker labels).
- Generators only ever see GEN, so a generator score is never derived from the same
  rating used as that pair's training label.
- Final evaluation is on the untouched TEST set (disjoint from GEN and LABEL).

Each generator contributes top-K candidates; the ranker learns to combine their
scores/ranks + user/item/match features into one ordering (graded NDCG objective).
"""

import re

import lightgbm as lgb
import numpy as np
import pandas as pd

from .base import Recommender
from .config import USER_COL, ITEM_COL, RATING_COL, RANDOM_STATE
from .baselines import MostPopularRecommender
from .collaborative_filtering import (
    ItemItemCollaborativeFiltering, UserUserCollaborativeFiltering,
)
from .content_based import ContentBasedRecommender
from .matrix_factorization import MatrixFactorizationRecommender
from .tmdb import load_cache
from .insider import insider_features, _KEYS as _INSIDER_KEYS

_YEAR = re.compile(r"\((\d{4})\)")
_GENS = ["pop", "ii", "uu", "mf", "cb"]


def _grade(rating):
    if rating >= 5:
        return 3
    if rating >= 4:
        return 2
    if rating >= 3:
        return 1
    return 0


class LearningToRankRecommender(Recommender):
    name = "ltr_hybrid"
    label = "Learning-to-Rank Hybrid"
    description = ("LightGBM LambdaRank that learns to combine every recommender "
                  "(popularity, item-item, user-user, MF, content) into one ranking.")

    def __init__(self, cand_k=100, gen_frac=0.75, random_state=RANDOM_STATE):
        self.cand_k = cand_k
        self.gen_frac = gen_frac
        self.random_state = random_state

    def _make_generators(self):
        return {
            "pop": MostPopularRecommender(),
            "ii": ItemItemCollaborativeFiltering(k=40, min_support=5),
            "uu": UserUserCollaborativeFiltering(k=40),
            "mf": MatrixFactorizationRecommender(n_factors=50),
            "cb": ContentBasedRecommender(use_tags=True),
        }

    # ---- feature engineering -------------------------------------------------
    def _build_meta(self, gen_df, items_df):
        us = gen_df.groupby(USER_COL)[RATING_COL].agg(["count", "mean", "std"]).fillna(0.0)
        self.user_stats_ = {u: (r["count"], r["mean"], r["std"]) for u, r in us.iterrows()}
        it = gen_df.groupby(ITEM_COL)[RATING_COL].agg(["count", "mean"])
        self.item_stats_ = {i: (r["count"], r["mean"]) for i, r in it.iterrows()}

        self.item_genres_, self.item_year_ = {}, {}
        for r in items_df.itertuples(index=False):
            g = set(str(r.genres).split("|")) if isinstance(r.genres, str) else set()
            g.discard("(no genres listed)")
            self.item_genres_[r.movieId] = g
            m = _YEAR.search(str(r.title))
            self.item_year_[r.movieId] = int(m.group(1)) if m else np.nan

        liked = gen_df[gen_df[RATING_COL] >= 4]
        self.user_genres_ = {}
        for u, grp in liked.groupby(USER_COL):
            gs = set()
            for it_id in grp[ITEM_COL]:
                gs |= self.item_genres_.get(it_id, set())
            self.user_genres_[u] = gs

        # insider studio-strategy + journey features (E6-7) from the extended TMDB cache
        cache = load_cache()
        self.insider_ = {int(mid): insider_features(meta, self.item_genres_.get(int(mid)))
                         for mid, meta in cache.items()}

    def _row(self, u, item, gd):
        row = {}
        nsrc, best = 0, np.nan
        for g in _GENS:
            r = gd.get(f"{g}_rank", np.nan)
            row[f"{g}_score"] = gd.get(f"{g}_score", np.nan)
            row[f"{g}_rank"] = r
            src = 0 if (isinstance(r, float) and np.isnan(r)) else 1
            row[f"src_{g}"] = src
            nsrc += src
            if src and (np.isnan(best) or r < best):
                best = r
        row["num_sources"], row["best_rank"] = nsrc, best
        u_count, u_avg, u_std = self.user_stats_.get(u, (0.0, 0.0, 0.0))
        row["u_count"], row["u_avg"], row["u_std"] = u_count, u_avg, u_std
        i_pop, i_avg = self.item_stats_.get(item, (0.0, 0.0))
        row["i_pop"], row["i_avg"] = i_pop, i_avg
        row["i_year"] = self.item_year_.get(item, np.nan)
        igen = self.item_genres_.get(item, set())
        row["i_ngenres"] = len(igen)
        row["genre_overlap"] = len(igen & self.user_genres_.get(u, set()))
        row["novelty"] = 1.0 / np.log2(2.0 + i_pop)
        ins = self.insider_.get(item)
        for key in _INSIDER_KEYS:
            row[f"ins_{key}"] = ins[key] if ins else 0.0
        return row

    def _candidates(self, users):
        cand = {u: {} for u in users}
        for gname, g in self.gens_.items():
            for u in users:
                for rank, (item, score) in enumerate(g.recommend(u, n=self.cand_k), 1):
                    d = cand[u].setdefault(item, {})
                    d[f"{gname}_score"] = float(score)
                    d[f"{gname}_rank"] = rank
        return cand

    # ---- fit -----------------------------------------------------------------
    def fit(self, train_df, items_df=None):
        rng = np.random.RandomState(self.random_state)
        gen_mask = np.zeros(len(train_df), dtype=bool)
        for _, idx in train_df.groupby(USER_COL).indices.items():
            k = max(1, int(round(len(idx) * self.gen_frac)))
            gen_mask[rng.choice(idx, size=min(k, len(idx)), replace=False)] = True
        gen_df = train_df.iloc[gen_mask].reset_index(drop=True)
        label_df = train_df.iloc[~gen_mask].reset_index(drop=True)

        self.gens_ = self._make_generators()
        for g in self.gens_.values():
            g.fit(gen_df, items_df)

        self._build_meta(gen_df, items_df)
        self._full_seen = train_df.groupby(USER_COL)[ITEM_COL].agg(set).to_dict()
        self.users_ = np.sort(train_df[USER_COL].unique())

        cand = self._candidates(self.users_)
        label_pos = {u: dict(zip(g[ITEM_COL], g[RATING_COL]))
                     for u, g in label_df.groupby(USER_COL)}

        rows, ru, ri, lab, blocks = [], [], [], [], []
        for u in self.users_:
            items = cand.get(u, {})
            if not items:
                continue
            start = len(rows)
            pos = label_pos.get(u, {})
            for item, gd in items.items():
                rows.append(self._row(u, item, gd))
                ru.append(u); ri.append(item)
                lab.append(_grade(pos.get(item, 0)))
            blocks.append((u, start, len(items)))

        X = pd.DataFrame(rows)
        self.feature_names_ = X.columns.tolist()
        lab, ri = np.array(lab), np.array(ri)

        tr_idx, groups = [], []
        for u, start, cnt in blocks:
            if lab[start:start + cnt].max() >= 1:        # group needs a positive
                tr_idx.extend(range(start, start + cnt))
                groups.append(cnt)
        tr_idx = np.array(tr_idx)

        self.ranker_ = lgb.LGBMRanker(
            objective="lambdarank", metric="ndcg",
            n_estimators=300, learning_rate=0.05, num_leaves=31,
            min_child_samples=20, random_state=self.random_state, verbose=-1,
        )
        self.ranker_.fit(X.iloc[tr_idx], lab[tr_idx], group=groups)

        preds = self.ranker_.predict(X)
        self.serving_ = {}
        for u, start, cnt in blocks:
            seen = self._full_seen.get(u, set())
            block = [(int(ri[j]), float(preds[j]))
                     for j in range(start, start + cnt) if ri[j] not in seen]
            block.sort(key=lambda x: -x[1])
            self.serving_[int(u)] = block
        return self

    def recommend(self, user_id, n=10, exclude_seen=True):
        return self.serving_.get(int(user_id), [])[:n]

    def feature_importance(self):
        return dict(sorted(zip(self.feature_names_, self.ranker_.feature_importances_),
                           key=lambda x: -x[1]))
