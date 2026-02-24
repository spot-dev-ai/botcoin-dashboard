'use client'

import { useState, useEffect, useCallback } from 'react'
import StatsBar from './components/StatsBar'
import EpochCountdown from './components/EpochCountdown'
import Leaderboard from './components/Leaderboard'
import PriceCard from './components/PriceCard'

interface Stats {
  activeMiners: number
  currentEpoch: string
  totalMined: string
  currentEpochEstimate: string
  nextEpochStartTimestamp: number
  epochDurationSeconds: string
  genesisTimestamp: string
}

interface PriceData {
  price: string
  change24h: number
  volume24h: number
  marketCap: number
}

interface LeaderboardData {
  epoch: string
  totalCredits: number
  totalMiners: number
  leaderboard: { address: string; credits: number; txCount: number }[]
}

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [price, setPrice] = useState<PriceData | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardData | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const fetchAll = useCallback(async () => {
    try {
      const [statsRes, priceRes, lbRes] = await Promise.all([
        fetch('/api/stats'),
        fetch('/api/price'),
        fetch('/api/leaderboard'),
      ])
      
      if (statsRes.ok) setStats(await statsRes.json())
      if (priceRes.ok) setPrice(await priceRes.json())
      if (lbRes.ok) setLeaderboard(await lbRes.json())
      setLastUpdate(new Date())
    } catch (e) {
      console.error('Fetch error:', e)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [fetchAll])

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <nav className="border-b border-white/[0.06] bg-[#0a0a0a]/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">⛏️</span>
            <h1 className="font-bold text-lg tracking-tight text-white">BOTCOIN Mining</h1>
            <span className="text-xs text-zinc-500 hidden sm:inline px-2 py-0.5 bg-white/[0.04] rounded">Base Chain</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-slow" />
            <span className="text-xs text-zinc-500">
              Updated {lastUpdate.toLocaleTimeString()}
            </span>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Stats Bar */}
        <StatsBar stats={stats} />

        {/* Epoch + Price Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <EpochCountdown stats={stats} />
          </div>
          <div>
            <PriceCard price={price} />
          </div>
        </div>

        {/* Leaderboard */}
        <Leaderboard data={leaderboard} />
      </main>
    </div>
  )
}
