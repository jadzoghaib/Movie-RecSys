'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  Users, HelpCircle, X, MousePointerClick, SlidersHorizontal, FlaskConical,
  Sparkles, Film, Wand2, Route,
} from 'lucide-react'
import { api, type Profile } from '@/lib/api'
import { Avatar, LaunchIntro } from '@/app/components'

const STEPS: { icon: React.ComponentType<{ className?: string }>; title: string; body: string }[] = [
  { icon: MousePointerClick, title: 'Pick a viewer', body: 'Each tile is a real MovieLens user. Their rating history drives every recommendation you’ll see. “Other users” opens the full, searchable list of all 610.' },
  { icon: SlidersHorizontal, title: 'Tune Safe ↔ Bold', body: 'The discovery slider reshapes Top picks, Discover and Tonight’s Arc — from familiar comfort picks to bold, long-tail surprises. The badge shows the current exploration level.' },
  { icon: FlaskConical, title: 'Swap the algorithm', body: 'The Model selector (and the Evaluation board) let you drive the “Top picks” rail with any of the 10 recommenders, so you can see how each model behaves on real picks.' },
  { icon: Sparkles, title: 'Ask the AI guide', body: 'Describe a mood — “a dark sci-fi but not too slow”. The AI reads your intent (genre, tone, era), then our own recommender does the ranking.' },
  { icon: Film, title: 'Open any movie', body: 'Click a poster for the detail page: trailer, cast & director, a personalised “For you” rail and an item-similar “More like this”. Click a cast member or director for their own page.' },
  { icon: Wand2, title: 'Teach it your taste', body: 'Hit ✨ “More like this” on any card (or the hero) to re-seed the “Because you liked…” rail and Tonight’s Arc around that pick.' },
  { icon: Route, title: 'Follow Tonight’s Arc', body: 'A curated 4-film journey: a trusted opener that drifts, step by step, toward one serendipitous discovery.' },
]

export default function Landing() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [error, setError] = useState<string | null>(null)
  const [help, setHelp] = useState(false)

  useEffect(() => {
    api.profiles().then(setProfiles).catch(() => setError('Cannot reach the API. Is the backend running on :8000?'))
  }, [])

  return (
    <div className="relative flex min-h-full flex-col items-center px-6 py-14">
      <LaunchIntro />
      {/* radial brand glow */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
        style={{ background: 'radial-gradient(60% 50% at 50% 0%, rgba(229,9,20,.12), transparent)' }} />

      {/* help button */}
      <button onClick={() => setHelp(true)}
        className="absolute right-6 top-6 z-10 flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-fuchsia-500/50 hover:text-white">
        <HelpCircle className="h-4 w-4" /> How it works
      </button>

      <div className="font-wordmark text-4xl uppercase text-red-600">CINE<span className="text-zinc-100">MATCH</span></div>
      <p className="mt-2 text-sm text-zinc-500">A multi-algorithm movie recommender · MovieLens</p>

      <h1 className="mt-14 text-4xl font-extrabold tracking-tight">Who&apos;s watching?</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Pick a viewer to explore their AI-curated cinema — or{' '}
        <button onClick={() => setHelp(true)} className="text-fuchsia-400 underline-offset-4 transition hover:text-fuchsia-300 hover:underline">see how it works</button>.
      </p>

      {error && (
        <p className="mt-8 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">{error}</p>
      )}

      <div className="mt-10 grid w-full max-w-5xl grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
        {profiles.slice(0, 7).map((p) => (
          <Link key={p.user_id} href={`/u/${p.user_id}`} className="group flex flex-col items-center text-center">
            <div className="h-[118px] w-[118px] overflow-hidden rounded-[18px] shadow-[0_0_0_1px_rgba(255,255,255,0.07)] transition duration-300 group-hover:scale-[1.06] group-hover:shadow-[0_0_0_2px_#e50914]">
              <Avatar id={p.user_id} className="h-full w-full object-cover" />
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
          <div className="flex h-[118px] w-[118px] items-center justify-center rounded-[18px] border border-dashed border-white/15 bg-white/5 text-zinc-400 transition duration-300 group-hover:scale-[1.06] group-hover:border-fuchsia-500 group-hover:text-fuchsia-300">
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
      <p className="mt-10 max-w-md text-center text-[11px] leading-relaxed text-zinc-600">
        Ratings from the MovieLens dataset. Movie data and images provided by{' '}
        <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer" className="underline-offset-4 hover:text-zinc-400 hover:underline">TMDB</a>
        {' '}— this product uses the TMDB API but is not endorsed or certified by TMDB.
      </p>

      {/* how-it-works modal */}
      {help && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setHelp(false)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#101015] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 flex items-start justify-between">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-fuchsia-400" />
                <h2 className="text-lg font-bold text-white">How to use CineMatch</h2>
              </div>
              <button onClick={() => setHelp(false)} aria-label="Close" className="rounded-full p-1 text-zinc-400 transition hover:bg-white/10 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-5 text-sm text-zinc-400">A quick tour of the controls — every recommendation is grounded in a viewer’s real MovieLens ratings.</p>

            <ol className="space-y-4">
              {STEPS.map(({ icon: Icon, title, body }, i) => (
                <li key={title} className="flex gap-3.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-fuchsia-600/15 text-fuchsia-300 ring-1 ring-fuchsia-500/25">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">{i + 1}. {title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-zinc-400">{body}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-6 flex justify-end">
              <button onClick={() => setHelp(false)}
                className="rounded-lg bg-fuchsia-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-fuchsia-500">
                Got it — let’s watch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
