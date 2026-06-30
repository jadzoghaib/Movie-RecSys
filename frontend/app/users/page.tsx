'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Search, ArrowUpDown } from 'lucide-react'
import { api, type AllUser } from '@/lib/api'
import { Avatar } from '@/app/components'

type Sort = 'id' | 'ratings'

export default function UsersPage() {
  const [users, setUsers] = useState<AllUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('id')

  useEffect(() => {
    api.allUsers().then(setUsers).catch(() => setError('Cannot reach the API. Is the backend running on :8000?'))
  }, [])

  const shown = useMemo(() => {
    const q = query.trim()
    const filtered = q ? users.filter((u) => String(u.user_id).includes(q)) : users
    const sorted = [...filtered].sort((a, b) =>
      sort === 'id' ? a.user_id - b.user_id : b.n_ratings - a.n_ratings)
    return sorted
  }, [users, query, sort])

  return (
    <div className="mx-auto min-h-full max-w-6xl px-6 py-12">
      <div className="flex flex-col items-center text-center">
        <Link href="/" className="font-wordmark text-2xl uppercase text-red-600">CINE<span className="text-zinc-100">MATCH</span></Link>
        <h1 className="mt-8 text-3xl font-semibold">All viewers</h1>
        <p className="mt-2 text-sm text-zinc-400">{users.length.toLocaleString()} MovieLens viewers — pick anyone to explore their AI-curated cinema.</p>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="text-xs text-zinc-400 transition hover:text-white">← Back to profiles</Link>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm">
            <Search className="h-4 w-4 text-zinc-500" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} inputMode="numeric"
              placeholder="Search viewer #"
              className="w-32 bg-transparent text-zinc-100 outline-none placeholder:text-zinc-600" />
          </label>
          <button onClick={() => setSort((s) => (s === 'id' ? 'ratings' : 'id'))}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-zinc-300 transition hover:border-fuchsia-500/50 hover:text-white">
            <ArrowUpDown className="h-3.5 w-3.5" />
            {sort === 'id' ? 'By viewer #' : 'By most ratings'}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-8 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">{error}</p>
      )}

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {shown.map((u) => (
          <Link key={u.user_id} href={`/u/${u.user_id}`}
            className="group flex items-center gap-3 rounded-xl border border-white/5 bg-white/5 p-3 transition hover:border-red-500/50 hover:bg-white/10">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl ring-1 ring-white/10">
              <Avatar id={u.user_id} className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-zinc-200 group-hover:text-white">Viewer #{u.user_id}</p>
              <p className="text-[11px] text-zinc-500">{u.n_ratings.toLocaleString()} ratings</p>
              <p className="truncate text-[10px] text-zinc-600">{u.top_genres.slice(0, 2).join(' · ')}</p>
            </div>
          </Link>
        ))}
      </div>

      {!error && shown.length === 0 && users.length > 0 && (
        <p className="mt-12 text-center text-sm text-zinc-500">No viewer matches “{query}”.</p>
      )}
    </div>
  )
}
