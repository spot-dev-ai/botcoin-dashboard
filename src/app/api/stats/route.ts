import { NextResponse } from 'next/server'

const COORDINATOR = 'https://coordinator.agentmoney.net'

export async function GET() {
  try {
    const [statsRes, epochRes] = await Promise.all([
      fetch(`${COORDINATOR}/v1/stats`, { next: { revalidate: 15 } }),
      fetch(`${COORDINATOR}/v1/epoch`, { next: { revalidate: 15 } }),
    ])

    const stats = await statsRes.json()
    const epoch = await epochRes.json()

    return NextResponse.json({
      activeMiners: stats.activeMiners,
      currentEpoch: stats.currentEpoch,
      totalMined: stats.totalMined,
      totalMinedRaw: stats.totalMinedRaw,
      currentEpochEstimate: stats.currentEpochEstimate,
      currentEpochEstimateRaw: stats.currentEpochEstimateRaw,
      epochId: epoch.epochId,
      genesisTimestamp: epoch.genesisTimestamp,
      epochDurationSeconds: epoch.epochDurationSeconds,
      nextEpochStartTimestamp: epoch.nextEpochStartTimestamp,
      prevEpochId: epoch.prevEpochId,
      lastUpdated: stats.lastUpdated,
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
