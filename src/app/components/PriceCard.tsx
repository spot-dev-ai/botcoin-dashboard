'use client'

interface Props {
  price: {
    price: string
    change24h: number
    volume24h: number
    marketCap: number
  } | null
}

function formatUSD(n: number): string {
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(2) + 'K'
  return '$' + n.toFixed(2)
}

export default function PriceCard({ price }: Props) {
  const change = price?.change24h ?? 0
  const isPositive = change >= 0

  return (
    <div className="card p-6 h-full">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">🪙</span>
        <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">BOTCOIN Price</h2>
      </div>

      {price ? (
        <div className="space-y-4">
          {/* Price */}
          <div>
            <div className="text-3xl font-mono font-bold text-white">
              ${parseFloat(price.price).toFixed(8)}
            </div>
            <div className={`text-sm font-mono mt-1 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {isPositive ? '▲' : '▼'} {Math.abs(change).toFixed(2)}% (24h)
            </div>
          </div>

          {/* Stats */}
          <div className="space-y-3 pt-3 border-t border-white/[0.06]">
            <div className="flex justify-between items-center">
              <span className="text-xs text-zinc-500">Market Cap</span>
              <span className="text-sm font-mono text-zinc-300">
                {price.marketCap ? formatUSD(price.marketCap) : '—'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-zinc-500">24h Volume</span>
              <span className="text-sm font-mono text-zinc-300">
                {price.volume24h ? formatUSD(price.volume24h) : '—'}
              </span>
            </div>
          </div>

          {/* Links */}
          <div className="pt-3 border-t border-white/[0.06]">
            <a
              href="https://agentmoney.net"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              agentmoney.net ↗
            </a>
          </div>
        </div>
      ) : (
        <div className="text-zinc-600 font-mono text-2xl">...</div>
      )}
    </div>
  )
}
