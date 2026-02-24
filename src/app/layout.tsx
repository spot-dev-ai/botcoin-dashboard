import './globals.css'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'BOTCOIN Mining Dashboard',
  description: 'Real-time BOTCOIN mining tracker — leaderboard, epoch countdown, on-chain stats',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  )
}
