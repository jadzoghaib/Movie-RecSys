'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Play, Star, Clock, Calendar, ExternalLink, X, Clapperboard } from 'lucide-react'
import { api, type MovieDetail } from '@/lib/api'
import { Rail, CardActionsProvider, SkeletonRail } from '@/app/components'

export default function MovieDetailPage() {
  const params = useParams<{ id: string; movieId: string }>()
  const router = useRouter()
  const userId = Number(params.id)
  const movieId = Number(params.movieId)

  const [data, setData] = useState<MovieDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showTrailer, setShowTrailer] = useState(false)

  useEffect(() => {
    if (!movieId) return
    setLoading(true); setShowTrailer(false)
    api.movie(userId, movieId)
      .then((d) => { if ((d as { error?: string }).error) setError('Movie not found.'); else setData(d) })
      .catch(() => setError('Failed to load this movie.'))
      .finally(() => setLoading(false))
  }, [userId, movieId])

  const personHref = (name: string) => `/u/${userId}/person/${encodeURIComponent(name)}`

  return (
    <CardActionsProvider value={{ onOpen: (m) => router.push(`/u/${userId}/m/${m.movie_id}`) }}>
      <div className="min-h-full">
        {/* header */}
        <header className="sticky top-0 z-40 border-b border-white/5 bg-[#0b0b0f]/85 backdrop-blur-md">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3.5">
            <div className="flex items-center gap-5">
              <Link href={`/u/${userId}`} className="text-2xl font-extrabold tracking-tight text-red-600">CINE<span className="text-zinc-100">MATCH</span></Link>
              <button onClick={() => router.back()} className="text-xs text-zinc-400 transition hover:text-white">← Back</button>
            </div>
            <span className="hidden rounded-full bg-white/5 px-2.5 py-1 text-xs font-medium text-zinc-300 sm:block">Viewer #{userId}</span>
          </div>
        </header>

        {error && (
          <div className="mx-auto mt-10 max-w-[1400px] px-6">
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>
          </div>
        )}

        {data && (
          <>
            {/* backdrop hero */}
            <section className="relative overflow-hidden border-b border-white/5">
              {(data.backdrop_url || data.poster_url) && (
                <div className="absolute inset-0 scale-105 bg-cover bg-center"
                     style={{ backgroundImage: `url(${data.backdrop_url || data.poster_url})`, opacity: 0.3 }} />
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-[#0b0b0f] via-[#0b0b0f]/85 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0f] to-transparent" />
              <div className="relative mx-auto flex max-w-[1400px] flex-col items-start gap-8 px-6 py-12 sm:flex-row sm:py-16">
                {data.poster_url && (
                  <img src={data.poster_url} alt={data.title}
                       className="w-40 shrink-0 rounded-xl shadow-2xl shadow-black/70 ring-1 ring-white/10 sm:w-60" />
                )}
                <div className="max-w-2xl">
                  <h1 className="mb-3 text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">{data.title}</h1>

                  <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-zinc-300">
                    {data.year && <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4 text-zinc-500" />{data.year}</span>}
                    {data.runtime ? <span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-zinc-500" />{data.runtime} min</span> : null}
                    {data.vote_average ? <span className="flex items-center gap-1.5 font-semibold text-amber-300"><Star className="h-4 w-4 fill-current" />{data.vote_average.toFixed(1)}</span> : null}
                  </div>

                  <div className="mb-4 flex flex-wrap gap-2">
                    {data.genres.map((g) => (
                      <span key={g} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-zinc-300">{g}</span>
                    ))}
                  </div>

                  {data.overview && <p className="mb-6 max-w-xl text-sm leading-relaxed text-zinc-300">{data.overview}</p>}

                  {/* director + cast (clickable → person pages) */}
                  {data.director && (
                    <p className="mb-2 text-sm text-zinc-400">
                      <span className="text-zinc-500">Director: </span>
                      <Link href={personHref(data.director)} className="font-semibold text-fuchsia-300 underline-offset-4 transition hover:text-fuchsia-200 hover:underline">{data.director}</Link>
                    </p>
                  )}
                  {data.cast && data.cast.length > 0 && (
                    <div className="mb-6 flex flex-wrap items-center gap-2">
                      <span className="text-sm text-zinc-500">Cast:</span>
                      {data.cast.slice(0, 8).map((c) => (
                        <Link key={c} href={personHref(c)}
                          className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-zinc-300 transition hover:border-fuchsia-500/50 hover:text-fuchsia-200">{c}</Link>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3">
                    {data.trailer_key && (
                      <button onClick={() => setShowTrailer(true)}
                        className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-red-500 transition hover:bg-red-500">
                        <Play className="h-4 w-4 fill-current" /> Play trailer
                      </button>
                    )}
                    <a href={data.tmdb_url ?? '#'} target="_blank" rel="noreferrer"
                       className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white">
                      <ExternalLink className="h-4 w-4" /> View on TMDB
                    </a>
                  </div>
                </div>
              </div>
            </section>

            <main className="mx-auto max-w-[1400px] px-6 pb-16 pt-10">
              {data.for_you && data.for_you.length > 0 && (
                <Rail rail={{
                  title: 'For you — because you’re watching this',
                  subtitle: 'Personalised: your taste reweighted toward this movie',
                  items: data.for_you,
                }} />
              )}
              {data.similar && data.similar.length > 0 && (
                <Rail rail={{
                  title: 'More like this',
                  subtitle: `Movies most similar to ${data.title} — same for every viewer`,
                  items: data.similar,
                }} />
              )}
            </main>

            {/* trailer modal */}
            {showTrailer && data.trailer_key && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setShowTrailer(false)}>
                <div className="relative w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => setShowTrailer(false)} aria-label="Close trailer"
                    className="absolute -top-10 right-0 flex items-center gap-1 text-sm text-zinc-300 transition hover:text-white">
                    <X className="h-5 w-5" /> Close
                  </button>
                  <div className="aspect-video w-full overflow-hidden rounded-xl ring-1 ring-white/10">
                    <iframe className="h-full w-full" src={`https://www.youtube.com/embed/${data.trailer_key}?autoplay=1`}
                      title={`${data.title} trailer`} allow="autoplay; encrypted-media" allowFullScreen />
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {loading && !data && (
          <main className="mx-auto max-w-[1400px] px-6 pb-16 pt-10">
            <div className="mb-10 flex items-center gap-3 text-sm text-zinc-500">
              <Clapperboard className="h-5 w-5 animate-pulse text-red-500" /> Loading movie…
            </div>
            <SkeletonRail />
          </main>
        )}
      </div>
    </CardActionsProvider>
  )
}
