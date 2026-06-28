"""The common recommender interface — the architectural backbone.

Every model (popularity, collaborative filtering, content-based, matrix
factorization) subclasses ``Recommender``. The evaluator, the API, and the
UI only ever call ``fit`` and ``recommend``.
"""

from .config import USER_COL, ITEM_COL


class Recommender:
    name = "base"
    label = "Base"
    description = ""

    def fit(self, train_df, items_df=None):
        """Learn from the training ratings. Returns self."""
        return self

    def recommend(self, user_id, n=10, exclude_seen=True):
        """Return a ranked list of ``(item_id, score)`` tuples, best first."""
        raise NotImplementedError

    # -- helpers shared by subclasses -------------------------------------
    def _build_seen(self, train_df):
        """Cache the set of items each user already interacted with (train)."""
        self._seen = train_df.groupby(USER_COL)[ITEM_COL].agg(set).to_dict()

    def _seen_for(self, user_id):
        return getattr(self, "_seen", {}).get(user_id, set())
