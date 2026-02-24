'use client'

function formatNumber(n: string | number, decimals = 0): string {
  const num = typeof n === 'string' ? parseFloat(n) : n
  if (isNaN(num)) return '...'
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B'
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M'
  if (num >= 1e3) return num.toLocaleString('en-US', { maximumFractionDigits: decimals })
  return num.toFixed(decimals)
}

interface Props {
  stats: {
    activeMiners: number
    currentEpoch: string
    totalMined: string
    currentEpochEstimate: string
  } | null
}

export default function StatsBar({ stats }: Props) {
  const cards = [
    {
      label: 'Active Miners',
      value: stats?.activeMiners ?? '...',
      icon: '⛏️',
      color: 'text-blue-400',
    },
    {
      label: `Current Epoch`,
      value: stats ? `#${stats.currentEpoch}` : '...',
      icon: '🔄',
      color: 'text-purple-400',
    },
    {
      label: 'Epoch Reward (Est.)',
      value: stats ? formatNumber(stats.currentEpochEstimate) + ' BOTCOIN' : '...',
      icon: '💰',
      color: 'text-amber-400',
    },
    {
      label: 'Total Mined',
      value: stats ? formatNumber(stats.totalMined) + ' BOTCOIN' : '...',
      icon: '💎',
      color: 'text-emerald-400',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="card p-4 group cursor-default"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm">{card.icon}</span>
            <span className="text-xs text-zinc-500 uppercase tracking-wider">{card.label}</span>
          </div>
          <div className={`text-xl font-bold font-mono truncate ${card.color}`}>
            {card.value}
          </div>
        </div>
      ))}
    </div>
  )
}
