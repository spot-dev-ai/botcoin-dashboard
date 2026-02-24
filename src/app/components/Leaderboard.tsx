'use client'

interface Props {
  data: {
    epoch: string
    totalCredits: number
    totalMiners: number
    leaderboard: { address: string; credits: number; txCount: number }[]
  } | null
}

function truncateAddress(addr: string): string {
  return addr.slice(0, 6) + '...' + addr.slice(-4)
}

function getRankBadge(rank: number): string {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return `#${rank}`
}

export default function Leaderboard({ data }: Props) {
  const totalCredits = data?.totalCredits ?? 0

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg">🏆</span>
          <div>
            <h2 className="text-sm font-medium text-white">Mining Leaderboard</h2>
            <p className="text-xs text-zinc-500">
              Epoch #{data?.epoch ?? '...'} · {data?.totalMiners ?? 0} miners · {totalCredits} total credits
            </p>
          </div>
        </div>
        <div className="text-xs text-zinc-600 font-mono">
          Live on-chain data
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-xs text-zinc-500 uppercase tracking-wider">
              <th className="text-left py-3 px-4 font-medium">Rank</th>
              <th className="text-left py-3 px-4 font-medium">Wallet</th>
              <th className="text-right py-3 px-4 font-medium">Credits</th>
              <th className="text-right py-3 px-4 font-medium">Receipts</th>
              <th className="text-right py-3 px-4 font-medium">Share</th>
            </tr>
          </thead>
          <tbody>
            {data?.leaderboard.map((miner, i) => {
              const share = totalCredits > 0 ? ((miner.credits / totalCredits) * 100).toFixed(2) : '0'
              
              return (
                <tr
                  key={miner.address}
                  className="border-t border-white/[0.03] transition-colors hover:bg-white/[0.02]"
                >
                  <td className="py-3 px-4">
                    <span className={`text-sm ${i < 3 ? 'text-lg' : 'text-zinc-500 font-mono text-xs'}`}>
                      {getRankBadge(i + 1)}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <a
                      href={`https://basescan.org/address/${miner.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-sm text-zinc-300 hover:text-blue-400 transition-colors"
                    >
                      {truncateAddress(miner.address)}
                    </a>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="font-mono text-sm font-medium text-white">
                      {miner.credits.toLocaleString()}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="font-mono text-sm text-zinc-400">
                      {miner.txCount.toLocaleString()}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-zinc-600"
                          style={{ width: `${Math.min(100, parseFloat(share) * 2)}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs text-zinc-500 w-12 text-right">
                        {share}%
                      </span>
                    </div>
                  </td>
                </tr>
              )
            })}
            {(!data || data.leaderboard.length === 0) && (
              <tr>
                <td colSpan={5} className="py-12 text-center text-zinc-600">
                  {data ? 'No mining activity this epoch yet' : 'Loading leaderboard...'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
