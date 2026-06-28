import { useEffect, useMemo, useState } from 'react'
import { api, type Movie, type ModelInfo, type UserInfo, type Metric } from './api'

export default function App() {
  const [models, setModels] = useState<ModelInfo[]>([])
  const [users, setUsers] = useState<UserInfo[]>([])
  const [metrics, setMetrics] = useState<Metric[]>([])

  const [userId, setUserId] = useState<number | null>(null)
  const [model, setModel] = useState<string>('most_popular')
  const [n, setN] = useState<number>(12)

  const [items, setItems] = useState<Movie[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initial load: models, users, metrics.
  useEffect(() => {
    Promise.all([api.models(), api.users(40), api.metrics()])
      .then(([m, u, mt]) => {
        setModels(m)
        setUsers(u)
        setMetrics(mt)
        if (m.length) setModel(m[0].id)
        if (u.length) setUserId(u[0].user_id)
      })
      .catch(() => setError('Cannot reach the API. Is the backend running on :8000?'))
  }, [])

  // Fetch recommendations whenever the selection changes.
  useEffect(() => {
    if (userId == null || !model) return
    setLoading(true)
    setError(null)
    api
      .recommend(userId, model, n)
      .then((r) => setItems(r.items ?? []))
      .catch(() => setError('Recommendation request failed.'))
      .finally(() => setLoading(false))
  }, [userId, model, n])

  const activeModel = useMemo(() => models.find((m) => m.id === model), [models, model])

  return (
    <div className="min-h-full text-zinc-100">
      {/* Header */}
      <header className="border-b border-white/10 bg-gradient-to-r from-indigo-600/20 via-fuchsia-600/10 to-transparent">
        <div className="mx-auto max-w-6xl px-6 py-7">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎬</span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                CineMatch
              </h1>
              <p className="text-sm text-zinc-400">
                MovieLens recommender prototype · multi-algorithm comparison
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Controls */}
        <section className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:grid-cols-3">
          <Control label="User">
            <select
              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              value={userId ?? ''}
              onChange={(e) => setUserId(Number(e.target.value))}
            >
              {users.map((u) => (
                <option key={u.user_id} value={u.user_id}>
                  User {u.user_id} · {u.n_ratings} ratings
                </option>
              ))}
            </select>
          </Control>

          <Control label="Algorithm">
            <select
              className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </Control>

          <Control label={`How many · ${n}`}>
            <input
              type="range"
              min={4}
              max={24}
              value={n}
              onChange={(e) => setN(Number(e.target.value))}
              className="w-full accent-indigo-400"
            />
          </Control>

          {activeModel && (
            <p className="text-xs text-zinc-500 sm:col-span-3">{activeModel.description}</p>
          )}
        </section>

        {error && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Recommendations grid */}
        <section className="mt-8">
          <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-400">
            Recommended for User {userId}
          </h2>

          {loading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: n }).map((_, i) => (
                <div key={i} className="h-36 animate-pulse rounded-xl bg-white/5" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {items.map((m, i) => (
                <MovieCard key={m.movie_id} movie={m} rank={i + 1} />
              ))}
            </div>
          )}
        </section>

        {/* Metrics panel */}
        {metrics.length > 0 && <MetricsTable metrics={metrics} />}
      </main>
    </div>
  )
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-400">
        {label}
      </span>
      {children}
    </label>
  )
}

function MovieCard({ movie, rank }: { movie: Movie; rank: number }) {
  return (
    <a
      href={movie.tmdb_url ?? '#'}
      target="_blank"
      rel="noreferrer"
      className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-zinc-800/60 to-zinc-900 p-4 transition hover:border-indigo-400/50 hover:shadow-lg hover:shadow-indigo-500/10"
    >
      <div className="mb-3 flex items-start justify-between">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500/20 text-xs font-semibold text-indigo-300">
          {rank}
        </span>
        {movie.score != null && (
          <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">
            {movie.score}
          </span>
        )}
      </div>
      <h3 className="text-sm font-medium leading-snug text-zinc-100 group-hover:text-white">
        {movie.title}
      </h3>
      <div className="mt-3 flex flex-wrap gap-1">
        {movie.genres.slice(0, 3).map((g) => (
          <span key={g} className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-zinc-400">
            {g}
          </span>
        ))}
      </div>
    </a>
  )
}

function MetricsTable({ metrics }: { metrics: Metric[] }) {
  const cols: [string, keyof Metric][] = [
    ['Precision@10', 'precision@k'],
    ['Recall@10', 'recall@k'],
    ['NDCG@10', 'ndcg@k'],
    ['MRR@10', 'mrr@k'],
    ['Coverage', 'coverage'],
  ]
  return (
    <section className="mt-12">
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-zinc-400">
        Offline evaluation
      </h2>
      <div className="overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-zinc-400">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Model</th>
              {cols.map(([label]) => (
                <th key={label} className="px-4 py-2.5 text-right font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <tr key={m.model} className="border-t border-white/5">
                <td className="px-4 py-2.5 font-medium text-zinc-200">{m.model}</td>
                {cols.map(([, key]) => (
                  <td key={key} className="px-4 py-2.5 text-right tabular-nums text-zinc-400">
                    {(m[key] as number).toFixed(3)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-zinc-600">
        Evaluated on a held-out 20% per-user split · relevance = rated ≥ 3.5
      </p>
    </section>
  )
}
