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

export interface Rail { title: string; subtitle?: string; items: Movie[]; active_model?: string | null }
export interface ViewerDNA { segment: string; explore_suggestion: number; novelty_appetite: number; recent_genres: string[] }
export interface Home { user_id: number; viewer?: ViewerDNA | null; arc: { caption: string; items: Movie[] }; rails: Rail[] }
export interface TasteNode { id: number; title: string; x: number; y: number; genre: string; role: 'seen' | 'rec'; poster_url?: string | null }
export interface TasteMapData { nodes: TasteNode[]; edges: [number, number][]; arc: number[] }
export interface Profile {
  user_id: number
  n_ratings: number
  top_genres: string[]
  fav_title: string | null
  fav_poster: string | null
}
export interface AllUser { user_id: number; n_ratings: number; top_genres: string[]; fav_poster: string | null }
export interface MovieDetail extends Movie {
  year?: number | null
  runtime?: number | null
  vote_average?: number | null
  cast?: string[]
  director?: string | null
  trailer_key?: string | null
  backdrop_url?: string | null
  similar?: Movie[]
  for_you?: Movie[]
}
export interface PersonResult { name: string; n_movies: number; keywords: string[]; movies: Movie[] }

export interface ChatTurn { role: 'user' | 'assistant'; text: string }
export interface ChatResponse { action: string; reply: string; movies: Movie[]; filters?: Record<string, unknown> }

const get = <T,>(path: string) => fetch(`${BASE}${path}`).then((r) => r.json() as Promise<T>)

export const api = {
  models: () => get<ModelInfo[]>('/api/models'),
  metrics: () => get<Metric[]>('/api/metrics'),
  genres: () => get<string[]>('/api/genres'),
  profiles: () => get<Profile[]>('/api/profiles'),
  allUsers: () => get<AllUser[]>('/api/all_users'),
  movie: (userId: number, movieId: number) => get<MovieDetail>(`/api/movie/${movieId}?user_id=${userId}`),
  person: (userId: number, name: string) => get<PersonResult>(`/api/person?name=${encodeURIComponent(name)}&user_id=${userId}`),
  tasteMap: (userId: number) => get<TasteMapData>(`/api/taste_map?user_id=${userId}`),
  home: (userId: number, explore: number, genre: string, anchor = 0, model = '') =>
    get<Home>(`/api/home?user_id=${userId}&explore=${explore}&genre=${encodeURIComponent(genre)}&anchor=${anchor}&model=${encodeURIComponent(model)}`),
  chat: (userId: number, messages: ChatTurn[]) =>
    fetch(`${BASE}/api/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, messages }),
    }).then((r) => r.json() as Promise<ChatResponse>),
}
