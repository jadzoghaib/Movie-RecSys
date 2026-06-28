"""End-to-end offline pipeline: EDA -> split -> fit -> evaluate -> save.

Run from the backend/ directory:  py main.py
This is the agile "evaluation from day one" harness; every new sprint adds
its model to the ``models`` list and gets a new row in results/metrics.csv.
"""

import pandas as pd

from src import config
from src.data_loading import (
    load_ratings, load_items, describe_dataset, train_test_split_ratings,
)
from src.baselines import (
    MostPopularRecommender, HighestAverageRatingRecommender,
    BayesianAverageRatingRecommender, RandomRecommender,
)
from src.collaborative_filtering import (
    ItemItemCollaborativeFiltering, UserUserCollaborativeFiltering,
)
from src.content_based import ContentBasedRecommender
from src.matrix_factorization import MatrixFactorizationRecommender
from src.learning_to_rank import LearningToRankRecommender
from src.evaluation import evaluate_model


def main():
    ratings = load_ratings()
    items = load_items()

    describe_dataset(ratings, items)

    train, test = train_test_split_ratings(ratings, test_size=0.2)
    print(f"\nsplit: train={len(train):,} rows  test={len(test):,} rows\n")

    models = [
        MostPopularRecommender(),
        HighestAverageRatingRecommender(min_ratings=20),
        BayesianAverageRatingRecommender(),
        RandomRecommender(),
        ItemItemCollaborativeFiltering(k=40, min_support=5),
        UserUserCollaborativeFiltering(k=40),
        ContentBasedRecommender(use_tags=True),
        MatrixFactorizationRecommender(n_factors=50),
        LearningToRankRecommender(cand_k=100),
    ]

    rows = []
    for model in models:
        model.fit(train, items)
        res = evaluate_model(model, train, test, k=config.TOP_K)
        rows.append(res)
        print(f"  {res['model']:<16} "
              f"P@{res['k']}={res['precision@k']:.3f}  "
              f"R@{res['k']}={res['recall@k']:.3f}  "
              f"NDCG={res['ndcg@k']:.3f}  "
              f"MRR={res['mrr@k']:.3f}  "
              f"Cov={res['coverage']:.3f}  "
              f"(n={res['n_users']})")

    config.RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    out = config.RESULTS_DIR / "metrics.csv"
    pd.DataFrame(rows).to_csv(out, index=False)
    print(f"\nsaved -> {out}")


if __name__ == "__main__":
    main()
