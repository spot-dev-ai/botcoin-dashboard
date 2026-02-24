'use client'

import { useState, useEffect, useCallback } from 'react'
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts'
import WalletDrawer from './components/WalletDrawer'

interface Stats {
  activeMiners: number
  currentEpochId: string
  currentEpochTotalCredits: string
  estimatedEpochReward: string
  totalMined: string
  epochStartTimestamp: number
  nextEpochStartTimestamp: number
  epochDurationSeconds: string
  source: string
}

interface PriceData {
  price: string
  change24h: number
  volume24h: number
  marketCap: number
  history?: { t: number; p: number }[]
}

interface MinerEntry {
  rank: number
  address: string
  totalCredits: string
  totalSolves: string
  currentEpochCredits: string
  estimateReward: string
}

interface LeaderboardData {
  miners: MinerEntry[]
  pagination: { page: number; limit: number; total: number; pages: number }
  source: string
}

function formatBotcoin(raw: string): string {
  try {
    const n = BigInt(raw)
    const whole = n / BigInt(1e18)
    if (whole >= BigInt(1_000_000_000)) return (Number(whole) / 1e9).toFixed(2) + 'B'
    if (whole >= BigInt(1_000_000)) return (Number(whole) / 1e6).toFixed(2) + 'M'
    if (whole >= BigInt(1_000)) return (Number(whole) / 1e3).toFixed(2) + 'K'
    return whole.toString()
  } catch {
    const n = parseFloat(raw)
    if (isNaN(n)) return '---'
    if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
    if (n >= 1e3) return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
    return n.toFixed(2)
  }
}

function formatUsd(raw: string, price: number): string {
  try {
    const botcoin = Number(BigInt(raw) / BigInt(1e18))
    const usd = botcoin * price
    if (usd >= 1e6) return `$${(usd / 1e6).toFixed(2)}M`
    if (usd >= 1e3) return `$${(usd / 1e3).toFixed(2)}K`
    if (usd >= 1) return `$${usd.toFixed(2)}`
    return `$${usd.toFixed(4)}`
  } catch { return '' }
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
  const [page, setPage] = useState(1)
  const [sortBy, setSortBy] = useState('currentEpochCredits')
  const [sortOrder, setSortOrder] = useState('desc')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [drawerAddress, setDrawerAddress] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Hydrate from localStorage cache on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem('botcoin-cache')
      if (cached) {
        const { stats: s, price: p, lb: l, time } = JSON.parse(cached)
        if (s) setStats(s)
        if (p) setPrice(p)
        if (l) setLb(l)
        if (time) setLastUpdate(time + ' (cached)')
      }
    } catch {}
  }, [])

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: '200', sortBy, sortOrder })

      const [s, p, l] = await Promise.all([
        fetch('/api/stats').then(r => r.json()),
        fetch('/api/price').then(r => r.json()),
        fetch(`/api/leaderboard?${params}`).then(r => r.json()),
      ])
      setStats(s)
      setPrice(p)
      setLb(l)
      const time = new Date().toLocaleTimeString()
      setLastUpdate(time)
      try {
        localStorage.setItem('botcoin-cache', JSON.stringify({ stats: s, price: p, lb: l, time }))
      } catch {}
    } catch {}
  }, [page, sortBy, sortOrder])

  useEffect(() => {
    fetchData()
    const i = setInterval(fetchData, 30000)
    return () => clearInterval(i)
  }, [fetchData])

  useEffect(() => {
    const i = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(i)
  }, [])

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(o => o === 'desc' ? 'asc' : 'desc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setPage(1)
  }

  // Countdown
  const epochEnd = stats?.nextEpochStartTimestamp ?? 0
  const epochStart = stats?.epochStartTimestamp ?? 0
  const epochDuration = parseInt(stats?.epochDurationSeconds ?? '86400')
  const remaining = Math.max(0, epochEnd - now)
  const elapsed = Math.max(0, now - epochStart)
  const progress = epochDuration > 0 ? Math.min(100, (elapsed / epochDuration) * 100) : 0
  const h = Math.floor(remaining / 3600)
  const m = Math.floor((remaining % 3600) / 60)
  const s = remaining % 60
  const priceNum = price ? parseFloat(price.price) : 0
  const change24h = price?.change24h ?? 0

  return (
    <div className="min-h-screen bg-[rgb(2,2,2)] scanlines">
      <nav className="border-b border-white/[0.04] bg-[rgb(2,2,2)]/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-[82rem] mx-auto px-4 h-11 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-green text-xs">▶</span>
            <span className="text-xs font-medium text-[#e0e0e0]">BOTCOIN</span>
            <span className="text-[10px] text-[#555] px-1.5 py-0.5 border border-white/[0.06] rounded">MINING TRACKER</span>
            <span className="text-[10px] text-[#555]">// base chain</span>
          </div>
          <div className="flex items-center gap-3">
            {stats?.source && (
              <span className="text-[10px] text-[#333]" title={stats.source}>
                {stats.source.includes('onchain') ? '⛓' : stats.source.includes('avc') ? '🔄' : '•'}
              </span>
            )}
            <div className="pulse-dot" />
            <span className="text-[10px] text-[#555]">{lastUpdate || '...'}</span>
          </div>
        </div>
      </nav>

      <main className="max-w-[82rem] mx-auto px-4 py-6 space-y-4">
        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <StatBox label="MINERS" value={stats?.activeMiners?.toString() ?? '---'} />
          <StatBox label="EPOCH" value={stats ? `#${stats.currentEpochId}` : '---'} accent />
          <StatBox
            label="EPOCH CREDITS"
            value={stats?.currentEpochTotalCredits ?? '---'}
            valueColor="text-green"
          />
          <StatBox
            label="EPOCH REWARD"
            value={stats ? formatBotcoin(stats.estimatedEpochReward) : '---'}
            sub={stats && priceNum ? formatUsd(stats.estimatedEpochReward, priceNum) : undefined}
            valueColor="text-green"
          />
          <div className="col-span-2 lg:col-span-1">
            <PriceBox
              price={priceNum}
              change24h={change24h}
              history={price?.history}
            />
          </div>
        </div>

        {/* Epoch countdown */}
        <div className="term-card">
          <div className="term-header">
            <div className="term-dot bg-[#00ff88]" />
            <div className="term-dot bg-[#ffaa00]" />
            <div className="term-dot bg-[#555]" />
            <span className="text-[10px] text-[#555] ml-2">epoch_{stats?.currentEpochId ?? '?'}.progress</span>
          </div>
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[10px] text-[#555] uppercase tracking-widest">time to next epoch</div>
              <div className="text-[10px] text-[#555]">{progress.toFixed(1)}% complete</div>
            </div>
            <div className="text-center py-4" style={{ marginTop: '-30px' }}>
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

        {/* Leaderboard + sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-3 term-card">
            <div className="term-header">
              <div className="term-dot bg-[#00ccff]" />
              <div className="term-dot bg-[#555]" />
              <div className="term-dot bg-[#555]" />
              <span className="text-[10px] text-[#555] ml-2">
                leaderboard // {lb?.pagination?.total ?? 0} miners
                {lb?.source && ` [${lb.source}]`}
              </span>
            </div>

            {/* Search */}
            <div className="px-4 pt-3 pb-2">
              <input
                type="text"
                placeholder="search by address..."
                value={searchInput}
                onChange={e => { const v = e.target.value; setSearchInput(v); setSearch(v.trim().toLowerCase()); setPage(1) }}
                className="w-full bg-[#060606] border border-white/[0.06] rounded px-3 py-1.5 text-xs text-[#888] placeholder:text-[#333] focus:outline-none focus:border-[#00ff88]/30"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full term-table">
                <thead>
                  <tr>
                    <th className="w-12">#</th>
                    <th>wallet</th>
                    <SortTh field="totalCredits" label="total credits" current={sortBy} order={sortOrder} onSort={handleSort} />
                    <SortTh field="totalSolves" label="solves" current={sortBy} order={sortOrder} onSort={handleSort} />
                    <SortTh field="currentEpochCredits" label="epoch credits" current={sortBy} order={sortOrder} onSort={handleSort} />
                    <SortTh field="estimateReward" label="est. reward" current={sortBy} order={sortOrder} onSort={handleSort} />
                  </tr>
                </thead>
                <tbody>
                  {lb?.miners.filter(m => !search || m.address.includes(search)).map((miner) => {
                    const rankClass = miner.rank === 1 ? 'rank-1' : miner.rank === 2 ? 'rank-2' : miner.rank === 3 ? 'rank-3' : 'text-[#555]'
                    const epochCredits = parseInt(miner.currentEpochCredits)
                    const reward = BigInt(miner.estimateReward || '0')

                    return (
                      <tr key={miner.address}>
                        <td className={`font-medium ${rankClass}`}>
                          {miner.rank <= 3 ? ['①', '②', '③'][miner.rank - 1] : miner.rank}
                        </td>
                        <td>
                          <button
                            onClick={() => { setDrawerAddress(miner.address); setDrawerOpen(true) }}
                            className="text-[#888] hover:text-cyan transition-colors duration-200 text-left cursor-pointer"
                          >
                            <span className="hidden sm:inline">{miner.address}</span>
                            <span className="sm:hidden">{truncAddr(miner.address)}</span>
                          </button>
                        </td>
                        <td className="text-right text-[#e0e0e0] font-medium">{parseInt(miner.totalCredits).toLocaleString()}</td>
                        <td className="text-right text-[#666]">{parseInt(miner.totalSolves).toLocaleString()}</td>
                        <td className="text-right">
                          <span className={epochCredits > 0 ? 'text-[#00ccff]' : 'text-[#444]'}>
                            {epochCredits > 0 ? epochCredits.toLocaleString() : '-'}
                          </span>
                        </td>
                        <td className="text-right">
                          {reward > BigInt(0) ? (
                            <span className="text-green">
                              {formatBotcoin(miner.estimateReward)}
                              {priceNum > 0 && (
                                <span className="text-green/70 text-[10px] ml-1">
                                  ({formatUsd(miner.estimateReward, priceNum)})
                                </span>
                              )}
                            </span>
                          ) : <span className="text-[#444]">-</span>}
                        </td>
                      </tr>
                    )
                  })}
                  {(!lb || lb.miners.length === 0) && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-[#444]">
                        {lb ? '> no miners found_' : '> loading...'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {lb && lb.pagination && lb.pagination.pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.04]">
                <span className="text-[10px] text-[#444]">
                  page {lb.pagination.page}/{lb.pagination.pages} ({lb.pagination.total} miners)
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 text-[10px] border border-white/[0.06] rounded text-[#555] hover:text-[#888] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    PREV
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(lb!.pagination.pages, p + 1))}
                    disabled={page === lb.pagination.pages}
                    className="px-3 py-1 text-[10px] border border-white/[0.06] rounded text-[#555] hover:text-[#888] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    NEXT
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="term-card">
            <div className="term-header">
              <div className="term-dot bg-[#ffaa00]" />
              <div className="term-dot bg-[#555]" />
              <div className="term-dot bg-[#555]" />
              <span className="text-[10px] text-[#555] ml-2">market.dat</span>
            </div>
            <div className="p-4 space-y-4">
              <div className="relative overflow-hidden rounded -mx-4 -mt-4 px-4 pt-4">
                {/* Sidebar sparkline */}
                {price?.history && price.history.length > 1 && (
                  <>
                    <div className="absolute inset-0 opacity-0 animate-fade-in" style={{ width: '70%', marginLeft: '30%', height: '85%', top: '15%' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={price.history} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                          <defs>
                            <linearGradient id="sidebarSparkGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#00ff88" stopOpacity={0.25} />
                              <stop offset="100%" stopColor="#00ff88" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <YAxis domain={['dataMin', 'dataMax']} hide />
                          <Area
                            type="monotone"
                            dataKey="p"
                            stroke="#00ff88"
                            strokeWidth={1.5}
                            fill="url(#sidebarSparkGrad)"
                            isAnimationActive={true}
                            animationDuration={1200}
                            animationEasing="ease-out"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to left, transparent -10%, rgb(6, 6, 6) 65%)' }} />
                  </>
                )}
                <div className="relative z-10">
                  <div className="text-[10px] text-[#555] uppercase tracking-wider mb-1">price</div>
                  <div className="text-xl font-bold text-[#e0e0e0]">
                    {priceNum ? `$${priceNum.toFixed(8)}` : '---'}
                  </div>
                  {price && change24h !== 0 && (
                    <div className={`text-xs mt-1 ${change24h >= 0 ? 'text-green' : 'text-red'}`}>
                      {change24h >= 0 ? '↑' : '↓'} {Math.abs(change24h).toFixed(2)}% 24h
                    </div>
                  )}
                </div>
              </div>
              <div className="border-t border-white/[0.04] pt-3 space-y-3">
                <InfoRow label="mcap" value={price?.marketCap ? formatBotcoin(String(BigInt(Math.floor(price.marketCap)) * BigInt(1e18))) : '---'} />
                <InfoRow label="vol 24h" value={price?.volume24h ? `$${(price.volume24h >= 1000 ? (price.volume24h/1000).toFixed(1)+'K' : price.volume24h.toFixed(0))}` : '---'} />
                <InfoRow label="total mined" value={stats ? formatBotcoin(stats.totalMined) : '---'} />
                <InfoRow label="miners" value={stats?.activeMiners?.toString() ?? '---'} />
              </div>
              <div className="border-t border-white/[0.04] pt-3 space-y-2">
                <a href="https://agentmoney.net" target="_blank" className="block text-[10px] text-[#555] hover:text-white" style={{ transition: 'color 0.3s ease-out' }}>
                  agentmoney.net ↗
                </a>
                <a href="https://dexscreener.com/base/0xA601877977340862Ca67f816eb079958E5bd0BA3" target="_blank" className="block text-[10px] text-[#555] hover:text-white" style={{ transition: 'color 0.3s ease-out' }}>
                  dexscreener ↗
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center pt-4 pb-8">
          <span className="text-[10px] text-[#333] cursor-blink">botcoin mining tracker v2.0 — on-chain verified </span>
        </div>
      </main>

      <WalletDrawer
        address={drawerAddress}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  )
}

function StatBox({ label, value, sub, subColor, accent, valueColor }: {
  label: string; value: string; sub?: string; subColor?: string; accent?: boolean; valueColor?: string
}) {
  return (
    <div className="term-card p-3">
      <div className="text-[10px] text-[#555] uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-lg font-bold truncate ${valueColor ? valueColor : accent ? 'text-green glow-green' : 'text-[#e0e0e0]'}`}>{value}</div>
      {sub && <div className={`text-[10px] mt-0.5 ${subColor ?? 'text-[#555]'}`}>{sub}</div>}
    </div>
  )
}

function PriceBox({ price, change24h, history }: {
  price: number; change24h: number; history?: { t: number; p: number }[]
}) {
  const chartData = history && history.length > 1 ? history : null

  return (
    <div className="term-card p-3 relative overflow-hidden">
      {/* Sparkline behind text */}
      {chartData && (
        <div className="absolute inset-0 flex items-end">
          <div className="w-full opacity-0 animate-fade-in" style={{ width: '70%', marginLeft: '30%', height: '85%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00ff88" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#00ff88" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="sparkFadeRight" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="rgb(2,2,2)" stopOpacity={0} />
                    <stop offset="60%" stopColor="rgb(2,2,2)" stopOpacity={0} />
                    <stop offset="100%" stopColor="rgb(2,2,2)" stopOpacity={0.95} />
                  </linearGradient>
                </defs>
                <YAxis domain={['dataMin', 'dataMax']} hide />
                <Area
                  type="monotone"
                  dataKey="p"
                  stroke="#00ff88"
                  strokeWidth={1.5}
                  fill="url(#sparkGrad)"
                  isAnimationActive={true}
                  animationDuration={1200}
                  animationEasing="ease-out"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {/* Fade-out gradient overlay on the right */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(to left, transparent -10%, rgb(6, 6, 6) 65%)',
            }}
          />
        </div>
      )}
      {/* Text on top */}
      <div className="relative z-10">
        <div className="text-[10px] text-[#555] uppercase tracking-wider mb-1">PRICE</div>
        <div className="text-lg font-bold truncate text-[#e0e0e0]">
          {price ? `$${price.toFixed(8)}` : '---'}
        </div>
        {change24h !== 0 && (
          <div className={`text-[10px] mt-0.5 ${change24h >= 0 ? 'text-green' : 'text-red'}`}>
            {change24h > 0 ? '+' : ''}{change24h.toFixed(1)}%
          </div>
        )}
      </div>
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

function SortTh({ field, label, current, order, onSort }: {
  field: string; label: string; current: string; order: string; onSort: (f: string) => void
}) {
  const active = current === field
  return (
    <th
      className="text-right cursor-pointer select-none hover:text-[#888] transition-colors"
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1 justify-end">
        {label}
        <span className={`text-[10px] ${active ? 'text-cyan' : 'text-[#333]'}`}>
          {active ? (order === 'desc' ? '▼' : '▲') : '▼'}
        </span>
      </span>
    </th>
  )
}
