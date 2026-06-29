'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import { api, type Profile } from '@/lib/api'

export default function Landing() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.profiles().then(setProfiles).catch(() => setError('Cannot reach the API. Is the backend running on :8000?'))
  }, [])

  return (
    <div className="flex min-h-full flex-col items-center px-6 py-14">
      <div className="text-3xl font-extrabold tracking-tight text-red-600">CINE<span className="text-zinc-100">MATCH</span></div>
      <p className="mt-2 text-sm text-zinc-500">A multi-algorithm movie recommender · MovieLens</p>

      <h1 className="mt-14 text-3xl font-semibold">Who&apos;s watching?</h1>
      <p className="mt-2 text-sm text-zinc-400">Pick a viewer to explore their AI-curated cinema.</p>

      {error && (
        <p className="mt-8 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">{error}</p>
      )}

      <div className="mt-10 grid w-full max-w-5xl grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
        {profiles.slice(0, 7).map((p) => (
          <Link key={p.user_id} href={`/u/${p.user_id}`} className="group flex flex-col items-center text-center">
            <div className="h-28 w-28 overflow-hidden rounded-2xl bg-zinc-800 ring-1 ring-white/10 transition group-hover:scale-105 group-hover:ring-2 group-hover:ring-red-500">
              {p.fav_poster
                ? <img src={p.fav_poster} alt="" className="h-full w-full object-cover" />
                : <div className="flex h-full w-full items-center justify-center text-sm text-zinc-500">#{p.user_id}</div>}
            </div>
            <p className="mt-3 font-semibold text-zinc-200 group-hover:text-white">Viewer #{p.user_id}</p>
            <p className="text-xs text-zinc-500">{p.n_ratings.toLocaleString()} ratings</p>
            <div className="mt-1.5 flex flex-wrap justify-center gap-1">
              {p.top_genres.slice(0, 2).map((g) => (
                <span key={g} className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-zinc-400">{g}</span>
              ))}
            </div>
          </Link>
        ))}

        {/* Other users → full sorted list */}
        <Link href="/users" className="group flex flex-col items-center text-center">
          <div className="flex h-28 w-28 items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/5 text-zinc-400 transition group-hover:scale-105 group-hover:border-fuchsia-500 group-hover:text-fuchsia-300">
            <Users className="h-9 w-9" />
          </div>
          <p className="mt-3 font-semibold text-zinc-200 group-hover:text-white">Other users</p>
          <p className="text-xs text-zinc-500">Browse everyone</p>
        </Link>
      </div>

      <div className="mt-16 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-xs text-zinc-600">
        <span>1 · Pick a viewer</span>
        <span>2 · We blend 10+ recommenders</span>
        <span>3 · Tune comfort ↔ discovery</span>
      </div>
      <Link href="/evaluation" className="mt-6 text-xs text-zinc-500 underline-offset-4 hover:text-zinc-300 hover:underline">
        See how the algorithms compare →
      </Link>
    </div>
  )
}
