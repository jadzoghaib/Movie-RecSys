'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Sparkles, Film, Clapperboard } from 'lucide-react'
import { api, type PersonResult } from '@/lib/api'
import { Rail, CardActionsProvider, SkeletonRail } from '@/app/components'

export default function PersonPage() {
  const params = useParams<{ id: string; name: string }>()
  const router = useRouter()
  const userId = Number(params.id)
  const name = decodeURIComponent(params.name)

  const [data, setData] = useState<PersonResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!name) return
    setLoading(true)
    api.person(userId, name)
      .then(setData)
      .catch(() => setError('Failed to load this person.'))
      .finally(() => setLoading(false))
  }, [userId, name])

  const initials = name.split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase()

  return (
    <CardActionsProvider value={{ onOpen: (m) => router.push(`/u/${userId}/m/${m.movie_id}`) }}>
      <div className="min-h-full">
        <header className="sticky top-0 z-40 border-b border-white/5 bg-[#0b0b0f]/85 backdrop-blur-md">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3.5">
            <div className="flex items-center gap-5">
              <Link href={`/u/${userId}`} className="font-wordmark text-2xl uppercase text-red-600">CINE<span className="text-zinc-100">MATCH</span></Link>
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

        {/* person card */}
        <section className="relative overflow-hidden border-b border-white/5">
          <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-600/10 via-indigo-600/5 to-transparent" />
          <div className="relative mx-auto flex max-w-[1400px] items-center gap-6 px-6 py-10">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-600/40 to-indigo-600/30 text-2xl font-bold text-white ring-1 ring-white/10">
              {initials}
            </div>
            <div>
              <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-fuchsia-300">
                <Sparkles className="h-3.5 w-3.5" /> Person spotlight
              </p>
              <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{name}</h1>
              {data && (
                <p className="mt-2 flex items-center gap-1.5 text-sm text-zinc-400">
                  <Film className="h-4 w-4 text-zinc-500" /> {data.n_movies} film{data.n_movies === 1 ? '' : 's'} in the catalog
                </p>
              )}
              {data && data.keywords.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {data.keywords.map((k) => (
                    <span key={k} className="rounded-full border border-fuchsia-500/20 bg-fuchsia-600/15 px-2.5 py-1 text-[11px] font-medium text-fuchsia-200">{k}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <main className="mx-auto max-w-[1400px] px-6 pb-16 pt-10">
          {loading && !data ? (
            <SkeletonRail />
          ) : data && data.movies.length > 0 ? (
            <Rail rail={{
              title: `Recommended for you from ${name}`,
              subtitle: 'Their films, ranked by your taste',
              items: data.movies,
            }} />
          ) : !error ? (
            <p className="flex items-center gap-2 text-sm text-zinc-500">
              <Clapperboard className="h-5 w-5" /> No catalog films found for {name}.
            </p>
          ) : null}
        </main>
      </div>
    </CardActionsProvider>
  )
}
