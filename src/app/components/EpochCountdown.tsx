'use client'

import { useState, useEffect } from 'react'

interface Props {
  stats: {
    nextEpochStartTimestamp: number
    epochDurationSeconds: string
    currentEpoch: string
    genesisTimestamp: string
  } | null
}

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

export default function EpochCountdown({ stats }: Props) {
  const [now, setNow] = useState(Math.floor(Date.now() / 1000))

  useEffect(() => {
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(timer)
  }, [])

  if (!stats) {
    return (
      <div className="card p-6 glow-blue">
        <div className="text-center">
          <div className="text-zinc-500 text-sm mb-2">Next Epoch In</div>
          <div className="text-5xl font-mono font-bold text-zinc-600">--:--:--</div>
        </div>
      </div>
    )
  }

  const epochEnd = stats.nextEpochStartTimestamp
  const epochDuration = parseInt(stats.epochDurationSeconds)
  const epochStart = epochEnd - epochDuration
  const remaining = Math.max(0, epochEnd - now)
  const elapsed = Math.max(0, now - epochStart)
  const progress = Math.min(100, (elapsed / epochDuration) * 100)

  const hours = Math.floor(remaining / 3600)
  const minutes = Math.floor((remaining % 3600) / 60)
  const seconds = remaining % 60

  return (
    <div className="card p-6 glow-blue">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
            Epoch #{stats.currentEpoch} Progress
          </h2>
          <p className="text-xs text-zinc-600 mt-1">
            Resets every 24h
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-zinc-500">Next Epoch</div>
          <div className="text-xs font-mono text-zinc-400">
            {new Date(epochEnd * 1000).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Countdown */}
      <div className="text-center py-6">
        <div className="text-xs text-zinc-500 mb-3 uppercase tracking-widest">Time Remaining</div>
        <div className="text-6xl font-mono font-bold countdown-glow text-white tracking-wider">
          {pad(hours)}
          <span className="text-blue-500 mx-1">:</span>
          {pad(minutes)}
          <span className="text-blue-500 mx-1">:</span>
          {pad(seconds)}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="flex justify-between text-xs text-zinc-500 mb-2">
          <span>Epoch Start</span>
          <span>{progress.toFixed(1)}% elapsed</span>
          <span>Epoch End</span>
        </div>
        <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-1000 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}
