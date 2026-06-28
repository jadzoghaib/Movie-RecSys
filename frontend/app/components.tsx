'use client'

import { useRef } from 'react'
import type { Movie, Rail as RailT } from '@/lib/api'

export function Hero({ movie }: { movie: Movie }) {
  return (
    <section className="relative overflow-hidden">
      {movie.poster_url && (
        <div className="absolute inset-0 scale-110 bg-cover bg-center opacity-30 blur-2xl"
             style={{ backgroundImage: `url(${movie.poster_url})` }} />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0b0b0f] via-[#0b0b0f]/85 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0f] to-transparent" />
      <div className="relative mx-auto flex max-w-[1400px] items-center gap-10 px-6 py-14">
        {movie.poster_url && (
          <img src={movie.poster_url} alt={movie.title}
               className="hidden w-48 shrink-0 rounded-xl shadow-2xl shadow-black/60 ring-1 ring-white/10 sm:block" />
        )}
        <div className="max-w-xl">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-red-500">Top pick for you</p>
          <h1 className="text-5xl font-extrabold leading-[1.05] tracking-tight text-white">{movie.title}</h1>
          <div className="mt-4 flex flex-wrap gap-2">
            {movie.chips?.map((c) => <Chip key={c}>{c}</Chip>)}
            {movie.genres.map((g) => (
              <span key={g} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-zinc-300">{g}</span>
            ))}
          </div>
          {movie.why && <p className="mt-4 text-sm font-medium text-zinc-200">💡 {movie.why}</p>}
          {movie.overview && <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-zinc-400">{movie.overview}</p>}
          <div className="mt-6">
            <a href={movie.tmdb_url ?? '#'} target="_blank" rel="noreferrer"
               className="inline-block rounded-md bg-red-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500">
              ▶ View on TMDB
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-100 ring-1 ring-white/20 backdrop-blur">
      {children}
    </span>
  )
}

export function ArcRail({ caption, items }: { caption: string; items: Movie[] }) {
  return (
    <section className="mb-12 rounded-2xl border border-fuchsia-500/25 bg-gradient-to-br from-fuchsia-600/10 via-indigo-600/5 to-transparent p-6 shadow-lg shadow-fuchsia-900/10">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-lg">✨</span>
        <h2 className="text-lg font-semibold text-fuchsia-100">Tonight&apos;s Arc</h2>
        <span className="rounded-full bg-fuchsia-500/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-fuchsia-300">a curated journey</span>
      </div>
      <p className="mb-5 text-sm text-zinc-300">{caption}</p>
      <div className="flex items-stretch gap-3 overflow-x-auto pb-1">
        {items.map((m, i) => (
          <div key={m.movie_id} className="flex items-center gap-3">
            <div className="w-[150px] shrink-0">
              <PosterCard movie={m} badge={`${i + 1}`} />
              {m.arc_note && <p className="mt-1.5 text-center text-[10px] font-medium text-fuchsia-300/90">{m.arc_note}</p>}
            </div>
            {i < items.length - 1 && <span className="text-2xl text-fuchsia-400/60">→</span>}
          </div>
        ))}
      </div>
    </section>
  )
}

export function Rail({ rail, onAnchor }: { rail: RailT; onAnchor?: (m: Movie) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const scroll = (dir: number) => ref.current?.scrollBy({ left: dir * 620, behavior: 'smooth' })
  return (
    <section className="group/rail mb-10">
      <h2 className="text-lg font-semibold text-zinc-100">{rail.title}</h2>
      {rail.subtitle && <p className="mb-3 text-[11px] uppercase tracking-wide text-zinc-500">{rail.subtitle}</p>}
      <div className="relative">
        <button onClick={() => scroll(-1)} aria-label="scroll left"
          className="absolute -left-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-zinc-200 opacity-0 transition group-hover/rail:flex group-hover/rail:opacity-100 hover:bg-black">‹</button>
        <div ref={ref} className="flex gap-3 overflow-x-auto scroll-smooth pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {rail.items.map((m) => (
            <div key={m.movie_id} className="w-[150px] shrink-0"><PosterCard movie={m} onAnchor={onAnchor} /></div>
          ))}
        </div>
        <button onClick={() => scroll(1)} aria-label="scroll right"
          className="absolute -right-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/70 text-zinc-200 opacity-0 transition group-hover/rail:flex group-hover/rail:opacity-100 hover:bg-black">›</button>
      </div>
    </section>
  )
}

export function PosterCard({ movie, badge, onAnchor }: { movie: Movie; badge?: string; onAnchor?: (m: Movie) => void }) {
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
        {movie.chips && movie.chips.length > 0 && (
          <div className="absolute right-1.5 top-1.5 flex flex-col items-end gap-1">
            {movie.chips.map((c) => <Chip key={c}>{c}</Chip>)}
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-black/95 via-black/85 to-transparent p-2 transition group-hover:translate-y-0">
          <p className="line-clamp-2 text-[11px] font-medium text-white">{movie.title}</p>
          {movie.why && <p className="mt-1 line-clamp-3 text-[9px] leading-snug text-zinc-300">{movie.why}</p>}
          <div className="mt-1 flex flex-wrap gap-1">
            {movie.genres.slice(0, 2).map((g) => (
              <span key={g} className="rounded-full bg-white/15 px-1.5 py-0.5 text-[9px] text-zinc-200">{g}</span>
            ))}
          </div>
          {onAnchor && (
            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAnchor(movie) }}
              className="mt-1.5 w-full rounded bg-white/15 px-2 py-1 text-[9px] font-semibold text-white transition hover:bg-red-600">
              ⚓ Set as anchor
            </button>
          )}
        </div>
      </div>
    </a>
  )
}
