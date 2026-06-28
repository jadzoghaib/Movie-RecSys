// Thin typed client for the FastAPI backend.
const BASE = 'http://127.0.0.1:8000'

export interface Movie {
  movie_id: number
  title: string
  genres: string[]
  tmdb_url: string | null
  score?: number
}

export interface ModelInfo { id: string; label: string; description: string }
export interface UserInfo { user_id: number; n_ratings: number }

export interface Metric {
  model: string
  k: number
  'precision@k': number
  'recall@k': number
  'ndcg@k': number
  'mrr@k': number
  'hit_rate@k': number
  coverage: number
  n_users: number
}

const get = <T,>(path: string) => fetch(`${BASE}${path}`).then((r) => r.json() as Promise<T>)

export const api = {
  models: () => get<ModelInfo[]>('/api/models'),
  users: (limit = 30) => get<UserInfo[]>(`/api/users?limit=${limit}`),
  recommend: (userId: number, model: string, n = 12) =>
    get<{ user_id: number; model: string; items: Movie[] }>(
      `/api/recommend?user_id=${userId}&model=${model}&n=${n}`,
    ),
  metrics: () => get<Metric[]>('/api/metrics'),
}
