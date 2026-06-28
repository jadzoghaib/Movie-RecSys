"""Offline evaluation metrics for top-N recommendation.

Built in Sprint 0 and used for every method all course long. Implements the
top-k metrics taught in class (Precision@K, Recall@K, NDCG@K, MRR, Hit Rate)
plus a beyond-accuracy metric (catalog coverage).
"""

import numpy as np
import pandas as pd

from .config import USER_COL, ITEM_COL, RATING_COL, RELEVANCE_THRESHOLD


def precision_at_k(recommended, relevant, k=10):
    """Fraction of the top-k recommendations that are relevant."""
    if k == 0:
        return 0.0
    rec = recommended[:k]
    hits = sum(1 for i in rec if i in relevant)
    return hits / k


def recall_at_k(recommended, relevant, k=10):
    """Fraction of the relevant items captured in the top-k."""
    if not relevant:
        return 0.0
    rec = recommended[:k]
    hits = sum(1 for i in rec if i in relevant)
    return hits / len(relevant)


def hit_rate_at_k(recommended, relevant, k=10):
    """1.0 if at least one relevant item appears in the top-k, else 0.0."""
    return 1.0 if any(i in relevant for i in recommended[:k]) else 0.0


def dcg_at_k(relevances, k=10):
    """Discounted Cumulative Gain for a rank-ordered relevance list."""
    rels = np.asarray(relevances[:k], dtype=float)
    if rels.size == 0:
        return 0.0
    discounts = np.log2(np.arange(2, rels.size + 2))  # rank 1 -> log2(2)=1
    return float(np.sum(rels / discounts))


def ndcg_at_k(recommended, relevant, k=10):
    """Normalised DCG@K with binary relevance."""
    rels = [1.0 if i in relevant else 0.0 for i in recommended[:k]]
    dcg = dcg_at_k(rels, k)
    ideal = dcg_at_k([1.0] * min(len(relevant), k), k)
    return dcg / ideal if ideal > 0 else 0.0


def mean_reciprocal_rank(recommended, relevant, k=10):
    """Reciprocal rank of the first relevant hit in the top-k."""
    for idx, item in enumerate(recommended[:k], start=1):
        if item in relevant:
            return 1.0 / idx
    return 0.0


def catalog_coverage(recommended_items, all_items):
    """Share of the catalog that appears across all users' recommendations."""
    catalog = set(all_items)
    if not catalog:
        return 0.0
    return len(set(recommended_items) & catalog) / len(catalog)


def evaluate_model(model, train_df, test_df, users=None, k=10,
                   relevance_threshold=RELEVANCE_THRESHOLD):
    """Evaluate a fitted model over the test users and return mean metrics.

    Relevance = held-out items the user rated >= ``relevance_threshold``.
    Recommendations exclude items already seen in train.
    """
    test_pos = test_df[test_df[RATING_COL] >= relevance_threshold]
    relevant_by_user = test_pos.groupby(USER_COL)[ITEM_COL].agg(set).to_dict()

    if users is None:
        users = list(relevant_by_user.keys())

    catalog = train_df[ITEM_COL].unique()
    precisions, recalls, ndcgs, mrrs, hits = [], [], [], [], []
    recommended_all = set()
    n_eval = 0

    for u in users:
        relevant = relevant_by_user.get(u)
        if not relevant:
            continue
        recs = [item for item, _ in model.recommend(u, n=k, exclude_seen=True)]
        recommended_all.update(recs)
        precisions.append(precision_at_k(recs, relevant, k))
        recalls.append(recall_at_k(recs, relevant, k))
        ndcgs.append(ndcg_at_k(recs, relevant, k))
        mrrs.append(mean_reciprocal_rank(recs, relevant, k))
        hits.append(hit_rate_at_k(recs, relevant, k))
        n_eval += 1

    mean = lambda xs: float(np.mean(xs)) if xs else 0.0
    return {
        "model": getattr(model, "name", "model"),
        "k": k,
        "precision@k": mean(precisions),
        "recall@k": mean(recalls),
        "ndcg@k": mean(ndcgs),
        "mrr@k": mean(mrrs),
        "hit_rate@k": mean(hits),
        "coverage": catalog_coverage(recommended_all, catalog),
        "n_users": n_eval,
    }
