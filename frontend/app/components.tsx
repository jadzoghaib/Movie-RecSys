'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Play, Sparkles, Lightbulb, ArrowRight, ChevronLeft, ChevronRight, Heart, ExternalLink,
} from 'lucide-react'
import type { Movie, Rail as RailT } from '@/lib/api'

/* ---------- likes (localStorage feedback loop) ---------- */
const LIKES_KEY = 'cinematch_likes'

export function useLikes() {
  const [likes, setLikes] = useState<number[]>([])
  useEffect(() => {
    try { setLikes(JSON.parse(localStorage.getItem(LIKES_KEY) || '[]')) } catch {}
  }, [])
  const toggle = (id: number) =>
    setLikes((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      try { localStorage.setItem(LIKES_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  return { likes, toggle }
}

type CardActions = {
  isLiked: (id: number) => boolean
  toggleLike: (id: number) => void
  onMoreLikeThis?: (m: Movie) => void
}
const CardActionsContext = createContext<CardActions>({ isLiked: () => false, toggleLike: () => {} })
export function CardActionsProvider({ value, children }: { value: CardActions; children: ReactNode }) {
  return <CardActionsContext.Provider value={value}>{children}</CardActionsContext.Provider>
}

/* ---------- discovery dial label ---------- */
export function discoveryLabel(v: number) {
  if (v <= 0.2) return 'Comfort picks'
  if (v <= 0.4) return 'Mostly familiar'
  if (v <= 0.6) return 'Balanced'
  if (v <= 0.8) return 'Adventurous'
  return 'Pure discovery'
}

/* ---------- skeletons ---------- */
export function SkeletonCard() {
  return (
    <div className="w-[150px] shrink-0">
      <div className="aspect-[2/3] w-full animate-pulse rounded-xl bg-zinc-800/60 ring-1 ring-white/5" />
      <div className="mt-3 h-3 w-3/4 animate-pulse rounded bg-zinc-800/60" />
      <div className="mt-1.5 h-2 w-1/2 animate-pulse rounded bg-zinc-800/60" />
    </div>
  )
}
export function SkeletonRail() {
  return (
    <section className="mb-10">
      <div className="mb-4 h-5 w-48 animate-pulse rounded bg-zinc-800/60" />
      <div className="flex gap-3">{Array.from({ length: 7 }).map((_, i) => <SkeletonCard key={i} />)}</div>
    </section>
  )
}

/* ---------- hero ---------- */
export function Hero({ movie, loading }: { movie: Movie; loading?: boolean }) {
  const { isLiked, toggleLike, onMoreLikeThis } = useContext(CardActionsContext)
  const liked = isLiked(movie.movie_id)
  return (
    <section className="relative overflow-hidden border-b border-white/5">
      {movie.poster_url && (
        <div className="absolute inset-0 scale-110 bg-cover bg-center blur-2xl transition-opacity duration-700"
             style={{ backgroundImage: `url(${movie.poster_url})`, opacity: loading ? 0.06 : 0.28 }} />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0b0b0f] via-[#0b0b0f]/85 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0f] to-transparent" />
      <div className="relative mx-auto flex max-w-[1400px] items-center gap-8 px-6 py-12 sm:py-16">
        {movie.poster_url && (
          <img src={movie.poster_url} alt={movie.title}
               className={`w-32 shrink-0 rounded-xl shadow-2xl shadow-black/70 ring-1 ring-white/10 transition-all duration-700 sm:w-56 ${loading ? 'scale-95 opacity-50 blur-sm' : 'opacity-100'}`} />
        )}
        <div className={`max-w-xl transition-all duration-700 ${loading ? 'translate-y-2 opacity-50' : 'opacity-100'}`}>
          <p className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-red-500">
            <Sparkles className="h-3.5 w-3.5" /> Top pick for you
          </p>
          <h1 className="mb-4 text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">{movie.title}</h1>
          <div className="mb-4 flex flex-wrap gap-2">
            {movie.chips?.map((c) => <Chip key={c}>{c}</Chip>)}
            {movie.genres.map((g) => (
              <span key={g} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-zinc-300">{g}</span>
            ))}
          </div>
          {movie.why && (
            <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-white/5 bg-white/5 p-3 backdrop-blur-sm">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
              <p className="text-sm font-medium leading-relaxed text-zinc-200">{movie.why}</p>
            </div>
          )}
          {movie.overview && <p className="mb-6 line-clamp-2 text-sm leading-relaxed text-zinc-400 sm:line-clamp-3">{movie.overview}</p>}
          <div className="flex flex-wrap gap-3">
            <button onClick={() => toggleLike(movie.movie_id)} aria-pressed={liked}
              className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold ring-1 transition ${liked ? 'bg-red-600 text-white ring-red-500' : 'bg-zinc-800 text-white ring-white/10 hover:bg-zinc-700'}`}>
              <Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} /> {liked ? 'Liked' : 'Like'}
            </button>
            {onMoreLikeThis && (
              <button onClick={() => onMoreLikeThis(movie)}
                className="flex items-center gap-2 rounded-lg bg-fuchsia-600/15 px-4 py-2.5 text-sm font-semibold text-fuchsia-300 ring-1 ring-fuchsia-500/30 transition hover:bg-fuchsia-600/25">
                <Sparkles className="h-4 w-4" /> More like this
              </button>
            )}
            <a href={movie.tmdb_url ?? '#'} target="_blank" rel="noreferrer"
               className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white">
              <Play className="h-4 w-4 fill-current" /> View on TMDB
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-red-500/20 bg-red-600/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-red-300">
      {children}
    </span>
  )
}

/* ---------- arc ---------- */
export function ArcRail({ caption, items }: { caption: string; items: Movie[] }) {
  return (
    <section className="mb-12 rounded-2xl border border-fuchsia-500/25 bg-gradient-to-br from-fuchsia-600/10 via-indigo-600/5 to-transparent p-6 shadow-lg shadow-fuchsia-900/10">
      <div className="mb-1.5 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-fuchsia-300" />
        <h2 className="text-lg font-bold text-fuchsia-100">Tonight&apos;s Arc</h2>
        <span className="rounded-full bg-fuchsia-500/15 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-fuchsia-300">a curated journey</span>
      </div>
      <p className="mb-5 text-sm text-zinc-300">{caption}</p>
      <div className="flex items-stretch gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((m, i) => (
          <div key={m.movie_id} className="flex items-center gap-3">
            <div className="w-[150px] shrink-0">
              <PosterCard movie={m} badge={`${i + 1}`} />
              {m.arc_note && <p className="mt-1.5 text-center text-[11px] font-medium text-fuchsia-300/90">{m.arc_note}</p>}
            </div>
            {i < items.length - 1 && <ArrowRight className="h-5 w-5 shrink-0 text-fuchsia-400/60" />}
          </div>
        ))}
      </div>
    </section>
  )
}

/* ---------- rail ---------- */
export function Rail({ rail }: { rail: RailT }) {
  const ref = useRef<HTMLDivElement>(null)
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * 620, behavior: 'smooth' })
  return (
    <section className="group/rail mb-10">
      <h2 className="text-lg font-bold text-white">{rail.title}</h2>
      {rail.subtitle && <p className="mb-3 text-[11px] uppercase tracking-wide text-zinc-500">{rail.subtitle}</p>}
      <div className="relative">
        <button onClick={() => scroll(-1)} aria-label="Scroll left"
          className="absolute -left-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-zinc-200 opacity-0 transition group-hover/rail:flex group-hover/rail:opacity-100 hover:bg-black"><ChevronLeft className="h-5 w-5" /></button>
        <div ref={ref} className="flex gap-3 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {rail.items.map((m) => <div key={m.movie_id} className="w-[150px] shrink-0"><PosterCard movie={m} /></div>)}
        </div>
        <button onClick={() => scroll(1)} aria-label="Scroll right"
          className="absolute -right-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-zinc-200 opacity-0 transition group-hover/rail:flex group-hover/rail:opacity-100 hover:bg-black"><ChevronRight className="h-5 w-5" /></button>
      </div>
    </section>
  )
}

/* ---------- poster card (visible why + feedback loop, keyboard-accessible) ---------- */
export function PosterCard({ movie, badge }: { movie: Movie; badge?: string }) {
  const { isLiked, toggleLike, onMoreLikeThis } = useContext(CardActionsContext)
  const liked = isLiked(movie.movie_id)
  return (
    <div className="group relative w-full">
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-white/10 transition-all duration-300 focus-within:ring-2 focus-within:ring-red-500 group-hover:-translate-y-1 group-hover:shadow-xl group-hover:ring-white/30">
        {movie.poster_url ? (
          <img src={movie.poster_url} alt={movie.title} loading="lazy"
               className="h-full w-full object-cover transition duration-500 group-hover:scale-105 group-hover:opacity-40" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-700 to-zinc-900 p-2 text-center text-[11px] text-zinc-300">{movie.title}</div>
        )}
        {badge && <span className="absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-fuchsia-600 text-xs font-bold text-white shadow">{badge}</span>}

        {/* always visible: title + 1-line why */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 transition-opacity duration-300 group-hover:opacity-0 group-focus-within:opacity-0">
          <p className="line-clamp-1 text-xs font-bold text-white">{movie.title}</p>
          {movie.why && (
            <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-red-300">
              <Lightbulb className="h-3 w-3 shrink-0" /><span className="line-clamp-1">{movie.why}</span>
            </p>
          )}
        </div>

        {/* hover / keyboard-focus: actions + full why + genres */}
        <div className="absolute inset-0 flex flex-col justify-between bg-black/60 p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
          <div className="flex justify-end gap-1.5">
            <button onClick={() => toggleLike(movie.movie_id)} aria-pressed={liked} aria-label={liked ? 'Unlike' : 'Like'}
              className={`flex h-7 w-7 items-center justify-center rounded-full ring-1 ring-white/20 backdrop-blur-md transition focus:outline-none focus:ring-2 focus:ring-red-500 ${liked ? 'bg-red-600 text-white' : 'bg-black/50 text-white hover:bg-white hover:text-black'}`}>
              <Heart className={`h-3.5 w-3.5 ${liked ? 'fill-current' : ''}`} />
            </button>
            {onMoreLikeThis && (
              <button onClick={() => onMoreLikeThis(movie)} aria-label="More like this"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-fuchsia-300 ring-1 ring-white/20 backdrop-blur-md transition hover:bg-fuchsia-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-500">
                <Sparkles className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="mt-auto">
            {movie.why && (
              <p className="mb-2 flex items-start gap-1.5 text-xs font-medium leading-relaxed text-white">
                <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" /><span className="line-clamp-4">{movie.why}</span>
              </p>
            )}
            <div className="flex flex-wrap items-center gap-1.5">
              {movie.genres.slice(0, 3).map((g) => (
                <span key={g} className="rounded bg-white/20 px-1.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-md">{g}</span>
              ))}
              <a href={movie.tmdb_url ?? '#'} target="_blank" rel="noreferrer" aria-label="View on TMDB"
                 className="ml-auto rounded p-1 text-white/80 transition hover:text-white focus:outline-none focus:ring-2 focus:ring-red-500"><ExternalLink className="h-3.5 w-3.5" /></a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
