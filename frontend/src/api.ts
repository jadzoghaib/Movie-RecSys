// Thin typed client for the FastAPI backend.
const BASE = 'http://127.0.0.1:8000'

export interface Movie {
  movie_id: number
  title: string
  genres: string[]
  tmdb_url: string | null
  poster_url?: string | null
  overview?: string
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

export interface Rail { title: string; items: Movie[] }
export interface Home { user_id: number; arc: { caption: string; items: Movie[] }; rails: Rail[] }

const get = <T,>(path: string) => fetch(`${BASE}${path}`).then((r) => r.json() as Promise<T>)

export const api = {
  models: () => get<ModelInfo[]>('/api/models'),
  users: (limit = 30) => get<UserInfo[]>(`/api/users?limit=${limit}`),
  recommend: (userId: number, model: string, n = 12) =>
    get<{ user_id: number; model: string; items: Movie[] }>(
      `/api/recommend?user_id=${userId}&model=${model}&n=${n}`,
    ),
  metrics: () => get<Metric[]>('/api/metrics'),
  genres: () => get<string[]>('/api/genres'),
  home: (userId: number, explore: number, genre: string) =>
    get<Home>(`/api/home?user_id=${userId}&explore=${explore}&genre=${encodeURIComponent(genre)}`),
}
