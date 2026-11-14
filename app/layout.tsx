import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Alegreya_Sans, Cinzel } from 'next/font/google'
import './globals.css'

const display = Cinzel({ subsets: ['latin'], weight: ['600', '700', '800', '900'], variable: '--font-display' })
const body = Alegreya_Sans({ subsets: ['latin'], weight: ['400', '500', '700', '800'], variable: '--font-body' })

export const metadata: Metadata = {
  title: 'Merge to Escape — Puzzle Game',
  description: 'Merge tiles, navigate obstacles, and find your way out across three handcrafted levels.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#12122a',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
