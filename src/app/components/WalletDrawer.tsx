'use client'

import { useState, useEffect } from 'react'
import { Drawer } from 'vaul'

interface EpochData {
  epoch: number
  credits: number
  onChainCredits: number
}

interface WalletData {
  address: string
  totalCredits: number
  totalSolves: number
  epochsMined: number
  totalEpochs: number
  firstEpoch: number | null
  currentEpochCredits: number
  estimatedReward: string
  maxCreditsInEpoch: number
  epochHistory: EpochData[]
  activityGrid: { epoch: number; credits: number; active: boolean }[]
}

function formatBotcoin(raw: string): string {
  try {
    const n = BigInt(raw)
    const whole = n / BigInt(1e18)
    if (whole >= BigInt(1_000_000)) return (Number(whole) / 1e6).toFixed(2) + 'M'
    if (whole >= BigInt(1_000)) return (Number(whole) / 1e3).toFixed(2) + 'K'
    return whole.toString()
  } catch { return '---' }
}

function ActivityGrid({ data, max }: { data: { epoch: number; credits: number }[]; max: number }) {
  // GitHub-style grid: 7 rows (like days), columns = ceil(epochs/7)
  const cols = Math.ceil(data.length / 7)
  const cells = []

  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < 7; row++) {
      const idx = col * 7 + row
      if (idx < data.length) {
        const d = data[idx]
        const intensity = max > 0 ? d.credits / max : 0
        cells.push({ ...d, intensity })
      }
    }
  }

  return (
    <div className="flex gap-[3px] flex-wrap">
      {data.map((d, i) => {
        const intensity = max > 0 ? d.credits / max : 0
        const bg = d.credits === 0
          ? 'bg-[#161616]'
          : intensity > 0.75
            ? 'bg-[#00ff88]'
            : intensity > 0.5
              ? 'bg-[#00ff88]/70'
              : intensity > 0.25
                ? 'bg-[#00ff88]/40'
                : 'bg-[#00ff88]/20'
        return (
          <div
            key={i}
            className={`w-[14px] h-[14px] rounded-[2px] ${bg} transition-colors`}
            title={`Epoch ${d.epoch}: ${d.credits} credits`}
          />
        )
      })}
    </div>
  )
}

function EpochBar({ epoch, credits, max }: { epoch: number; credits: number; max: number }) {
  const width = max > 0 ? Math.max(2, (credits / max) * 100) : 0
  return (
    <div className="flex items-center gap-2 text-[10px]">
      <span className="text-[#555] w-8 text-right">#{epoch}</span>
      <div className="flex-1 h-3 bg-[#161616] rounded-sm overflow-hidden">
        <div
          className="h-full bg-[#00ff88]/60 rounded-sm transition-all duration-500"
          style={{ width: `${width}%` }}
        />
      </div>
      <span className="text-[#888] w-12 text-right">{credits}</span>
    </div>
  )
}

export default function WalletDrawer({
  address,
  open,
  onClose,
}: {
  address: string | null
  open: boolean
  onClose: () => void
}) {
  const [data, setData] = useState<WalletData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!address || !open) return
    setLoading(true)
    setData(null)
    fetch(`/api/wallet?address=${address}`)
      .then(r => r.json())
      .then(d => { if (!d.error) setData(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [address, open])

  return (
    <Drawer.Root open={open} onOpenChange={v => { if (!v) onClose() }}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/60 z-40" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 outline-none flex justify-center">
          <div className="bg-[#0a0a0a] border-t border-white/[0.06] rounded-t-xl max-h-[85vh] overflow-y-auto w-full" style={{ maxWidth: 'calc(72rem + 40px)' }}>
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-[#333]" />
            </div>

            <div className="px-6 pb-[100px]">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <Drawer.Title className="text-sm font-medium text-[#e0e0e0]">
                    {address ? (
                      <a
                        href={`https://basescan.org/address/${address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-white transition-colors duration-300"
                      >
                        {address}
                      </a>
                    ) : '---'}
                  </Drawer.Title>
                  <p className="text-[10px] text-[#555] mt-1">miner profile</p>
                </div>
                <button
                  onClick={onClose}
                  className="text-[#555] hover:text-white text-xs transition-colors duration-300"
                >
                  ✕
                </button>
              </div>

              {loading && (
                <div className="text-center py-12 text-[#555] text-xs">loading...</div>
              )}

              {data && (
                <div className="space-y-6">
                  {/* Stats row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <MiniStat label="TOTAL CREDITS" value={data.totalCredits.toLocaleString()} color="text-[#00ccff]" />
                    <MiniStat label="TOTAL SOLVES" value={data.totalSolves.toLocaleString()} />
                    <MiniStat label="EPOCHS MINED" value={`${data.epochsMined}/${data.totalEpochs}`} />
                    <MiniStat label="EST. REWARD" value={formatBotcoin(data.estimatedReward)} color="text-green" />
                  </div>

                  {/* More stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <MiniStat label="CURRENT EPOCH" value={data.currentEpochCredits.toLocaleString()} color="text-[#00ccff]" />
                    <MiniStat label="FIRST EPOCH" value={data.firstEpoch ? `#${data.firstEpoch}` : 'N/A'} />
                    <MiniStat label="BEST EPOCH" value={data.maxCreditsInEpoch.toLocaleString()} />
                    <MiniStat
                      label="AVG / EPOCH"
                      value={data.epochsMined > 0 ? Math.round(data.totalCredits / data.epochsMined).toLocaleString() : '0'}
                    />
                  </div>

                  {/* Activity grid */}
                  <div>
                    <div className="text-[10px] text-[#555] uppercase tracking-wider mb-3">mining activity</div>
                    <ActivityGrid data={data.activityGrid} max={data.maxCreditsInEpoch} />
                    <div className="flex items-center gap-1 mt-2 text-[10px] text-[#444]">
                      <span>less</span>
                      <div className="w-[10px] h-[10px] rounded-[2px] bg-[#161616]" />
                      <div className="w-[10px] h-[10px] rounded-[2px] bg-[#00ff88]/20" />
                      <div className="w-[10px] h-[10px] rounded-[2px] bg-[#00ff88]/40" />
                      <div className="w-[10px] h-[10px] rounded-[2px] bg-[#00ff88]/70" />
                      <div className="w-[10px] h-[10px] rounded-[2px] bg-[#00ff88]" />
                      <span>more</span>
                    </div>
                  </div>

                  {/* Epoch breakdown bars */}
                  <div>
                    <div className="text-[10px] text-[#555] uppercase tracking-wider mb-3">credits per epoch</div>
                    <div className="space-y-1.5">
                      {data.epochHistory
                        .filter(e => e.credits > 0)
                        .reverse()
                        .map(e => (
                          <EpochBar key={e.epoch} epoch={e.epoch} credits={e.credits} max={data.maxCreditsInEpoch} />
                        ))}
                      {data.epochHistory.filter(e => e.credits > 0).length === 0 && (
                        <div className="text-[10px] text-[#444] py-4 text-center">no mining history</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-[#111] border border-white/[0.04] rounded p-3">
      <div className="text-[10px] text-[#555] uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-sm font-bold ${color || 'text-[#e0e0e0]'}`}>{value}</div>
    </div>
  )
}
