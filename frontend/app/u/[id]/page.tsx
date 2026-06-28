'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { api, type Home } from '@/lib/api'
import { Hero, ArcRail, Rail } from '@/app/components'

export default function HomePage() {
  const params = useParams<{ id: string }>()
  const userId = Number(params.id)

  const [genres, setGenres] = useState<string[]>([])
  const [explore, setExplore] = useState(0.4)
  const [genre, setGenre] = useState('')
  const [home, setHome] = useState<Home | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { api.genres().then(setGenres).catch(() => {}) }, [])

  useEffect(() => {
    if (!userId) return
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
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-5 gap-y-3 px-6 py-3">
          <Link href="/" className="text-2xl font-extrabold tracking-tight text-red-600">CINE<span className="text-zinc-100">MATCH</span></Link>
          <Link href="/" className="text-xs text-zinc-400 transition hover:text-white">← Profiles</Link>
          <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-zinc-300">Viewer #{userId}</span>

          <label className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-zinc-500">
            Genre
            <select className="rounded-md border border-white/10 bg-zinc-900 px-2 py-1.5 text-sm normal-case text-zinc-100 outline-none focus:border-red-500"
              value={genre} onChange={(e) => setGenre(e.target.value)}>
              <option value="">All</option>
              {genres.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>

          <label className="flex flex-1 items-center gap-3 text-[11px] uppercase tracking-wide text-zinc-500" style={{ minWidth: 220 }}>
            Comfort
            <input type="range" min={0} max={1} step={0.05} value={explore}
              onChange={(e) => setExplore(Number(e.target.value))}
              className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-zinc-700 accent-red-600" />
            Discovery
          </label>

          <Link href={`/u/${userId}/chat`} className="text-xs font-medium text-red-400 transition hover:text-red-300">✨ AI Guide</Link>
          <Link href="/evaluation" className="text-xs text-zinc-400 transition hover:text-white">Evaluation</Link>
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
      </main>
    </div>
  )
}
