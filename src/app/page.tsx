'use client'

import { useState, useEffect, useCallback } from 'react'

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

interface LeaderboardEntry {
  address: string
  credits: number
  txCount: number
}

interface LeaderboardData {
  epoch: string
  totalCredits: number
  totalMiners: number
  leaderboard: LeaderboardEntry[]
}

function formatNum(n: string | number): string {
  const num = typeof n === 'string' ? parseFloat(n) : n
  if (isNaN(num)) return '---'
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B'
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M'
  if (num >= 1e3) return num.toLocaleString('en-US', { maximumFractionDigits: 0 })
  return num.toString()
}

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

function truncAddr(a: string): string {
  return a.slice(0, 6) + '···' + a.slice(-4)
}

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [price, setPrice] = useState<PriceData | null>(null)
  const [lb, setLb] = useState<LeaderboardData | null>(null)
  const [now, setNow] = useState(Math.floor(Date.now() / 1000))
  const [lastUpdate, setLastUpdate] = useState('')

  const fetchAll = useCallback(async () => {
    try {
      const [s, p, l] = await Promise.all([
        fetch('/api/stats').then(r => r.json()),
        fetch('/api/price').then(r => r.json()),
        fetch('/api/leaderboard').then(r => r.json()),
      ])
      setStats(s)
      setPrice(p)
      setLb(l)
      setLastUpdate(new Date().toLocaleTimeString())
    } catch {}
  }, [])

  useEffect(() => {
    fetchAll()
    const i = setInterval(fetchAll, 30000)
    return () => clearInterval(i)
  }, [fetchAll])

  useEffect(() => {
    const i = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(i)
  }, [])

  // Countdown
  const epochEnd = stats?.nextEpochStartTimestamp ?? 0
  const epochDuration = parseInt(stats?.epochDurationSeconds ?? '86400')
  const epochStart = epochEnd - epochDuration
  const remaining = Math.max(0, epochEnd - now)
  const elapsed = Math.max(0, now - epochStart)
  const progress = epochDuration > 0 ? Math.min(100, (elapsed / epochDuration) * 100) : 0
  const h = Math.floor(remaining / 3600)
  const m = Math.floor((remaining % 3600) / 60)
  const s = remaining % 60

  const change24h = price?.change24h ?? 0

  return (
    <div className="min-h-screen bg-[#0a0a0a] scanlines">
      {/* Nav */}
      <nav className="border-b border-white/[0.04] bg-[#0a0a0a]/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-11 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-green text-xs">▶</span>
            <span className="text-xs font-medium text-[#e0e0e0]">BOTCOIN</span>
            <span className="text-[10px] text-[#555] px-1.5 py-0.5 border border-white/[0.06] rounded">MINING TRACKER</span>
            <span className="text-[10px] text-[#555]">// base chain</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="pulse-dot" />
            <span className="text-[10px] text-[#555]">{lastUpdate || '...'}</span>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        {/* Top row: Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatBox label="MINERS" value={stats?.activeMiners?.toString() ?? '---'} />
          <StatBox label="EPOCH" value={stats ? `#${stats.currentEpoch}` : '---'} accent />
          <StatBox label="EPOCH REWARD" value={stats ? formatNum(stats.currentEpochEstimate) : '---'} sub="BOTCOIN" />
          <StatBox label="TOTAL MINED" value={stats ? formatNum(stats.totalMined) : '---'} sub="BOTCOIN" />
          <StatBox
            label="PRICE"
            value={price ? `$${parseFloat(price.price).toFixed(8)}` : '---'}
            sub={change24h !== 0 ? `${change24h > 0 ? '+' : ''}${change24h.toFixed(1)}%` : undefined}
            subColor={change24h >= 0 ? 'text-green' : 'text-red'}
          />
        </div>

        {/* Epoch countdown */}
        <div className="term-card">
          <div className="term-header">
            <div className="term-dot bg-[#00ff88]" />
            <div className="term-dot bg-[#ffaa00]" />
            <div className="term-dot bg-[#555]" />
            <span className="text-[10px] text-[#555] ml-2">epoch_{stats?.currentEpoch ?? '?'}.progress</span>
          </div>
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[10px] text-[#555] uppercase tracking-widest">time to next epoch</div>
              <div className="text-[10px] text-[#555]">
                {progress.toFixed(1)}% complete
              </div>
            </div>
            <div className="text-center py-4">
              <div className="text-5xl font-bold glow-green text-green tracking-[0.15em]">
                {pad(h)}<span className="countdown-sep text-[#555]">:</span>{pad(m)}<span className="countdown-sep text-[#555]">:</span>{pad(s)}
              </div>
            </div>
            <div className="progress-bar mt-4">
              <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-[#444]">
              <span>{epochStart > 0 ? new Date(epochStart * 1000).toUTCString().slice(17, 25) + ' UTC' : '---'}</span>
              <span>{epochEnd > 0 ? new Date(epochEnd * 1000).toUTCString().slice(17, 25) + ' UTC' : '---'}</span>
            </div>
          </div>
        </div>

        {/* Bottom row: Leaderboard + Price info */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Leaderboard */}
          <div className="lg:col-span-3 term-card">
            <div className="term-header">
              <div className="term-dot bg-[#00ccff]" />
              <div className="term-dot bg-[#555]" />
              <div className="term-dot bg-[#555]" />
              <span className="text-[10px] text-[#555] ml-2">
                leaderboard // epoch #{lb?.epoch ?? '?'} — {lb?.totalMiners ?? 0} miners — {lb?.totalCredits ?? 0} credits
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full term-table">
                <thead>
                  <tr>
                    <th className="w-12">#</th>
                    <th>wallet</th>
                    <th className="text-right">credits</th>
                    <th className="text-right">receipts</th>
                    <th className="text-right">share</th>
                  </tr>
                </thead>
                <tbody>
                  {lb?.leaderboard.map((miner, i) => {
                    const share = lb.totalCredits > 0
                      ? ((miner.credits / lb.totalCredits) * 100).toFixed(1)
                      : '0'
                    const rankClass = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : 'text-[#555]'

                    return (
                      <tr key={miner.address}>
                        <td className={`font-medium ${rankClass}`}>
                          {i < 3 ? ['①', '②', '③'][i] : `${i + 1}`}
                        </td>
                        <td>
                          <a
                            href={`https://basescan.org/address/${miner.address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#888] hover:text-cyan transition-colors"
                          >
                            {truncAddr(miner.address)}
                          </a>
                        </td>
                        <td className="text-right text-[#e0e0e0] font-medium">{miner.credits.toLocaleString()}</td>
                        <td className="text-right text-[#666]">{miner.txCount.toLocaleString()}</td>
                        <td className="text-right">
                          <span className="text-[#555]">{share}%</span>
                        </td>
                      </tr>
                    )
                  })}
                  {(!lb || lb.leaderboard.length === 0) && (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-[#444]">
                        {lb ? '> no mining activity this epoch yet_' : '> loading...'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sidebar: Market data */}
          <div className="term-card">
            <div className="term-header">
              <div className="term-dot bg-[#ffaa00]" />
              <div className="term-dot bg-[#555]" />
              <div className="term-dot bg-[#555]" />
              <span className="text-[10px] text-[#555] ml-2">market.dat</span>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <div className="text-[10px] text-[#555] uppercase tracking-wider mb-1">price</div>
                <div className="text-xl font-bold text-[#e0e0e0]">
                  {price ? `$${parseFloat(price.price).toFixed(8)}` : '---'}
                </div>
                {price && (
                  <div className={`text-xs mt-1 ${change24h >= 0 ? 'text-green' : 'text-red'}`}>
                    {change24h >= 0 ? '↑' : '↓'} {Math.abs(change24h).toFixed(2)}% 24h
                  </div>
                )}
              </div>
              <div className="border-t border-white/[0.04] pt-3 space-y-3">
                <InfoRow label="mcap" value={price?.marketCap ? formatNum(price.marketCap) : '---'} />
                <InfoRow label="vol 24h" value={price?.volume24h ? formatNum(price.volume24h) : '---'} />
                <InfoRow label="miners" value={stats?.activeMiners?.toString() ?? '---'} />
                <InfoRow label="epoch" value={stats?.currentEpoch ?? '---'} />
              </div>
              <div className="border-t border-white/[0.04] pt-3">
                <a
                  href="https://agentmoney.net"
                  target="_blank"
                  className="text-[10px] text-[#555] hover:text-cyan transition-colors"
                >
                  agentmoney.net ↗
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pt-4 pb-8">
          <span className="text-[10px] text-[#333] cursor-blink">botcoin mining tracker v1.0 </span>
        </div>
      </main>
    </div>
  )
}

function StatBox({ label, value, sub, subColor, accent }: {
  label: string; value: string; sub?: string; subColor?: string; accent?: boolean
}) {
  return (
    <div className="term-card p-3">
      <div className="text-[10px] text-[#555] uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-lg font-bold truncate ${accent ? 'text-green glow-green' : 'text-[#e0e0e0]'}`}>
        {value}
      </div>
      {sub && <div className={`text-[10px] mt-0.5 ${subColor ?? 'text-[#555]'}`}>{sub}</div>}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[10px] text-[#555]">{label}</span>
      <span className="text-xs text-[#888]">{value}</span>
    </div>
  )
}
