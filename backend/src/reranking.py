"""Re-ranking layer (Sprint 6) — the multi-objective stage.

Wraps any base recommender (we use the LTR hybrid) and reshapes its top-N for
diversity, novelty, freshness and trust without discarding relevance:

    adj = alpha*base + beta*novelty + gamma*freshness + delta*trust

then a greedy MMR pass penalises items too genre-similar to those already picked.
This is where the hybrid stops merely matching on accuracy and starts *winning*
on the beyond-accuracy objectives the prof asks for.
"""

import re

import numpy as np

from .base import Recommender
from .config import USER_COL, ITEM_COL, RATING_COL

_YEAR = re.compile(r"\((\d{4})\)")


def _genres(g):
    s = set(str(g).split("|"))
    s.discard("(no genres listed)")
    return s


class ReRankedRecommender(Recommender):
    name = "ltr_reranked"
    label = "LTR + Re-ranking"
    description = "Re-ranks the LTR hybrid for diversity, novelty, freshness and trust (greedy MMR)."

    def __init__(self, base, pool=60, alpha=1.0, beta=0.35, gamma=0.10,
                 delta=0.15, mmr_lambda=0.7):
        self.base = base
        self.pool = pool
        self.alpha, self.beta, self.gamma, self.delta = alpha, beta, gamma, delta
        self.mmr_lambda = mmr_lambda

    def fit(self, train_df, items_df=None, fit_base=True):
        if fit_base:
            self.base.fit(train_df, items_df)
        counts = train_df[ITEM_COL].value_counts()
        self.pop_ = counts.to_dict()
        self.n_users_ = int(train_df[USER_COL].nunique())
        self.item_avg_ = train_df.groupby(ITEM_COL)[RATING_COL].mean().to_dict()

        self.genres_, self.year_ = {}, {}
        years = []
        if items_df is not None:
            for r in items_df.itertuples(index=False):
                self.genres_[r.movieId] = _genres(r.genres)
                m = _YEAR.search(str(r.title))
                y = int(m.group(1)) if m else None
                self.year_[r.movieId] = y
                if y:
                    years.append(y)
        self.min_year_, self.max_year_ = (min(years), max(years)) if years else (1900, 2018)
        self._build_seen(train_df)
        return self

    def _novelty(self, item):
        return -np.log2((self.pop_.get(item, 0) + 1) / (self.n_users_ + 1))

    def _freshness(self, item):
        y = self.year_.get(item)
        if not y:
            return 0.0
        return (y - self.min_year_) / (self.max_year_ - self.min_year_ + 1e-9)

    def _trust(self, item):
        avg = self.item_avg_.get(item, 3.0)
        return (avg / 5.0) * min(1.0, self.pop_.get(item, 0) / 50.0)

    def _gsim(self, a, b):
        ga, gb = self.genres_.get(a, set()), self.genres_.get(b, set())
        union = ga | gb
        return len(ga & gb) / len(union) if union else 0.0

    def recommend(self, user_id, n=10, exclude_seen=True):
        return self.rerank(user_id, n=n, exclude_seen=exclude_seen)

    def rerank(self, user_id, n=10, beta=None, genre=None, exclude_seen=True):
        """Re-rank with an optional custom novelty weight (beta) and genre filter
        — this is what the UI's discovery slider + genre chips drive."""
        beta = self.beta if beta is None else beta
        cands = self.base.recommend(user_id, n=self.pool, exclude_seen=exclude_seen)
        if genre:
            cands = [(i, s) for i, s in cands if genre in self.genres_.get(i, set())]
        if not cands:
            return []
        items = [i for i, _ in cands]
        base = np.array([s for _, s in cands], dtype=float)
        rng = base.max() - base.min()
        bnorm = (base - base.min()) / rng if rng > 1e-9 else np.ones_like(base)

        nov = np.array([self._novelty(i) for i in items])
        nov = nov / (nov.max() + 1e-9)
        fresh = np.array([self._freshness(i) for i in items])
        trust = np.array([self._trust(i) for i in items])
        adj = self.alpha * bnorm + beta * nov + self.gamma * fresh + self.delta * trust

        # greedy MMR: balance adjusted score against genre similarity to picks
        selected, remaining = [], list(range(len(items)))
        while remaining and len(selected) < n:
            best, best_val = None, -1e18
            for idx in remaining:
                sim = max((self._gsim(items[idx], items[s]) for s in selected), default=0.0)
                val = self.mmr_lambda * adj[idx] - (1 - self.mmr_lambda) * sim
                if val > best_val:
                    best_val, best = val, idx
            selected.append(best)
            remaining.remove(best)
        return [(int(items[i]), float(adj[i])) for i in selected]

    def build_arc(self, user_id, n=4, explore=0.6, seed=None):
        """A curated 3-5 movie SEQUENCE: a trusted anchor -> a thematic drift
        along rising novelty -> one serendipitous edge-of-cluster discovery.
        Grounded: anchor = top relevance; links by genre similarity; the final
        pick is the most novel candidate. Returns ordered movie ids.

        `explore` (the discovery slider) widens the novelty drift; `seed` (an
        anchor movie the user picked) overrides the trusted opener so the whole
        journey departs *from that film*."""
        pool_n = 30 + int(50 * explore)                     # explore widens the pool -> more long-tail options
        cands = self.base.recommend(user_id, n=pool_n, exclude_seen=True)
        if len(cands) < 2:
            return [i for i, _ in cands]
        items = [i for i, _ in cands]
        if seed is not None:                                # journey departs from the chosen anchor
            seed = int(seed)
            items = [seed] + [i for i in items if i != seed]
        nov = {i: self._novelty(i) for i in items}
        nmax = max(nov.values()) or 1.0
        anchor = items[0]                                   # most relevant (or the seed) = trusted opener
        discovery = max(items[1:], key=lambda i: nov[i])    # most novel = the serendipitous closer
        seq, used = [anchor], {anchor}
        while len(seq) < n - 1:
            prev = seq[-1]
            pool = [i for i in items if i not in used and i != discovery]
            if not pool:
                break
            # low explore -> stay genre-coherent (gsim); high explore -> drift toward novelty
            nxt = max(pool, key=lambda i: (1.0 - explore) * self._gsim(prev, i)
                      + explore * (nov[i] / nmax))
            seq.append(nxt)
            used.add(nxt)
        if discovery not in used:
            seq.append(discovery)
        return seq[:n]
