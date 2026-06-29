'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { api, type Metric } from '@/lib/api'

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
  const [metrics, setMetrics] = useState<Metric[]>([])
  useEffect(() => { api.metrics().then(setMetrics).catch(() => {}) }, [])

  const all = [...COLS, ...EXTRA]
  const best: Record<string, number> = {}
  for (const [, k] of all) {
    const vals = metrics.map((m) => m[k] as number).filter((v) => v != null && !Number.isNaN(v))
    if (vals.length) best[k as string] = Math.max(...vals)
  }

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

      <div className="mt-6 overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-zinc-400">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Model</th>
              {all.map(([l, , tip]) => (
                <th key={l} title={tip} className="cursor-help px-4 py-2.5 text-right font-medium underline decoration-dotted decoration-zinc-600 underline-offset-4">{l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <tr key={m.model} className="border-t border-white/5 hover:bg-white/[0.02]">
                <td className="px-4 py-2.5 font-medium text-zinc-200">{m.model}</td>
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
