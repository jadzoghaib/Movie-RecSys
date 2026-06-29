'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, Send } from 'lucide-react'
import { api, type Movie } from '@/lib/api'
import { PosterCard, CardActionsProvider } from '@/app/components'

type Turn = { role: 'user' | 'assistant'; text: string; movies?: Movie[] }

const SUGGESTIONS = [
  'A dark sci-fi but not too slow',
  'Something funny and light for a chill night',
  'A gripping heist thriller',
  'A hidden-gem romance',
]

export default function ChatPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const userId = Number(params.id)

  const [turns, setTurns] = useState<Turn[]>([
    { role: 'assistant', text: "Tell me what you're in the mood for — a vibe, a genre, a feeling — and I'll find it." },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const sentInitial = useRef(false)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [turns, loading])

  useEffect(() => {
    if (sentInitial.current) return
    const q = new URLSearchParams(window.location.search).get('q')
    if (q) { sentInitial.current = true; send(q) }
  }, [])

  async function send(text: string) {
    if (!text.trim() || loading) return
    const next: Turn[] = [...turns, { role: 'user', text }]
    setTurns(next)
    setInput('')
    setLoading(true)
    const history = next.map((t) => ({ role: t.role, text: t.text }))
    try {
      const res = await api.chat(userId, history)
      setTurns((t) => [...t, { role: 'assistant', text: res.reply, movies: res.movies }])
    } catch {
      setTurns((t) => [...t, { role: 'assistant', text: 'Sorry — the AI guide is unavailable right now.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <CardActionsProvider value={{ onMoreLikeThis: (m) => send(`More movies like ${m.title}`), onOpen: (m) => router.push(`/u/${userId}/m/${m.movie_id}`) }}>
      <div className="mx-auto flex min-h-full max-w-3xl flex-col px-6 py-6">
        <header className="mb-6 flex items-center gap-4 border-b border-white/5 pb-3">
          <Link href={`/u/${userId}`} className="text-2xl font-extrabold tracking-tight text-red-600">CINE<span className="text-zinc-100">MATCH</span></Link>
          <Link href={`/u/${userId}`} className="text-xs text-zinc-400 transition hover:text-white">← Home</Link>
          <span className="flex items-center gap-1.5 text-sm text-fuchsia-400"><Sparkles className="h-4 w-4" /> AI Guide · Viewer #{userId}</span>
        </header>

        <div className="flex-1 space-y-5">
          {turns.map((t, i) => <Bubble key={i} turn={t} />)}
          {loading && <p className="flex items-center gap-1.5 text-sm text-zinc-500"><Sparkles className="h-3.5 w-3.5 animate-pulse text-fuchsia-400" /> CineMatch is thinking…</p>}
          <div ref={endRef} />
        </div>

        {turns.length <= 1 && (
          <div className="mb-3 mt-6 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => send(s)}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-fuchsia-500/50 hover:text-white">
                {s}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); send(input) }} className="sticky bottom-4 mt-4 flex gap-2">
          <input value={input} onChange={(e) => setInput(e.target.value)}
            placeholder="What are you in the mood for?"
            className="flex-1 rounded-xl border border-white/10 bg-zinc-900 px-4 py-3 text-sm outline-none focus:border-fuchsia-500" />
          <button type="submit" disabled={loading} aria-label="Send"
            className="flex items-center gap-1.5 rounded-xl bg-fuchsia-600 px-5 text-sm font-semibold text-white transition hover:bg-fuchsia-500 disabled:opacity-50">
            <Send className="h-4 w-4" /> Send
          </button>
        </form>
      </div>
    </CardActionsProvider>
  )
}

function Bubble({ turn }: { turn: Turn }) {
  const isUser = turn.role === 'user'
  return (
    <div className={isUser ? 'flex flex-col items-end' : 'flex flex-col items-start'}>
      <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${isUser ? 'bg-red-600 text-white' : 'bg-white/5 text-zinc-200'}`}>
        {turn.text}
      </div>
      {turn.movies && turn.movies.length > 0 && (
        <div className="mt-3 flex w-full gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {turn.movies.map((m) => <div key={m.movie_id} className="w-[120px] shrink-0"><PosterCard movie={m} /></div>)}
        </div>
      )}
    </div>
  )
}
