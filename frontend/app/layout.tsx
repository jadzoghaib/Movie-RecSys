import './globals.css'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Anton, Archivo, Hanken_Grotesk } from 'next/font/google'

const anton = Anton({ weight: '400', subsets: ['latin'], display: 'swap', variable: '--font-anton' })
const archivo = Archivo({ weight: ['500', '600', '700', '800', '900'], subsets: ['latin'], display: 'swap', variable: '--font-archivo' })
const hanken = Hanken_Grotesk({ weight: ['400', '500', '600', '700'], subsets: ['latin'], display: 'swap', variable: '--font-hanken' })

export const metadata: Metadata = {
  title: 'CineMatch — Movie Recommender',
  description: 'A MovieLens recommender-system prototype (multi-algorithm hybrid).',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${anton.variable} ${archivo.variable} ${hanken.variable}`}>
      <body className="min-h-full bg-[#0a0a0c] text-zinc-100 antialiased">{children}</body>
    </html>
  )
}
