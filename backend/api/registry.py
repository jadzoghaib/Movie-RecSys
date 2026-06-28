"""Model registry — the single place new algorithms get plugged in.

Each sprint appends its recommender here; the API and UI pick it up
automatically (no endpoint or frontend changes needed).
"""

from src.baselines import (
    MostPopularRecommender, HighestAverageRatingRecommender,
    BayesianAverageRatingRecommender, RandomRecommender,
)
from src.collaborative_filtering import (
    ItemItemCollaborativeFiltering, UserUserCollaborativeFiltering,
)
from src.content_based import ContentBasedRecommender
from src.matrix_factorization import MatrixFactorizationRecommender


def build_models():
    """Return fresh (unfitted) instances of every available recommender."""
    return [
        MostPopularRecommender(),
        HighestAverageRatingRecommender(min_ratings=20),
        BayesianAverageRatingRecommender(),
        RandomRecommender(),
        ItemItemCollaborativeFiltering(k=40, min_support=5),
        UserUserCollaborativeFiltering(k=40),
        ContentBasedRecommender(use_tags=True),
        MatrixFactorizationRecommender(n_factors=50),
    ]
