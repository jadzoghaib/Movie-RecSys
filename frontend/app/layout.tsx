import './globals.css'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'], display: 'swap' })

export const metadata: Metadata = {
  title: 'CineMatch — Movie Recommender',
  description: 'A MovieLens recommender-system prototype (multi-algorithm hybrid).',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body className="min-h-full bg-[#0b0b0f] text-zinc-100 antialiased">{children}</body>
    </html>
  )
}
