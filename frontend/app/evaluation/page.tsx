'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ArrowLeft, Play } from 'lucide-react'
import { api, type Metric, type ModelInfo, type Profile } from '@/lib/api'

const COLS: [string, keyof Metric, string][] = [
  ['P@10', 'precision@k', 'Precision@10 — fraction of the top-10 recommendations that are relevant (rated ≥ 3.5 in the held-out test set).'],
  ['Recall@10', 'recall@k', 'Recall@10 — fraction of a user’s relevant test items captured in the top-10.'],
  ['NDCG', 'ndcg@k', 'Normalised Discounted Cumulative Gain@10 — rank-weighted relevance (hits near the top count more).'],
  ['Coverage', 'coverage', 'Catalog coverage — share of all movies that ever appear in someone’s recommendations.'],
]
const EXTRA: [string, keyof Metric, string][] = [
  ['Diversity', 'diversity', 'Intra-list diversity — average genre dissimilarity within a recommendation list.'],
  ['Novelty', 'novelty', 'Novelty — mean self-information (−log₂ popularity); higher = less mainstream picks.'],
  ['Serendipity', 'serendipity', 'Serendipity — share of the top-10 that are relevant AND non-obvious (not in the popular set).'],
]

export default function EvaluationPage() {
  const router = useRouter()
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [models, setModels] = useState<ModelInfo[]>([])
  const [demoUser, setDemoUser] = useState<number | null>(null)

  useEffect(() => { api.metrics().then(setMetrics).catch(() => {}) }, [])
  useEffect(() => { api.models().then(setModels).catch(() => {}) }, [])
  useEffect(() => { api.profiles().then((p: Profile[]) => setDemoUser(p[0]?.user_id ?? 1)).catch(() => setDemoUser(1)) }, [])

  const desc: Record<string, string> = {}
  for (const m of models) desc[m.id] = m.description

  const all = [...COLS, ...EXTRA]
  const best: Record<string, number> = {}
  for (const [, k] of all) {
    const vals = metrics.map((m) => m[k] as number).filter((v) => v != null && !Number.isNaN(v))
    if (vals.length) best[k as string] = Math.max(...vals)
  }

  const seeLive = (modelId: string) => { if (demoUser) router.push(`/u/${demoUser}?model=${encodeURIComponent(modelId)}`) }

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-10">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>
      <h1 className="mt-4 text-2xl font-bold">The Lab — offline evaluation</h1>
      <p className="mt-2 max-w-2xl text-sm text-zinc-400">
        How the {metrics.length} recommenders compare on the held-out test set (per-user 80/20 split, k = 10).
        The point isn&apos;t one winner — it&apos;s the <span className="text-zinc-200">accuracy vs. beyond-accuracy trade-off</span>.
        Best value per column is highlighted; hover a heading for its definition.
      </p>
      <p className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-red-500/25 bg-red-600/10 px-3 py-1.5 text-xs text-red-300">
        <Play className="h-3.5 w-3.5 fill-current" /> Click any model row to drive a live “Top picks” rail with it{demoUser ? ` for Viewer #${demoUser}` : ''} — watch the metrics become real recommendations.
      </p>

      <div className="mt-5 overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-zinc-400">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Model</th>
              {all.map(([l, , tip]) => (
                <th key={l} title={tip} className="cursor-help px-4 py-2.5 text-right font-medium underline decoration-dotted decoration-zinc-600 underline-offset-4">{l}</th>
              ))}
              <th className="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <tr key={m.model} onClick={() => seeLive(m.model)}
                title={desc[m.model] ? `${desc[m.model]} — click to see it live` : 'Click to see it live'}
                className="group cursor-pointer border-t border-white/5 transition hover:bg-red-600/[0.07]">
                <td className="px-4 py-2.5">
                  <div className="font-medium text-zinc-200 group-hover:text-white">{m.model}</div>
                  {desc[m.model] && <div className="mt-0.5 max-w-xs text-[11px] leading-snug text-zinc-500">{desc[m.model]}</div>}
                </td>
                {all.map(([, k]) => {
                  const v = m[k] as number | undefined
                  if (v == null || Number.isNaN(v)) return <td key={k} className="px-4 py-2.5 text-right text-zinc-600">—</td>
                  const isBest = best[k as string] != null && Math.abs(v - best[k as string]) < 1e-9
                  return (
                    <td key={k} className={`px-4 py-2.5 text-right tabular-nums ${isBest ? 'font-bold text-red-400' : 'text-zinc-400'}`}>
                      {v.toFixed(k === 'novelty' ? 2 : 3)}
                    </td>
                  )
                })}
                <td className="px-3 py-2.5 text-right">
                  <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-medium text-zinc-600 transition group-hover:text-red-300">
                    <Play className="h-3 w-3 fill-current" /> live
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 max-w-2xl text-xs leading-relaxed text-zinc-500">
        User-user CF and the LTR hybrid lead on accuracy; the re-ranker, content-based and random lead on diversity / novelty.
        The hybrid&apos;s value is combining many candidate generators into one ranking, then the re-ranker trades a little
        precision for the diversity &amp; serendipity the product cares about.
      </p>
    </div>
  )
}
