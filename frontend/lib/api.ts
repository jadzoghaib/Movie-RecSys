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
  chips?: string[]
  arc_note?: string
  why?: string
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
  diversity?: number
  novelty?: number
  serendipity?: number
}

export interface Rail { title: string; subtitle?: string; items: Movie[] }
export interface Home { user_id: number; arc: { caption: string; items: Movie[] }; rails: Rail[] }
export interface Profile {
  user_id: number
  n_ratings: number
  top_genres: string[]
  fav_title: string | null
  fav_poster: string | null
}

export interface ChatTurn { role: 'user' | 'assistant'; text: string }
export interface ChatResponse { action: string; reply: string; movies: Movie[]; filters?: Record<string, unknown> }

const get = <T,>(path: string) => fetch(`${BASE}${path}`).then((r) => r.json() as Promise<T>)

export const api = {
  models: () => get<ModelInfo[]>('/api/models'),
  users: (limit = 30) => get<UserInfo[]>(`/api/users?limit=${limit}`),
  metrics: () => get<Metric[]>('/api/metrics'),
  genres: () => get<string[]>('/api/genres'),
  profiles: () => get<Profile[]>('/api/profiles'),
  home: (userId: number, explore: number, genre: string, anchor = 0) =>
    get<Home>(`/api/home?user_id=${userId}&explore=${explore}&genre=${encodeURIComponent(genre)}&anchor=${anchor}`),
  chat: (userId: number, messages: ChatTurn[]) =>
    fetch(`${BASE}/api/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, messages }),
    }).then((r) => r.json() as Promise<ChatResponse>),
}
