'use client'

import { useEffect, useRef, useState } from 'react'
import { api, type Movie, type UserInfo, type Metric, type Home, type Rail as RailT } from '@/lib/api'

export default function Page() {
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

  const hero = home?.rails?.[0]?.items?.[0]

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[#0b0b0f]/85 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3">
          <span className="text-2xl font-extrabold tracking-tight text-red-600">CINE<span className="text-zinc-100">MATCH</span></span>

          <label className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-zinc-500">
            User
            <select className="rounded-md border border-white/10 bg-zinc-900 px-2 py-1.5 text-sm normal-case text-zinc-100 outline-none focus:border-red-500"
              value={userId ?? ''} onChange={(e) => setUserId(Number(e.target.value))}>
              {users.map((u) => <option key={u.user_id} value={u.user_id}>#{u.user_id} · {u.n_ratings} ratings</option>)}
            </select>
          </label>

          <label className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-zinc-500">
            Genre
            <select className="rounded-md border border-white/10 bg-zinc-900 px-2 py-1.5 text-sm normal-case text-zinc-100 outline-none focus:border-red-500"
              value={genre} onChange={(e) => setGenre(e.target.value)}>
              <option value="">All</option>
              {genres.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>

          <label className="flex flex-1 items-center gap-3 text-[11px] uppercase tracking-wide text-zinc-500" style={{ minWidth: 240 }}>
            Comfort
            <input type="range" min={0} max={1} step={0.05} value={explore}
              onChange={(e) => setExplore(Number(e.target.value))}
              className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-zinc-700 accent-red-600" />
            Discovery
          </label>
        </div>
      </header>

      {error && (
        <div className="mx-auto mt-6 max-w-[1400px] px-6">
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
        </div>
      )}

      {hero && <Hero movie={hero} />}

      <main className="mx-auto max-w-[1400px] px-6 pb-16 pt-8">
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

function Hero({ movie }: { movie: Movie }) {
  return (
    <section className="relative overflow-hidden">
      {movie.poster_url && (
        <div className="absolute inset-0 scale-110 bg-cover bg-center opacity-30 blur-2xl"
             style={{ backgroundImage: `url(${movie.poster_url})` }} />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0b0b0f] via-[#0b0b0f]/85 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0f] to-transparent" />
      <div className="relative mx-auto flex max-w-[1400px] items-center gap-8 px-6 py-10">
        {movie.poster_url && (
          <img src={movie.poster_url} alt={movie.title}
               className="hidden w-48 shrink-0 rounded-xl shadow-2xl shadow-black/60 ring-1 ring-white/10 sm:block" />
        )}
        <div className="max-w-2xl">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-red-500">Top pick for you</p>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight">{movie.title}</h1>
          <div className="mt-3 flex flex-wrap gap-2">
            {movie.genres.map((g) => (
              <span key={g} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-zinc-300">{g}</span>
            ))}
          </div>
          {movie.overview && <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-zinc-300">{movie.overview}</p>}
          <div className="mt-5 flex gap-3">
            <a href={movie.tmdb_url ?? '#'} target="_blank" rel="noreferrer"
               className="rounded-md bg-red-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-red-500">
              ▶ View on TMDB
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

function ArcRail({ caption, items }: { caption: string; items: Movie[] }) {
  return (
    <section className="mb-10 rounded-2xl border border-fuchsia-500/25 bg-gradient-to-br from-fuchsia-600/10 via-indigo-600/5 to-transparent p-5">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-lg">✨</span>
        <h2 className="text-base font-semibold text-fuchsia-200">Tonight&apos;s Arc</h2>
        <span className="rounded-full bg-fuchsia-500/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-fuchsia-300">a curated journey</span>
      </div>
      <p className="mb-4 text-sm text-zinc-400">{caption}</p>
      <div className="flex items-stretch gap-3 overflow-x-auto pb-1">
        {items.map((m, i) => (
          <div key={m.movie_id} className="flex items-center gap-3">
            <div className="w-[150px] shrink-0"><PosterCard movie={m} badge={`${i + 1}`} /></div>
            {i < items.length - 1 && <span className="text-2xl text-fuchsia-400/60">→</span>}
          </div>
        ))}
      </div>
    </section>
  )
}

function Rail({ rail }: { rail: RailT }) {
  const ref = useRef<HTMLDivElement>(null)
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * 600, behavior: 'smooth' })
  return (
    <section className="group/rail mb-8">
      <h2 className="mb-3 text-base font-semibold text-zinc-200">{rail.title}</h2>
      <div className="relative">
        <button onClick={() => scroll(-1)} aria-label="scroll left"
          className="absolute -left-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-zinc-200 opacity-0 transition group-hover/rail:flex group-hover/rail:opacity-100 hover:bg-black">‹</button>
        <div ref={ref} className="flex gap-3 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {rail.items.map((m) => (
            <div key={m.movie_id} className="w-[150px] shrink-0"><PosterCard movie={m} /></div>
          ))}
        </div>
        <button onClick={() => scroll(1)} aria-label="scroll right"
          className="absolute -right-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-zinc-200 opacity-0 transition group-hover/rail:flex group-hover/rail:opacity-100 hover:bg-black">›</button>
      </div>
    </section>
  )
}

function PosterCard({ movie, badge }: { movie: Movie; badge?: string }) {
  return (
    <a href={movie.tmdb_url ?? '#'} target="_blank" rel="noreferrer" title={movie.overview || movie.title}
      className="group relative block overflow-hidden rounded-lg bg-zinc-900 ring-1 ring-white/10 transition duration-200 hover:z-10 hover:scale-[1.04] hover:ring-red-500/50">
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-zinc-800">
        {movie.poster_url ? (
          <img src={movie.poster_url} alt={movie.title} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-700 to-zinc-900 p-2 text-center text-[11px] text-zinc-300">{movie.title}</div>
        )}
        {badge && (
          <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-fuchsia-600 text-xs font-bold text-white shadow">{badge}</span>
        )}
        <div className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-black/95 via-black/70 to-transparent p-2 transition group-hover:translate-y-0">
          <p className="line-clamp-2 text-[11px] font-medium text-white">{movie.title}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {movie.genres.slice(0, 2).map((g) => (
              <span key={g} className="rounded-full bg-white/15 px-1.5 py-0.5 text-[9px] text-zinc-200">{g}</span>
            ))}
          </div>
        </div>
      </div>
    </a>
  )
}

function MetricsTable({ metrics }: { metrics: Metric[] }) {
  const cols: [string, keyof Metric][] = [['P@10', 'precision@k'], ['NDCG', 'ndcg@k'], ['Coverage', 'coverage']]
  const extra: [string, keyof Metric][] = [['Diversity', 'diversity'], ['Novelty', 'novelty'], ['Serendipity', 'serendipity']]
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
                {cols.map(([, k]) => <td key={k} className="px-4 py-2.5 text-right tabular-nums text-zinc-400">{(m[k] as number).toFixed(3)}</td>)}
                {extra.map(([, k]) => {
                  const v = m[k] as number | undefined
                  return <td key={k} className="px-4 py-2.5 text-right tabular-nums text-zinc-500">{v != null ? v.toFixed(2) : '—'}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
