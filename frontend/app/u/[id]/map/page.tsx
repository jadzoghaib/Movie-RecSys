'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Network, Route, Sparkles } from 'lucide-react'
import { api, type TasteMapData, type TasteNode } from '@/lib/api'

const GENRE_COLORS: Record<string, string> = {
  Action: '#ef4444', Adventure: '#f59e0b', Animation: '#22d3ee', Children: '#34d399',
  Comedy: '#facc15', Crime: '#a78bfa', Documentary: '#9ca3af', Drama: '#60a5fa',
  Fantasy: '#e879f9', 'Film-Noir': '#94a3b8', Horror: '#f43f5e', Musical: '#fb7185',
  Mystery: '#818cf8', Romance: '#f472b6', 'Sci-Fi': '#2dd4bf', Thriller: '#fb923c',
  War: '#a16207', Western: '#d6a76a', IMAX: '#38bdf8',
}
const genreColor = (g: string) => GENRE_COLORS[g] ?? '#71717a'

const W = 1000, H = 640, P = 80
const px = (x: number) => P + x * (W - 2 * P)
const py = (y: number) => P + y * (H - 2 * P)

export default function TasteMapPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const userId = Number(params.id)

  const [data, setData] = useState<TasteMapData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    if (!userId) return
    api.tasteMap(userId).then(setData).catch(() => setError('Could not build the taste map.'))
  }, [userId])

  const byId = useMemo(() => {
    const m = new Map<number, TasteNode>()
    data?.nodes.forEach((n) => m.set(n.id, n))
    return m
  }, [data])

  const arcPts = useMemo(
    () => (data?.arc ?? []).map((id) => byId.get(id)).filter(Boolean) as TasteNode[],
    [data, byId],
  )
  const arcRank = useMemo(() => {
    const r = new Map<number, number>()
    ;(data?.arc ?? []).forEach((id, i) => r.set(id, i + 1))
    return r
  }, [data])

  const legendGenres = useMemo(
    () => Array.from(new Set((data?.nodes ?? []).map((n) => n.genre))).slice(0, 10),
    [data],
  )
  const hovered = hover != null ? byId.get(hover) : null

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[#0b0b0f]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-5">
            <Link href={`/u/${userId}`} className="text-2xl font-extrabold tracking-tight text-red-600">CINE<span className="text-zinc-100">MATCH</span></Link>
            <Link href={`/u/${userId}`} className="text-xs text-zinc-400 transition hover:text-white">← Home</Link>
            <span className="flex items-center gap-1.5 text-sm text-fuchsia-300"><Network className="h-4 w-4" /> Taste Map · Viewer #{userId}</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-6 py-8">
        <h1 className="text-2xl font-bold text-white">Your taste, as a constellation</h1>
        <p className="mt-2 max-w-2xl text-sm text-zinc-400">
          Each star is a film — the ones you&apos;ve <span className="text-white">rated highly</span> and the ones we
          <span className="text-white"> recommend</span>. Lines link films with similar content; colour is the lead genre.
          The <span className="font-medium text-fuchsia-300">fuchsia path</span> is Tonight&apos;s Arc, hopping from a trusted favourite toward a discovery.
        </p>

        {error && <p className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">{error}</p>}

        {/* legend */}
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-zinc-400">
          <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full bg-white ring-2 ring-white/40" /> Rated highly</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-3 w-3 rounded-full bg-zinc-500/60 ring-1 ring-white/30" /> Recommended</span>
          <span className="flex items-center gap-1.5"><Route className="h-3.5 w-3.5 text-fuchsia-400" /> Tonight&apos;s Arc</span>
          <span className="mx-1 h-3 w-px bg-white/10" />
          {legendGenres.map((g) => (
            <span key={g} className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: genreColor(g) }} /> {g}</span>
          ))}
        </div>

        <div className="relative mt-5 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0e0e15] to-[#0b0b0f]">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ aspectRatio: `${W}/${H}` }}>
            <defs>
              <marker id="arc-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="#e879f9" />
              </marker>
            </defs>

            {/* similarity edges */}
            {data?.edges.map(([a, b], i) => {
              const na = data.nodes[a], nb = data.nodes[b]
              if (!na || !nb) return null
              return <line key={i} x1={px(na.x)} y1={py(na.y)} x2={px(nb.x)} y2={py(nb.y)} stroke="#ffffff" strokeOpacity={0.07} strokeWidth={1} />
            })}

            {/* arc path */}
            {arcPts.length > 1 && (
              <polyline
                points={arcPts.map((n) => `${px(n.x)},${py(n.y)}`).join(' ')}
                fill="none" stroke="#e879f9" strokeOpacity={0.85} strokeWidth={2.5}
                strokeDasharray="2 6" strokeLinecap="round" markerEnd="url(#arc-arrow)" />
            )}

            {/* nodes */}
            {data?.nodes.map((n) => {
              const c = genreColor(n.genre)
              const isHover = hover === n.id
              const rank = arcRank.get(n.id)
              const r = n.role === 'seen' ? 9 : 7
              return (
                <g key={n.id} transform={`translate(${px(n.x)},${py(n.y)})`}
                  className="cursor-pointer" onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)}
                  onClick={() => router.push(`/u/${userId}/m/${n.id}`)}>
                  {rank != null && <circle r={r + 6} fill="none" stroke="#e879f9" strokeWidth={2} strokeOpacity={0.9} />}
                  {isHover && <circle r={r + 10} fill={c} fillOpacity={0.15} />}
                  <circle r={isHover ? r + 2 : r} fill={c} fillOpacity={n.role === 'seen' ? 0.95 : 0.55}
                    stroke={n.role === 'seen' ? '#ffffff' : '#ffffff'} strokeOpacity={n.role === 'seen' ? 0.7 : 0.25} strokeWidth={n.role === 'seen' ? 2 : 1} />
                  {rank != null && (
                    <text textAnchor="middle" dy={-r - 10} fontSize={11} fontWeight={700} fill="#f5d0fe">{rank}</text>
                  )}
                  {isHover && (
                    <text textAnchor="middle" dy={r + 14} fontSize={11} fontWeight={600} fill="#ffffff"
                      style={{ pointerEvents: 'none' }}>{n.title.length > 26 ? n.title.slice(0, 25) + '…' : n.title}</text>
                  )}
                </g>
              )
            })}
          </svg>

          {/* hover info panel */}
          {hovered && (
            <div className="pointer-events-none absolute bottom-4 left-4 flex items-center gap-3 rounded-xl border border-white/10 bg-black/70 p-2.5 pr-4 backdrop-blur-md">
              {hovered.poster_url
                ? <img src={hovered.poster_url} alt="" className="h-16 w-11 rounded-md object-cover ring-1 ring-white/10" />
                : <div className="flex h-16 w-11 items-center justify-center rounded-md bg-zinc-800 text-[9px] text-zinc-500">#{hovered.id}</div>}
              <div>
                <p className="text-sm font-semibold text-white">{hovered.title}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-400">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: genreColor(hovered.genre) }} />
                  {hovered.genre} · {hovered.role === 'seen' ? 'You rated this highly' : 'Recommended for you'}
                </p>
              </div>
            </div>
          )}

          {!data && !error && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-zinc-500">
              <Sparkles className="mr-2 h-4 w-4 animate-pulse text-fuchsia-400" /> Mapping your taste…
            </div>
          )}
        </div>

        <p className="mt-4 text-xs text-zinc-500">Tip: hover a star to see the film, click it to open its page. Tight clusters are genres you lean into; the arc deliberately bridges toward a less-familiar corner.</p>
      </div>
    </div>
  )
}
