"""Recommender systems core package (MovieLens movie track).

Every algorithm lives here behind the common ``Recommender`` interface
(``fit`` / ``recommend``) so the evaluation harness and the FastAPI layer
never change when a new method is added.
"""
