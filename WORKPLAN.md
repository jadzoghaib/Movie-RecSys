# Individual Project — Agile Workplan (Movie Track)

**Course:** Recommender Systems (Prof. Marc Torrens, Esade)
**Track:** Movies — **MovieLens Latest Small** (`ml-latest-small`: ratings.csv, movies.csv, tags.csv, links.csv)
**Dataset decision (LOCKED):** `ml-latest-small` is the single source of truth for *interactions* (ratings → the CF/MF user×item matrix). We do **not** concatenate other rating datasets (incompatible user/movie ID spaces + rating scales would corrupt CF/MF). Additional capability comes from **metadata enrichment joined on stable keys** (`links.csv`: movieId → tmdbId/imdbId), not from stacking rating sets. TMDB metadata is scheduled for Sprint 4 (see below).
**Deliverables:** (1) Working prototype with UI · (2) Slide deck (technical challenges, method comparison, final remarks)
**Grading:** Technical implementations **50%** · Evaluation **30%** · User Experience **20%**
**Stack (as built):** Python core → **FastAPI** REST → **Next.js** (React 19 + TypeScript + Tailwind v4) frontend. _(Pivoted from the originally-planned Vite/React + Streamlit during the build.)_

---

## ✅ Final build status (delivered — all 7 sprints)

> The sprint plan & backlog further down are the *original plan*; this section records the *as-built* reality. Repo: **github.com/jadzoghaib/Movie-RecSys**.

| Sprint | Delivered |
|---|---|
| 0 · Foundation | repo · dataset · per-user 80/20 split · evaluation harness · FastAPI + UI skeleton |
| 1 · EDA | `notebooks/eda.py` → 6 figures + findings (98.3% sparse, long tail) |
| 2 · Non-personalised | Most Popular · Highest-Avg · **Bayesian-Avg** · Random |
| 3 · Collaborative | Item-Item CF · User-User CF (+ comparison) |
| 4 · Content-based | TF-IDF (genres+tags) · **TMDB enrichment** (posters + overview/keywords/cast) |
| 5 · Matrix factorization | truncated-SVD latent factors (k=50) |
| 6 · Hybrid + evaluation | **LTR hybrid** (LightGBM LambdaRank, leakage-safe) · **MMR re-ranker** · beyond-accuracy metrics (diversity/novelty/serendipity) · **insider** studio-strategy + journey features |
| 7 · Wow / UX | "Who's watching?" landing · multi-rail home · **Tonight's Arc** · discovery slider · grounded **chips + "why this"** explanations · **Gemini conversational guide** |

**12 recommenders.** Best model: **`ltr_hybrid` — P@10 0.172, NDCG 0.219** (beats user-user CF 0.168). The re-ranker leads diversity (0.84) + serendipity (0.060) — the accuracy↔beyond-accuracy trade-off, demonstrated.

**Routes:** `/` landing · `/u/[id]` home · `/u/[id]/chat` AI guide · `/evaluation` lab.
**External:** TMDB (metadata/posters) · Gemini (NL intent parsing) — keys in gitignored `backend/.env`.

**Deferred (optional):** the **slide deck** (the one remaining *required* deliverable) · TF-IDF-vs-raw comparison (E4-3) · MF tuning (E5-2) · explicit router (E6-5 — the LTR ranker already segments by user behaviour implicitly).

---

## 1. Method: Agile, vertical slices, evaluation-from-day-1

The prof's instruction is explicit: *"Use Agile development (basic evaluation from the beginning)."* So this plan is **not** waterfall (build everything → evaluate at the end). Instead:

- **One growing prototype**, not seven throwaway scripts. Every algorithm is a module behind a **common `Recommender` interface** (`fit()` / `recommend(user_id, n)`), so the UI and the evaluation harness never change when a new method is added.
- **The evaluation harness is built in Sprint 1** (with the popularity baseline) and *every* later sprint must add its method to the results table. This is what "basic evaluation from the beginning" means — you always have a comparison table, it just grows.
- **Each sprint ends with a working, demoable increment** (Definition of Done below). If you ran out of time after any sprint, you'd still have something that runs.
- **Sprint = 1 course week**, matching the prof's week-by-week agenda.

### Definition of Done (applies to every sprint)
- [ ] New method implements the common interface and is registered in the model registry
- [ ] It produces top-N recommendations for any user without crashing
- [ ] It appears as a new row in `results/metrics.csv` (P@10, Recall@10, NDCG@10, Coverage)
- [ ] It is selectable/visible in the UI
- [ ] A 2–3 sentence reflection captured in `notes/sprint_log.md` (what worked, what surprised you, one "technical challenge" for the slide deck)

### The common interface (the architectural backbone)
```python
class Recommender:
    def fit(self, train_df, items_df=None): ...        # learn from training ratings
    def recommend(self, user_id, n=10, exclude_seen=True): ...  # -> [(item_id, score), ...]
```
Every model (popular, CF, content, MF) subclasses this. The evaluator, the API, and the UI only ever call these two methods.

### Architecture: three layers, clean separation
```
┌──────────────────────────┐     HTTP/JSON     ┌─────────────────────────┐
│  React frontend (Vite)   │  ◄────────────►   │   FastAPI backend       │
│  - movie grid + posters  │   /api/recommend  │  - loads trained models │
│  - user/model selector   │   /api/similar    │  - model registry       │
│  - side-by-side compare  │   /api/metrics    │  - returns JSON          │
│  - Tailwind styling      │                   └───────────┬─────────────┘
└──────────────────────────┘                               │ calls .recommend()
                                                ┌───────────▼─────────────┐
                                                │  Python recommender core │
                                                │  src/ modules (unchanged)│
                                                └──────────────────────────┘
```
**Why this matters:** the 50% "technical implementations" grade lives entirely in the Python core (`src/`), untouched by the UI choice. React only consumes JSON. So the algorithm work and the front-end work are decoupled and can progress in parallel.

### API contract (the FastAPI ↔ React boundary)
| Endpoint | Returns |
|----------|---------|
| `GET /api/models` | list of available recommenders (id, label, description) |
| `GET /api/users?limit=` | sample of valid user IDs (for the demo selector) |
| `GET /api/movies?search=` | movie search (id, title, genres, poster) for "rate these" |
| `GET /api/recommend?user_id=&model=&n=` | top-N recs: `[{movie_id, title, genres, score, poster_url}]` |
| `GET /api/similar?movie_id=&n=` | content-based "more like this" |
| `GET /api/metrics` | the evaluation comparison table |
| `GET /api/home?user_id=&explore=&genre=` | _(as built)_ the whole homepage: arc + rails, each item with chips + "why" |
| `GET /api/profiles` | _(as built)_ curated viewers for the "Who's watching?" landing |
| `GET /api/genres` | _(as built)_ genre list for the filter |
| `POST /api/chat` | _(as built)_ conversational guide: `{user_id, messages}` → Gemini intent → recommendations |

### Nice-UI enhancement: TMDB metadata enrichment (SCHEDULED → Sprint 4)
MovieLens ships `links.csv` mapping each `movieId → tmdbId/imdbId`. In Sprint 4 the backend joins **TMDB metadata** onto our movies (poster art, overview, cast, keywords) on the stable `tmdbId` key. This serves two goals at once:
- **Content-based (50% technical):** richer item features than genres alone — overview/keywords/cast feed the TF-IDF vectors.
- **UX (20%):** real poster artwork in the React grid instead of text cards.

*Requires a free TMDB API key. Implementation plan: fetch once, **cache poster/metadata to disk** (e.g. `data/processed/tmdb_cache.json`) so the demo runs offline and we don't hammer the API. If no key is provided, the UI gracefully falls back to the current styled text cards (already working).*

---

## 2. Product Backlog (Epics → User Stories)

Prioritised. "As a user" = the end-user of the movie recommender; "As the analyst" = you, the developer/evaluator.

Prioritised, with target sprint. Items tagged **[blueprint]** / **[research]** come from the production-blueprint triage (§3b) and the wow-factor research — they are now first-class tracked backlog items, not loose ideas.

| ID | Epic | User Story | Priority | Status |
|----|------|-----------|----------|--------|
| E0-1 | Foundation | repo + dataset + train/test split shared by all methods | MUST | ✅ done |
| E0-2 | Foundation | evaluation harness (P@K, R@K, NDCG, MRR, Coverage) from day 1 | MUST | ✅ done |
| E0-3 | UX | polished UI: pick user/model → movie grid | MUST | ✅ done |
| E0-4 | UX | FastAPI layer exposing every model over REST | MUST | ✅ done |
| E1-1 | EDA | dataset stats + plots (sparsity, long tail, rating dist., genres) | MUST | ✅ done |
| E2-1 | Non-personalised | popular / top-rated movies for cold-start | MUST | ✅ done |
| E2-2 | Non-personalised | Bayesian-corrected average rating (popularity-bias guard) | COULD | ✅ done |
| E3-1 | Collaborative | item-item + user-user CF recommendations | MUST | ✅ done |
| E3-2 | Collaborative | user-user vs item-item comparison | SHOULD | ✅ done |
| E4-1 | Content-based | genre/tag TF-IDF recommendations + `similar_items` | MUST | ✅ done |
| E4-2 | Content-based | **TMDB enrichment** — posters (UX) + overview/cast/keyword features | SHOULD | ✅ done |
| E4-3 | Content-based | TF-IDF vs raw genre vectors comparison | SHOULD | ⬜ deferred |
| E5-1 | Matrix Factorization | latent-factor recommendations (SVD/SGD) | MUST | ✅ done |
| E5-2 | Matrix Factorization | k / latent-factor tuning | SHOULD | ⬜ deferred |
| E6-1 | Evaluation | full comparison table + beyond-accuracy (novelty, diversity, **serendipity**, coverage, popularity bias) | MUST | ✅ done |
| E6-2 | Deck | slide deck telling the comparison + scoping story | MUST | ⬜ **TODO (required)** |
| E6-3 | Hybrid | **Learning-to-Rank hybrid** — LightGBM LambdaRank over candidate-generator + match features `[research]` | SHOULD | ✅ done |
| E6-4 | Re-ranking | MMR diversity re-ranking `[blueprint]` | SHOULD | ✅ done |
| E6-5 | Composition | router / segmented meta-recommender by behavioural segment `[research]` | SHOULD | ⬜ deferred (ranker segments implicitly) |
| E6-6 | Hybrid | LTR candidate-generation + feature table (graded labels, neg-sampling, leakage-safe split) `[research]` | SHOULD | ✅ done |
| E6-7 | Differentiator | insider TMDB heuristic features (commercial-scale / prestige / crowdpleaser / …) — feature-importance test `[research]` | COULD | ✅ done |
| **E7-1** | **WOW ★** | **"Tonight's Arc" serendipitous story-arc rail** `[research]` | SHOULD | ✅ done |
| E7-2 | UX | multi-rail homepage (Because-you-liked-X / Discover / Popular / genre) `[blueprint]` | SHOULD | ✅ done |
| E7-3 | UX | discovery slider + genre filters (live re-rank) `[research]` | SHOULD | ✅ done |
| E7-4 | Trust | grounded explanations (chips + "why this": genres ∩ keywords ∩ cast) `[research]` | SHOULD | ✅ done |
| E7-5 | WOW (opt) | conversational LLM guide — free-text → intent → recommend (built with **Gemini**, not Claude) `[research]` | COULD | ✅ done |

---

## 3. Sprint Plan (7 sprints = 7 weeks)

> Order follows the prof's week-by-week agenda. Note UI is **Sprint 0**, because UX is 20% of the grade and everything else plugs into it.

### Sprint 0 — Setup, Backend API, React Shell, Evaluation Harness
**Goal:** A running React app talking to a FastAPI backend + empty results table, before any real algorithm exists.
- Init repo, project structure: `backend/` (Python `src/` core reused from the zip + `api/` FastAPI app) and `frontend/` (Vite + React + TS + Tailwind).
- `requirements.txt` (pandas, scikit-learn, fastapi, uvicorn) and `frontend/package.json`.
- Download `ml-latest-small` into `data/raw/`.
- Implement `data_loading.py`: `load_ratings`, `load_items`, `train_test_split_ratings` (random **and** leave-one-out/temporal option), `get_seen_items`.
- Implement `evaluation.py`: `precision_at_k`, `recall_at_k`, `ndcg_at_k`, `catalog_coverage`, `evaluate_model` loop. **← built now, used all course.**
- **FastAPI**: model registry + `/api/models`, `/api/users`, `/api/recommend` endpoints (wired to a dummy model first), CORS enabled for the dev frontend.
- **React shell**: app layout, user/model selector, movie-card grid component (placeholder data), Tailwind theme. End-to-end: React fetches `/api/recommend` → renders cards.
- **Demo:** React app loads, you pick a user, it calls the API and shows a (dummy) grid; evaluation harness runs on a dummy model and writes `results/metrics.csv`.
- **Class concepts:** evaluation protocol, train/test split, offline evaluation (`5. Building Real-world…/EvaluationRecommenderSystems.pdf`).

### Sprint 1 — Dataset + EDA + Preprocessing
**Goal:** Understand the data; justify later design choices.
- Compute: #users, #items, #ratings, **sparsity**, rating distribution, most active users, most popular items.
- Plot the **long tail** of item popularity (directly references the intro lecture).
- Document filtering decisions (e.g., drop users/items with <k ratings) in EDA notebook.
- **Class concepts:** Long tail (Chris Anderson), popularity bias, sparsity → `1. IntroductionToRecommenderEngines.pdf`.

### Sprint 2 — Non-personalised Baselines
**Goal:** Cold-start-capable baselines + first real numbers in the table.
- `MostPopularRecommender` (count-based) and `HighestAverageRatingRecommender` (mean rating + **minimum-ratings threshold**).
- Stretch: **Bayesian-corrected average** (shrinkage to global mean) — the class warns a 5.0-from-2-users beats 4.5-from-10000; show you fixed it.
- Add both rows to the metrics table.
- **Class concepts:** Four non-personalised methods, average-rating formula `U(j)=(1/n)Σu(i,j)`, popularity-bias counter-strategies → `2. NonPersonalisedRecommendations.pdf`.

### Sprint 3 — Collaborative Filtering
**Goal:** First personalised method.
- `ItemItemCollaborativeFiltering` (primary) with cosine similarity, top-k neighbours, prediction `score(u,i)=Σ sim(i,j)·r(u,j) / Σ|sim(i,j)|`.
- Stretch (strongly recommended for the comparison story): `UserUserCollaborativeFiltering` → lets you do the **user-user vs item-item** comparison the guidelines reward.
- Note: item-item tends to beat user-user on sparse MovieLens — capture this as a "technical challenge" slide.
- **Class concepts:** user-user & item-item algorithms, cosine vs Pearson, neighbourhood selection, complexity → `3. Collaborative Filtering/CollaborativeFiltering.pdf`, `DistanceMetrics.pdf`, research paper (Fikh 2021).

### Sprint 4 — Content-based Filtering
**Goal:** Metadata-driven method; contrast with CF.
- Item vectors from genres + free-text `tags.csv` + **TMDB metadata** (overview, keywords, cast): **TF-IDF** over the combined token set.
- **TMDB enrichment** (joined on `links.csv` → `tmdbId`): fetch + cache metadata and poster URLs to `data/processed/`; wire posters into the React grid (UX booster).
- User profile = weighted sum of **mean-centered** ratings × item vectors: `profile(u)=Σ (r(u,i)−r̄(u))·vec(i)`.
- Recommend by cosine(profile, item). Add `similar_items()` for the UI ("more like this").
- Stretch: **TF-IDF vs raw genre count vectors** comparison; genres-only vs genres+TMDB-enriched comparison.
- **Class concepts:** item modelling, user-profile formalisation, TF-IDF weighting → `4. Content-based Filtering…/ContentBasedFiltering.pdf` (+ solved exercise).

### Sprint 5 — Matrix Factorization
**Goal:** Latent-factor model; usually the accuracy winner.
- Option A (beginner): scikit-surprise **SVD**. Option B (advanced, matches class notebooks): SGD on `r̂_ui = μ + b_u + b_i + p_u·q_i`.
- **Reuse the class notebooks directly:** `6. Matrix Factorization/Class Example - Part 1/mf_movielens.ipynb` is literally MovieLens MF.
- Only train on observed entries; explain how unseen items are scored.
- **Class concepts:** factorisation intuition, SGD learning, handling unobserved entries, SGD vs WALS, Netflix Prize → `6. Matrix Factorization/Matrix Factorization.pdf` + Google MF PDF + notebooks.

### Sprint 6 — Full Evaluation, Beyond-Accuracy, Deck
**Goal:** The 30% evaluation grade + the slide deck.
- Final comparison table: all methods × {P@10, Recall@10, NDCG@10, MRR, Coverage}.
- **Beyond accuracy** (the prof stresses "accuracy is not enough"): **novelty** (inverse-popularity / self-information), **diversity** (intra-list genre dissimilarity), **serendipity** (relevant-but-unexpected vs a popularity baseline), **catalog coverage**, **popularity-bias** analysis, scalability notes.
- **Hybrid recommender**: weighted/stacked blend of CF + content + popularity candidate scores (the "ranking" stage of the retrieval→rank→re-rank framing).
- **MMR diversity re-ranking**: greedy re-rank trading off relevance vs intra-list diversity.
- Recommendation examples for **≥3 users**, side-by-side across methods — build a **compare view** in React (columns per model) for a strong deck screenshot.
- Add a **metrics view** in the UI driven by `/api/metrics` so the evaluation story is visible in the prototype itself.
- Build slide deck: technical challenges, method comparison, final remarks.
- **Class concepts:** top-k metrics, MRR, novelty, accuracy-vs-discovery (R1 vs R2 solved example), Netflix Prize → `EvaluationRecommenderSystems.pdf`, `JZ_Recommender_Evaluation_Exercise.pptx`.

### Sprint 7 (optional/stretch) — Holistic UX layer + WOW factor
**Goal:** Turn "compare algorithms" into a *cohesive, holistic* recommender — the "re-ranking + product" layer of the Netflix-style design, scaled to our offline data.

**Tier 1 — signature wow (low risk, all offline, reuses the existing stack):**
- **★ "Tonight's Arc" rail** (headline feature): a curated 3–5 movie *sequence*, not a flat list. Starts with a trusted high-relevance pick → walks outward along a **novelty/periphery gradient in the MF latent space** → guarantees ≥1 serendipitous edge-of-cluster discovery → items linked by **plot-theme similarity** (embeddings of TMDB overview+keywords) → templated narrative caption. It's a *sequencing re-rank* on top of relevance + novelty + serendipity (Sprints 4–6).
  - **Grounded only:** every step uses a real signal (MF distance, novelty score, keyword/cast overlap). Emotional-arc narration ("melancholic→hopeful") is *flavor copy*, NOT a validated claim — no affect labels exist in our data.
  - **Evaluation:** an arc isn't a top-N list; evaluate its *components* (pick relevance) + report the arc's diversity/novelty/serendipity numbers; demo the experience.
- **Multi-rail homepage**: "Tonight's Arc", "Because you liked X", "Discover (high novelty)", "Popular now", per-genre rails — each rail = an existing model/config (zero new algorithms).
- **Structured negotiation panel**: discovery/novelty slider + genre chips + **language toggle** ("keep it foreign" = TMDB `original_language ≠ en`) + year range → re-rank live. Robust, no NLP fragility.
- **Grounded multi-aspect explanations**: "Because it shares the *heist* + *non-linear* keywords and director *Nolan* with Memento (you rated 5★)." Faithful to actual ranking signals — avoid post-hoc "explanation theater" that undermines trust.

**Tier 2 — optional flourish (only if Sprints 1–6 are green):**
- **Conversational LLM guide**: free-text ("less violence, more character-driven, keep it foreign, medium novelty") → filter/weight params via **Claude tool-use**; LLM prose explanations generated *from the grounded attributes* (stays faithful). Adds API key + cost + dependency. Honest caveat: "less violence"/"character-driven" axes are heuristic (keywords/genres); novelty/genre/language/year are exact.

**Guardrail:** Sprint 7 is AFTER the core 50% (methods) + 30% (evaluation) are solid. Wow ≠ substitute for correct fundamentals.

**Out of scope (discuss in deck, don't build):** microservices, feature store, streaming events, RL/bandits, ANN index, online A/B testing — all need live traffic / scale we don't have. See triage below.

---

## 3b. Production-blueprint triage (Netflix-scale research → what we borrow)

The user's research describes a production system (implicit feedback at scale + live traffic + online learning). Our operating point is different (explicit ratings, static 100k dataset, offline). Decisions:

| Blueprint component | Fits ml-latest-small? | Verdict |
|---|---|---|
| 3-stage retrieval→rank→re-rank *framing* | Conceptually yes | 🟢 Adopt (as functions, not services) |
| Collaborative filtering / Matrix factorization | Yes (explicit ratings) | 🟢 Adopt (Sprints 3, 5) |
| Content-based (genres/tags/TMDB overview+cast) | Yes | 🟢 Adopt (Sprint 4) |
| Hybrid blend of candidate scores | Yes | 🟢 Adopt (Sprint 6) |
| Diversity / novelty / serendipity / coverage | Yes (offline-computable) | 🟢 Adopt (Sprint 6) |
| MMR diversity re-ranking | Yes | 🟢 Adopt (Sprint 6/7) |
| Discovery slider + genre filters + multi-rail UX + explanations | Yes | 🟢 Adopt (Sprint 7) |
| Two-tower retrieval | MF *is* a linear two-tower (p_u·q_i) | 🟡 Adapt — brute-force, no ANN/FAISS at 9.7k items; neural towers overkill |
| Implicit feedback | We have explicit ratings | 🟡 Adapt — binarize (≥3.5) where needed |
| Context (time/device/location) | Only `timestamp` | 🟡 Adapt — light recency/trending only |
| Learned GBDT/deep ranker | Possible, modest gain | 🔵 Defer/stretch |
| Online A/B testing, retention/watch-time KPIs | No live users | 🔵 Defer — describe methodology in deck |
| Microservices, feature store, streaming, RL/bandits, ANN, neural rankers, auth, LLM explanations, group recs | No data / no live loop / over-engineering | 🔴 Drop (keep FastAPI monolith) |

**Deck angle:** explicitly scoping out the production infra *and explaining why* (offline + data constraints) is a strength — it shows deliberate engineering judgement, which the prof (ex-Strands cofounder) rewards over naive over-building.

---

## 3c. Learning-to-Rank hybrid (research-upgraded — the headline hybrid)

Upgrades the naive weighted blend (old E6-3) into a **3-stage pipeline**: candidate generation → learned ranker → re-ranker. The project's biggest technical-depth lever, and fully feasible on our data (LightGBM 4.6 installed).

**Stage 1 — Candidate generation:** union of top-N from each existing recommender (popularity, item-item, user-user, content, MF) per user → ~150–250 candidates; tag each with its source(s).

**Stage 2 — Learned ranker (LightGBM `LGBMRanker`, LambdaRank/NDCG):**
- One row per (user, candidate) pair; `group` = per-user candidate count.
- **Graded labels** from train ratings: 5★→3, 4★→2, 3★→1, ≤2★/sampled-negative→0.
- **Negative sampling:** hard negatives (similar-to-liked, not rated) + random negatives.
- **Features (~25, focused):** match — cf_score, uu_cf_score, **mf_score** (Sprint 5), content_score, genre_overlap, popularity_pct, novelty; user — rating_count, avg, std, genre_entropy, novelty_tolerance; item — year, avg_rating, popularity, runtime/lang (TMDB); source — source_*, num_sources_hit, best_source_rank.
- **⚠ Leakage-safe design (key correctness risk — design FIRST):** generators fit on a sub-split; ranker trained on held-out labels; final eval on the untouched test set.

**Stage 3 — Re-ranker:** final_score = α·ranker + β·novelty + γ·freshness + δ·trust, then greedy MMR diversity (E6-4). Driven by the explore/safe slider + genre filters (E7-3).

**Comparison to report:** CF-only · content-only · naive-hybrid · **LTR-hybrid** · LTR+re-rank — a learned ranker over multiple generators is the "serious, defensible hybrid" the rubric rewards.

**Optional differentiator (E6-7):** the user's studio-strategy *insider* TMDB features (commercial-scale, prestige, crowdpleaser, watchability, franchise/IP). Frame as a **hypothesis**: do they earn predictive weight? Report LightGBM feature importance to answer honestly. Needs extended TMDB fields (budget/revenue/runtime/language/vote/collection) → extend the cache.

**LLM stays post-ranking** (E7-5): explanations + NL→filters, never the recommender core — exactly what the research advises.

---

## 4. Class-concept → deliverable traceability (for the report/deck)

| Class topic | Source file | Where it shows up in the prototype |
|-------------|-------------|-----------------------------------|
| Long tail, sparsity, taxonomy | `1. IntroductionToRecommenderEngines.pdf` | EDA plots, design justification |
| 4 non-personalised methods, Bayesian avg | `2. NonPersonalisedRecommendations.pdf` | Baseline modules |
| User-user / item-item, cosine/Pearson | `3. Collaborative Filtering/*` | CF modules |
| TF-IDF, user profiles, hybrid | `4. Content-based Filtering…/*` | Content-based module |
| Offline eval, top-k metrics, MRR, novelty | `5. …/EvaluationRecommenderSystems.pdf`, eval `.pptx` | Evaluation harness + beyond-accuracy |
| SGD MF, biases, latent factors | `6. Matrix Factorization/*` (notebooks reusable) | MF module |

---

## 5. Risks / watch-items
- **Item-item CF on sparse data** can underperform — plan time to tune k / min-overlap; frame as a deliberate "technical challenge."
- **scikit-surprise** can be painful to install on Windows — fallback to a NumPy SGD MF (class notebook already has this).
- **Evaluation leakage** — make sure `exclude_seen` uses *train* history only, and relevant items come from *test*.
- **Scope creep** — Stretch items (EX-*) only after all MUST stories are green.
- **Two-tier complexity** — React+FastAPI is more setup than Streamlit. Mitigation: Sprint 0 nails the end-to-end skeleton (dummy model → API → grid) *once*; every later sprint just registers a new model server-side and it appears in the UI automatically. No frontend rework per algorithm.
- **CORS / dev ports** — backend (uvicorn :8000) and frontend (Vite :5173) are separate origins; enable FastAPI CORS in Sprint 0 to avoid blocked requests.
- **Latency** — heavy models (item-item, MF) should `fit()` once at API startup and cache, not per request; precompute similarity matrices on boot.
- **TMDB posters** — needs a free API key + network; cache poster URLs to disk so the demo works offline.
