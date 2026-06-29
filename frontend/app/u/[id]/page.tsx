'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, FlaskConical, X } from 'lucide-react'
import { api, type Home, type Movie, type ModelInfo } from '@/lib/api'
import {
  Hero, ArcRail, Rail, SkeletonRail, discoveryLabel, explorationLevel, explorationHint,
  useLikes, CardActionsProvider,
} from '@/app/components'

export default function HomePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const userId = Number(params.id)

  const [genres, setGenres] = useState<string[]>([])
  const [models, setModels] = useState<ModelInfo[]>([])
  const [model, setModel] = useState('')          // '' = production stack (LTR hybrid + re-rank)
  const [explore, setExplore] = useState(0.4)
  const [debExplore, setDebExplore] = useState(0.4)
  const [genre, setGenre] = useState('')
  const [anchor, setAnchor] = useState<Movie | null>(null)
  const [mood, setMood] = useState('')

  const [home, setHome] = useState<Home | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { likes, toggle } = useLikes()

  useEffect(() => { api.genres().then(setGenres).catch(() => {}) }, [])
  useEffect(() => { api.models().then(setModels).catch(() => {}) }, [])
  // deep-link from the evaluation table: /u/[id]?model=item_item_cf
  useEffect(() => { const m = new URLSearchParams(window.location.search).get('model'); if (m) setModel(m) }, [])
  useEffect(() => { const t = setTimeout(() => setDebExplore(explore), 200); return () => clearTimeout(t) }, [explore])

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    api.home(userId, debExplore, genre, anchor?.movie_id ?? 0, model)
      .then(setHome)
      .catch(() => setError('Failed to load recommendations.'))
      .finally(() => setLoading(false))
  }, [userId, debExplore, genre, anchor, model])

  const hero = home?.rails?.[0]?.items?.[0]
  const activeModelLabel = models.find((m) => m.id === model)?.label

  return (
    <CardActionsProvider value={{ isLiked: (id) => likes.includes(id), toggleLike: toggle, onMoreLikeThis: setAnchor, onOpen: (m) => router.push(`/u/${userId}/m/${m.movie_id}`) }}>
      <div className="min-h-full">
        {/* header */}
        <header className="sticky top-0 z-40 border-b border-white/5 bg-[#0b0b0f]/85 backdrop-blur-md">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3.5">
            <div className="flex items-center gap-5">
              <Link href="/" className="text-2xl font-extrabold tracking-tight text-red-600">CINE<span className="text-zinc-100">MATCH</span></Link>
              <Link href="/" className="hidden text-xs text-zinc-400 transition hover:text-white sm:block">← Profiles</Link>
              <span className="hidden rounded-full bg-white/5 px-2.5 py-1 text-xs font-medium text-zinc-300 sm:block">Viewer #{userId}</span>
            </div>
            <div className="flex items-center gap-5">
              <Link href={`/u/${userId}/chat`} className="flex items-center gap-1.5 text-xs font-medium text-fuchsia-400 transition hover:text-fuchsia-300">
                <Sparkles className="h-3.5 w-3.5" /> AI Guide
              </Link>
              <Link href="/evaluation" className="text-xs text-zinc-400 transition hover:text-white">Evaluation</Link>
            </div>
          </div>
        </header>

        {/* filter toolbar */}
        <div className="border-b border-white/5 bg-zinc-950/50">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-8 gap-y-3 px-6 py-3">
            <label className="flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
              Genre
              <select className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-1.5 text-sm normal-case text-zinc-100 outline-none transition focus:border-red-500 focus:ring-1 focus:ring-red-500"
                value={genre} onChange={(e) => setGenre(e.target.value)}>
                <option value="">All genres</option>
                {genres.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </label>

            <label className="flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-zinc-500">
              <span className="flex items-center gap-1.5"><FlaskConical className="h-3.5 w-3.5" /> Model</span>
              <select className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-1.5 text-sm normal-case text-zinc-100 outline-none transition focus:border-red-500 focus:ring-1 focus:ring-red-500"
                value={model} onChange={(e) => setModel(e.target.value)}>
                <option value="">Production stack (LTR + re-rank)</option>
                {models.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </label>

            <div className="flex min-w-[320px] max-w-xl flex-1 flex-col gap-1">
              <div className="flex items-center gap-4">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">Safe</span>
                <input type="range" min={0} max={1} step={0.05} value={explore}
                  onChange={(e) => setExplore(Number(e.target.value))}
                  aria-valuetext={discoveryLabel(explore)}
                  style={{ background: `linear-gradient(to right, #dc2626 ${explore * 100}%, #27272a ${explore * 100}%)` }}
                  className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full outline-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md" />
                <span className="text-xs font-medium uppercase tracking-wide text-fuchsia-500/70">Bold</span>
                <span className="w-[150px] shrink-0 rounded bg-white/10 px-2 py-0.5 text-center text-[11px] text-zinc-200">
                  Exploration: {explorationLevel(explore)}
                </span>
              </div>
              <p className="pl-[42px] text-[11px] leading-relaxed text-zinc-500">{explorationHint(explore)}</p>
            </div>
          </div>
        </div>

        {/* AI mood entry */}
        <div className="border-b border-white/5">
          <form onSubmit={(e) => { e.preventDefault(); if (mood.trim()) router.push(`/u/${userId}/chat?q=${encodeURIComponent(mood)}`) }}
            className="mx-auto flex max-w-[1400px] gap-2 px-6 py-3">
            <input value={mood} onChange={(e) => setMood(e.target.value)}
              placeholder="Describe what you're in the mood for — e.g. “a dark sci-fi but not too slow”"
              className="flex-1 rounded-xl border border-white/10 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-fuchsia-500" />
            <button type="submit" className="flex items-center gap-1.5 rounded-xl bg-fuchsia-600 px-5 text-sm font-semibold text-white transition hover:bg-fuchsia-500">
              <Sparkles className="h-4 w-4" /> Ask AI
            </button>
          </form>
        </div>

        {/* active-model banner (from the evaluation table) */}
        {activeModelLabel && (
          <div className="mx-auto mt-6 max-w-[1400px] px-6">
            <div className="flex items-center gap-3 rounded-xl border border-red-500/25 bg-red-600/10 px-4 py-2.5 text-sm text-zinc-200">
              <FlaskConical className="h-4 w-4 text-red-400" />
              <span>“Top picks” is driven by <span className="font-semibold text-white">{activeModelLabel}</span> — watch how this model&apos;s metrics translate into real picks.</span>
              <button onClick={() => setModel('')} className="ml-auto flex items-center gap-1 text-xs text-red-300 transition hover:text-red-200">
                <X className="h-3.5 w-3.5" /> back to production stack
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mx-auto mt-6 max-w-[1400px] px-6">
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
          </div>
        )}

        {hero && <Hero movie={hero} loading={loading} />}

        <main className="mx-auto max-w-[1400px] px-6 pb-16 pt-12">
          {anchor && (
            <div className="mb-8 flex items-center gap-3 rounded-xl border border-fuchsia-500/20 bg-fuchsia-600/10 px-4 py-2.5 text-sm text-zinc-200">
              <Sparkles className="h-4 w-4 text-fuchsia-300" />
              <span>Exploring from <span className="font-semibold text-white">{anchor.title}</span> — the “Because you liked” rail and Tonight&apos;s Arc now follow this pick.</span>
              <button onClick={() => setAnchor(null)} className="ml-auto text-xs text-fuchsia-300 transition hover:text-fuchsia-200">clear</button>
            </div>
          )}

          {loading || !home ? (
            <>{Array.from({ length: 4 }).map((_, i) => <SkeletonRail key={i} />)}</>
          ) : (
            <>
              {home.arc?.items?.length ? <ArcRail caption={home.arc.caption} items={home.arc.items} journeyFrom={anchor?.title} /> : null}
              {home.rails.map((r) => <Rail key={r.title} rail={r} />)}
            </>
          )}
        </main>
      </div>
    </CardActionsProvider>
  )
}
