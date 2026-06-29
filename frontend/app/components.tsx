'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  Play, Sparkles, Lightbulb, ArrowRight, ChevronLeft, ChevronRight, ExternalLink,
} from 'lucide-react'
import type { Movie, Rail as RailT } from '@/lib/api'

type CardActions = {
  onMoreLikeThis?: (m: Movie) => void
  onOpen?: (m: Movie) => void
}
const CardActionsContext = createContext<CardActions>({})
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

/** Coarse exploration level for the at-a-glance badge. */
export function explorationLevel(v: number) {
  if (v <= 0.33) return 'Low'
  if (v <= 0.66) return 'Medium'
  return 'High'
}

/** One-line description of what moving the slider actually does. */
export function explorationHint(v: number) {
  if (v <= 0.33) return 'Safe, familiar favourites — close to your proven taste.'
  if (v <= 0.66) return 'A balanced mix of trusted picks and a few surprises.'
  return 'Bold, long-tail & serendipitous picks well outside your usual lane.'
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
  const { onMoreLikeThis } = useContext(CardActionsContext)
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
export function ArcRail({ caption, items, journeyFrom }: { caption: string; items: Movie[]; journeyFrom?: string | null }) {
  return (
    <section className="mb-14 animate-arc-reveal rounded-2xl border border-fuchsia-500/25 bg-gradient-to-br from-fuchsia-600/10 via-indigo-600/5 to-transparent p-6 shadow-lg shadow-fuchsia-900/10">
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <Sparkles className="h-4 w-4 text-fuchsia-300" />
        <h2 className="text-lg font-bold text-fuchsia-100">Tonight&apos;s Arc</h2>
        <span className="rounded-full bg-fuchsia-500/15 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-fuchsia-300">a curated journey</span>
        {journeyFrom && (
          <span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-2 py-0.5 text-[11px] font-medium text-fuchsia-200">
            Journey from: {journeyFrom}
          </span>
        )}
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
    <section className="group/rail mb-12">
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 className="text-lg font-bold text-white">{rail.title}</h2>
        {rail.active_model && (
          <span className="rounded-full border border-red-500/30 bg-red-600/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-red-300">
            Active model: {rail.active_model}
          </span>
        )}
      </div>
      {rail.subtitle && <p className={`mb-3 mt-0.5 text-[11px] tracking-wide text-zinc-500 ${rail.active_model ? 'normal-case' : 'uppercase'}`}>{rail.subtitle}</p>}
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

/* ---------- floating "why this" preview (portal — escapes rail overflow clipping) ---------- */
function WhyPreview({ movie, anchor }: { movie: Movie; anchor: { left: number; top: number; below: boolean } }) {
  return createPortal(
    <div className="pointer-events-none fixed z-[60] w-72"
      style={{ left: anchor.left, top: anchor.top, transform: anchor.below ? 'translate(-50%, 0)' : 'translate(-50%, -100%)' }}>
      <div className="animate-tip rounded-xl border border-white/10 bg-[#15151c]/95 p-3.5 shadow-2xl shadow-black/60 backdrop-blur-md">
        <p className="text-sm font-bold leading-snug text-white">{movie.title}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {movie.chips?.map((c) => (
            <span key={c} className="rounded-full border border-red-500/25 bg-red-600/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-300">{c}</span>
          ))}
          {movie.genres.slice(0, 3).map((g) => (
            <span key={g} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-zinc-300">{g}</span>
          ))}
        </div>
        {movie.why ? (
          <div className="mt-2.5 flex items-start gap-2 rounded-lg bg-white/5 p-2.5">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <p className="text-xs font-medium leading-relaxed text-zinc-100">{movie.why}</p>
          </div>
        ) : (
          <p className="mt-2 text-xs text-zinc-400">Recommended for you.</p>
        )}
      </div>
    </div>,
    document.body,
  )
}

/* ---------- poster card (hover -> floating "why" card, feedback loop, keyboard-accessible) ---------- */
export function PosterCard({ movie, badge }: { movie: Movie; badge?: string }) {
  const { onMoreLikeThis, onOpen } = useContext(CardActionsContext)
  const cardRef = useRef<HTMLDivElement>(null)
  const timer = useRef<number | null>(null)
  const [mounted, setMounted] = useState(false)
  const [anchor, setAnchor] = useState<{ left: number; top: number; below: boolean } | null>(null)
  useEffect(() => setMounted(true), [])

  const place = () => {
    const r = cardRef.current?.getBoundingClientRect()
    if (!r) return
    const below = r.top < 230                                   // near the top edge -> flip under the card
    const left = Math.min(Math.max(r.left + r.width / 2, 150), window.innerWidth - 150)
    setAnchor({ left, top: below ? r.bottom + 10 : r.top - 10, below })
  }
  const show = () => { if (timer.current) window.clearTimeout(timer.current); timer.current = window.setTimeout(place, 110) }
  const hide = () => { if (timer.current) window.clearTimeout(timer.current); setAnchor(null) }

  useEffect(() => {
    if (!anchor) return
    const reanchor = () => place()
    window.addEventListener('scroll', reanchor, true)
    window.addEventListener('resize', reanchor)
    return () => { window.removeEventListener('scroll', reanchor, true); window.removeEventListener('resize', reanchor) }
  }, [anchor])
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current) }, [])

  return (
    <div ref={cardRef} className="group relative w-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0b0f]"
      role={onOpen ? 'button' : undefined} tabIndex={onOpen ? 0 : undefined}
      onClick={() => onOpen?.(movie)}
      onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}
      onKeyDown={(e) => { if (onOpen && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpen(movie) } }}>
      <div className={`relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-white/10 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-xl group-hover:ring-white/30 ${onOpen ? 'cursor-pointer' : ''}`}>
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

        {/* hover / keyboard-focus: action buttons + genres (the full "why" lives in the floating card) */}
        <div className="absolute inset-0 flex flex-col justify-between bg-black/60 p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100">
          <div className="flex justify-end gap-1.5">
            {onMoreLikeThis && (
              <button onClick={(e) => { e.stopPropagation(); onMoreLikeThis(movie) }} aria-label="More like this"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-fuchsia-300 ring-1 ring-white/20 backdrop-blur-md transition hover:bg-fuchsia-600 hover:text-white focus:outline-none focus:ring-2 focus:ring-fuchsia-500">
                <Sparkles className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="mt-auto flex flex-wrap items-center gap-1.5">
            {movie.genres.slice(0, 3).map((g) => (
              <span key={g} className="rounded bg-white/20 px-1.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-md">{g}</span>
            ))}
            <a href={movie.tmdb_url ?? '#'} target="_blank" rel="noreferrer" aria-label="View on TMDB" onClick={(e) => e.stopPropagation()}
               className="ml-auto rounded p-1 text-white/80 transition hover:text-white focus:outline-none focus:ring-2 focus:ring-red-500"><ExternalLink className="h-3.5 w-3.5" /></a>
          </div>
        </div>
      </div>
      {mounted && anchor && <WhyPreview movie={movie} anchor={anchor} />}
    </div>
  )
}
