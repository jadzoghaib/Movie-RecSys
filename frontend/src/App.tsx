import { useEffect, useState } from 'react'
import { api, type Movie, type UserInfo, type Metric, type Home, type Rail as RailT } from './api'

export default function App() {
  const [users, setUsers] = useState<UserInfo[]>([])
  const [genres, setGenres] = useState<string[]>([])
  const [metrics, setMetrics] = useState<Metric[]>([])

  const [userId, setUserId] = useState<number | null>(null)
  const [explore, setExplore] = useState(0.4)
  const [genre, setGenre] = useState('')

  const [home, setHome] = useState<Home | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([api.users(40), api.genres(), api.metrics()])
      .then(([u, g, m]) => {
        setUsers(u); setGenres(g); setMetrics(m)
        if (u.length) setUserId(u[0].user_id)
      })
      .catch(() => setError('Cannot reach the API. Is the backend running on :8000?'))
  }, [])

  useEffect(() => {
    if (userId == null) return
    setLoading(true)
    api.home(userId, explore, genre)
      .then(setHome)
      .catch(() => setError('Failed to load recommendations.'))
      .finally(() => setLoading(false))
  }, [userId, explore, genre])

  return (
    <div className="min-h-full text-zinc-100">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-zinc-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎬</span>
            <span className="text-xl font-semibold tracking-tight">CineMatch</span>
          </div>

          <label className="flex items-center gap-2 text-xs text-zinc-400">
            User
            <select
              className="rounded-lg border border-white/10 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-indigo-400"
              value={userId ?? ''}
              onChange={(e) => setUserId(Number(e.target.value))}
            >
              {users.map((u) => (
                <option key={u.user_id} value={u.user_id}>#{u.user_id} · {u.n_ratings} ratings</option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs text-zinc-400">
            Genre
            <select
              className="rounded-lg border border-white/10 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 outline-none focus:border-indigo-400"
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
            >
              <option value="">All</option>
              {genres.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>

          <label className="flex flex-1 items-center gap-2 text-xs text-zinc-400" style={{ minWidth: 220 }}>
            Comfort
            <input
              type="range" min={0} max={1} step={0.05} value={explore}
              onChange={(e) => setExplore(Number(e.target.value))}
              className="flex-1 accent-fuchsia-500"
            />
            Discovery
          </label>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
        )}

        {home?.arc?.items?.length ? <ArcRail caption={home.arc.caption} items={home.arc.items} /> : null}

        {loading && !home ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : (
          home?.rails.map((r) => <Rail key={r.title} rail={r} />)
        )}

        {metrics.length > 0 && <MetricsTable metrics={metrics} />}
      </main>
    </div>
  )
}

function ArcRail({ caption, items }: { caption: string; items: Movie[] }) {
  return (
    <section className="mb-10 rounded-2xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-600/10 via-indigo-600/5 to-transparent p-5">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-lg">✨</span>
        <h2 className="text-base font-semibold text-fuchsia-200">Tonight's Arc</h2>
      </div>
      <p className="mb-4 text-sm text-zinc-400">{caption}</p>
      <div className="flex items-stretch gap-3 overflow-x-auto pb-1">
        {items.map((m, i) => (
          <div key={m.movie_id} className="flex items-center gap-3">
            <div className="w-[150px] shrink-0">
              <PosterCard movie={m} badge={`${i + 1}`} />
            </div>
            {i < items.length - 1 && <span className="text-2xl text-fuchsia-400/60">→</span>}
          </div>
        ))}
      </div>
    </section>
  )
}

function Rail({ rail }: { rail: RailT }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-300">{rail.title}</h2>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {rail.items.map((m) => (
          <div key={m.movie_id} className="w-[140px] shrink-0">
            <PosterCard movie={m} />
          </div>
        ))}
      </div>
    </section>
  )
}

function PosterCard({ movie, badge }: { movie: Movie; badge?: string }) {
  return (
    <a
      href={movie.tmdb_url ?? '#'}
      target="_blank"
      rel="noreferrer"
      title={movie.overview || movie.title}
      className="group block overflow-hidden rounded-xl border border-white/10 bg-zinc-900 transition hover:border-indigo-400/60 hover:shadow-lg hover:shadow-indigo-500/20"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-zinc-800">
        {movie.poster_url ? (
          <img src={movie.poster_url} alt={movie.title} loading="lazy"
               className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-700 to-zinc-900 p-2 text-center text-[11px] text-zinc-300">
            {movie.title}
          </div>
        )}
        {badge && (
          <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-fuchsia-600/90 text-xs font-bold text-white">
            {badge}
          </span>
        )}
      </div>
      <div className="p-2">
        <h3 className="line-clamp-2 text-[11px] font-medium leading-snug text-zinc-200">{movie.title}</h3>
        <div className="mt-1 flex flex-wrap gap-1">
          {movie.genres.slice(0, 2).map((g) => (
            <span key={g} className="rounded-full bg-white/5 px-1.5 py-0.5 text-[9px] text-zinc-400">{g}</span>
          ))}
        </div>
      </div>
    </a>
  )
}

function MetricsTable({ metrics }: { metrics: Metric[] }) {
  const cols: [string, keyof Metric][] = [
    ['P@10', 'precision@k'], ['NDCG', 'ndcg@k'], ['Coverage', 'coverage'],
  ]
  const extra: [string, string][] = [['Diversity', 'diversity'], ['Novelty', 'novelty'], ['Serendipity', 'serendipity']]
  return (
    <section className="mt-12">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">Offline evaluation</h2>
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-zinc-400">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Model</th>
              {cols.map(([l]) => <th key={l} className="px-4 py-2.5 text-right font-medium">{l}</th>)}
              {extra.map(([l]) => <th key={l} className="px-4 py-2.5 text-right font-medium">{l}</th>)}
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <tr key={m.model} className="border-t border-white/5">
                <td className="px-4 py-2.5 font-medium text-zinc-200">{m.model}</td>
                {cols.map(([, k]) => (
                  <td key={k} className="px-4 py-2.5 text-right tabular-nums text-zinc-400">{(m[k] as number).toFixed(3)}</td>
                ))}
                {extra.map(([, k]) => (
                  <td key={k} className="px-4 py-2.5 text-right tabular-nums text-zinc-500">
                    {(m as any)[k] != null ? (m as any)[k].toFixed(2) : '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
