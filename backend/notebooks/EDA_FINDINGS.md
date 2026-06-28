# Sprint 1 — EDA Findings (Movie track, `ml-latest-small`)

Figures in `results/figures/`. Every finding below is linked to a **design decision** for later sprints — this is the "explain your choices" the assignment asks for.

## Dataset at a glance
| metric | value |
|---|---|
| users | 610 |
| movies (rated) | 9,724 (catalog 9,742) |
| ratings | 100,836 |
| **sparsity** | **98.3%** (only 1.7% of user×movie cells filled) |
| ratings/user | mean 165, **median 70** |
| ratings/movie | mean 10.4, **median 3** |
| mean rating | 3.50 (scale 0.5–5) |
| ratings ≥ 4.0 | 48.2% |

Per the dataset README, every user rated **≥ 20 movies** and no demographics are included — so cold-start here is mostly an *item* problem, not a *user* problem.

## Finding 1 — Extreme sparsity (98.3%) → `02_long_tail`, summary
Only 1.7% of the user×movie matrix is observed. **Implications:**
- **Item-item CF will be fragile**: similarities computed from a handful of co-ratings are noisy. (We expect this to show up as weak item-item numbers — a deliberate discussion point, not a bug.)
- **Matrix factorization should win**: it compresses the sparse matrix into dense latent factors and generalises across the gaps.
- **Popularity is a strong baseline** precisely *because* it sidesteps sparsity.

## Finding 2 — Severe long tail → `02_long_tail`, `04_genre_prevalence`
- **Top 10% of movies = 60%** of all ratings; **top 20% = 77%**.
- **Median movie has just 3 ratings; 62.5% of movies have < 5 ratings; 35.4% have ≤ 1.**
**Implications:**
- The 62.5% "cold" tail is where item-item CF has too few co-raters to be reliable → **content-based filtering is the natural fix** (metadata exists regardless of how many ratings a movie has).
- Strong **popularity bias** risk → motivates the **Bayesian-corrected average** (Sprint 2) and the **novelty / coverage / serendipity** metrics (Sprint 6).
- Directly motivates the **"Tonight's Arc" wow feature** (Sprint 7): the periphery/long-tail is exactly where serendipitous discoveries live.

## Finding 3 — Right-skewed user activity → `03_ratings_per_user`
Median 70 vs mean 165 ratings/user: a minority of power users rate thousands. **Implications:**
- Our **per-user hold-out split** (keep ≥1 train rating per user) is the fair choice — a global random split would orphan light users.
- **User-user CF** benefits from the dense power users but most users are moderate; worth comparing against item-item (E3-2).

## Finding 4 — Ratings skew positive → `01_rating_distribution`
Mean 3.5, ~48% of ratings ≥ 4.0, few very-low ratings (positivity bias). **Implications:**
- **Relevance = rating ≥ 3.5** ("liked") is a defensible threshold for top-N evaluation.
- Rating-prediction error (RMSE/MAE) is *less* informative than ranking metrics here → we lead with **Precision/Recall/NDCG/MRR**, report RMSE/MAE as secondary.

## Finding 5 — Genre imbalance → `04_genre_prevalence`
Drama and Comedy dominate the catalog; Film-Noir, Western, War are rare. **Implications:**
- A raw genre count vector is dominated by common genres → **TF-IDF down-weights ubiquitous genres** so rare, informative ones carry signal (motivates the TF-IDF-vs-raw comparison, E4-3).
- Intra-list **diversity** metrics must account for this imbalance (a list of Dramas isn't "diverse" even if popular).

## Finding 6 — Genre is a weak rating signal → `05_avg_rating_per_genre`
Average rating varies only mildly across genres (e.g. Film-Noir/War/Documentary rate higher; Horror/Comedy lower), within a narrow band. **Implication:** genre alone weakly predicts enjoyment → supports **enriching content features with TMDB overview/keywords/cast** (E4-2) and a **hybrid blend** (E6-3) rather than relying on genre.

## Finding 7 — Ratings span 1996–2018 unevenly → `06_ratings_over_time`
Timestamps cover two decades with activity bursts. **Implications:**
- Enables an optional **temporal split** and a light **recency/"trending"** signal.
- We still default to the per-user random hold-out for a fair, reproducible comparison across methods.

---
### One-line summary for the deck
> *98.3% sparse with a brutal long tail (top 20% of films = 77% of ratings, 62% of films have <5 ratings). This single fact predicts the whole results table: popularity is a tough baseline, item-item CF struggles on the cold tail, content-based rescues it, and matrix factorization generalises through the sparsity.*
