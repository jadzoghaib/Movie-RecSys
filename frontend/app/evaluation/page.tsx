'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { api, type Metric } from '@/lib/api'

export default function EvaluationPage() {
  const [metrics, setMetrics] = useState<Metric[]>([])
  useEffect(() => { api.metrics().then(setMetrics).catch(() => {}) }, [])

  const cols: [string, keyof Metric][] = [['P@10', 'precision@k'], ['Recall@10', 'recall@k'], ['NDCG', 'ndcg@k'], ['Coverage', 'coverage']]
  const extra: [string, keyof Metric][] = [['Diversity', 'diversity'], ['Novelty', 'novelty'], ['Serendipity', 'serendipity']]

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-10">
      <Link href="/" className="text-sm text-zinc-400 transition hover:text-white">← Back</Link>
      <h1 className="mt-4 text-2xl font-semibold">The Lab — offline evaluation</h1>
      <p className="mt-2 max-w-2xl text-sm text-zinc-400">
        How the {metrics.length} recommenders compare on the held-out test set (per-user 80/20 split, k = 10).
        The point isn&apos;t one winner — it&apos;s the <span className="text-zinc-200">accuracy vs. beyond-accuracy trade-off</span>.
      </p>

      <div className="mt-6 overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-zinc-400">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Model</th>
              {cols.map(([l]) => <th key={l} className="px-4 py-2.5 text-right font-medium">{l}</th>)}
              {extra.map(([l]) => <th key={l} className="px-4 py-2.5 text-right font-medium">{l}</th>)}
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <tr key={m.model} className="border-t border-white/5 hover:bg-white/[0.02]">
                <td className="px-4 py-2.5 font-medium text-zinc-200">{m.model}</td>
                {cols.map(([, k]) => <td key={k} className="px-4 py-2.5 text-right tabular-nums text-zinc-400">{(m[k] as number).toFixed(3)}</td>)}
                {extra.map(([, k]) => {
                  const v = m[k] as number | undefined
                  return <td key={k} className="px-4 py-2.5 text-right tabular-nums text-zinc-500">{v != null ? v.toFixed(2) : '—'}</td>
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
