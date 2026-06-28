"""Matrix factorization recommender — implemented in Sprint 5.

Structure matches the professor's template and the common ``Recommender``
interface. Design (WORKPLAN.md Sprint 5): latent factors via SVD/SGD
(r̂_ui = μ + b_u + b_i + p_u·q_i). The class notebooks in
"Recommender Systems/6. Matrix Factorization/" are MovieLens-ready and reusable.
"""

from .base import Recommender


class MatrixFactorizationRecommender(Recommender):
    name = "matrix_factorization"
    label = "Matrix Factorization"
    description = "Learns latent taste factors for users and movies to predict ratings for unseen films."

    def __init__(self, n_factors=50, n_epochs=20, random_state=42):
        self.n_factors = n_factors
        self.n_epochs = n_epochs
        self.random_state = random_state

    def fit(self, train_df, items_df=None):
        raise NotImplementedError("Sprint 5: train SVD / SGD matrix factorization")

    def recommend(self, user_id, n=10, exclude_seen=True):
        raise NotImplementedError("Sprint 5")
