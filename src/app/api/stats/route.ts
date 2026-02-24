import { NextResponse } from 'next/server'

const COORDINATOR = 'https://coordinator.agentmoney.net'
const ALCHEMY_URL = `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
const MINING_CONTRACT = '0xd572e61e1B627d4105832C815Ccd722B5baD9233'
const AVC_FALLBACK = 'https://botcoin.avc.codes/api/stats'

// On-chain call helper
async function ethCall(data: string): Promise<string | null> {
  try {
    const res = await fetch(ALCHEMY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', method: 'eth_call',
        params: [{ to: MINING_CONTRACT, data }, 'latest'], id: 1,
      }),
    })
    const json = await res.json()
    return json.result || null
  } catch { return null }
}

export const revalidate = 15
export const maxDuration = 15

export async function GET() {
  try {
    // Primary: coordinator + on-chain
    const [coordStats, coordEpoch, onChainEpoch, onChainGenesis, onChainDuration] = await Promise.all([
      fetch(`${COORDINATOR}/v1/stats`, { signal: AbortSignal.timeout(5000) }).then(r => r.json()).catch(() => null),
      fetch(`${COORDINATOR}/v1/epoch`, { signal: AbortSignal.timeout(5000) }).then(r => r.json()).catch(() => null),
      ethCall('0x76671808'), // currentEpoch()
      ethCall('0xcacf66ab'), // genesisTimestamp()
      ethCall('0xa70b9f0c'), // EPOCH_DURATION()
    ])

    const epochId = onChainEpoch ? parseInt(onChainEpoch, 16) : parseInt(coordEpoch?.epochId || coordStats?.currentEpoch || '0')
    const genesisTs = onChainGenesis ? parseInt(onChainGenesis, 16) : parseInt(coordEpoch?.genesisTimestamp || '0')
    const epochDuration = onChainDuration ? parseInt(onChainDuration, 16) : parseInt(coordEpoch?.epochDurationSeconds || '86400')

    // Get on-chain totalCredits for current epoch
    const epochHex = epochId.toString(16).padStart(64, '0')
    const [onChainTotalCredits, onChainEpochReward] = await Promise.all([
      ethCall('0x15a4d1e4' + epochHex), // totalCredits(epoch)
      ethCall('0x273aafa3' + epochHex), // epochReward(epoch)
    ])

    const totalCreditsOnChain = onChainTotalCredits ? parseInt(onChainTotalCredits, 16) : null

    // Calculate epoch timing
    const epochStartTs = genesisTs + (epochId * epochDuration)
    const nextEpochStartTs = epochStartTs + epochDuration

    const resp = NextResponse.json({
      activeMiners: coordStats?.activeMiners ?? 0,
      currentEpochId: String(epochId),
      currentEpochTotalCredits: String(totalCreditsOnChain ?? coordStats?.currentEpoch ?? 0),
      estimatedEpochReward: coordStats?.currentEpochEstimateRaw || (onChainEpochReward ? BigInt(onChainEpochReward).toString() : '0'),
      totalMined: coordStats?.totalMinedRaw || '0',
      genesisTimestamp: String(genesisTs),
      epochDurationSeconds: String(epochDuration),
      epochStartTimestamp: epochStartTs,
      nextEpochStartTimestamp: coordEpoch?.nextEpochStartTimestamp || nextEpochStartTs,
      lastUpdated: coordStats?.lastUpdated || Math.floor(Date.now() / 1000),
      source: coordStats ? 'coordinator+onchain' : 'onchain-only',
    })
    resp.headers.set('Cache-Control', 's-maxage=15, stale-while-revalidate=30')
    return resp
  } catch (error) {
    // Fallback: avc.codes
    try {
      const res = await fetch(AVC_FALLBACK)
      const data = await res.json()
      return NextResponse.json({ ...data, source: 'avc-fallback' })
    } catch {
      return NextResponse.json({ error: 'All data sources failed' }, { status: 500 })
    }
  }
}
