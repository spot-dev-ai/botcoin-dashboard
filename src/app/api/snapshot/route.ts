import { NextResponse } from 'next/server'

export const revalidate = 0
export const maxDuration = 30

// This route bundles all 3 API calls into one response with aggressive CDN caching.
// The frontend loads this single file on mount — one request, all data, served from edge.

const COORDINATOR = 'https://coordinator.agentmoney.net'
const AVC_API = 'https://botcoin.avc.codes/api/leaderboard'
const BOTCOIN_CONTRACT = '0xA601877977340862Ca67f816eb079958E5bd0BA3'
const ALCHEMY_URL = `https://mainnet.base.org`
const MINING_CONTRACT = '0xcf5f2d541eeb0fb4ca35f1973de5f2b02dfc3716'
const POOL_ADDRESS = '0x5154ba0d6cfb5fe27644bc856064991e1c7672b7eb533d5d457db4c7144c2af5'

async function ethCall(data: string): Promise<string | null> {
  try {
    const res = await fetch(ALCHEMY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify({
        jsonrpc: '2.0', method: 'eth_call',
        params: [{ to: MINING_CONTRACT, data }, 'latest'], id: 1,
      }),
    })
    const json = await res.json()
    return json.result || null
  } catch { return null }
}

export async function GET() {
  try {
    // Fetch everything in parallel
    const [coordStats, dexRes, avcLb] = await Promise.all([
      fetch(`${COORDINATOR}/v1/stats`, { signal: AbortSignal.timeout(5000) }).then(r => r.json()).catch(() => null),
      fetch(`https://api.dexscreener.com/latest/dex/tokens/${BOTCOIN_CONTRACT}`, { signal: AbortSignal.timeout(5000) }).then(r => r.json()).catch(() => null),
      // Use avc.codes directly for leaderboard — fast, pre-aggregated
      fetch(`${AVC_API}?limit=200&sortBy=totalCredits&sortOrder=desc`, { signal: AbortSignal.timeout(8000) }).then(r => r.json()).catch(() => null),
    ])

    // On-chain epoch data
    const [onChainEpoch, onChainGenesis, onChainDuration] = await Promise.all([
      ethCall('0x76671808'),
      ethCall('0xcacf66ab'),
      ethCall('0xa70b9f0c'),
    ])

    const epochId = onChainEpoch ? parseInt(onChainEpoch, 16) : parseInt(coordStats?.currentEpoch || '0')
    const genesisTs = onChainGenesis ? parseInt(onChainGenesis, 16) : 0
    const epochDuration = onChainDuration ? parseInt(onChainDuration, 16) : 86400
    const epochHex = epochId.toString(16).padStart(64, '0')

    const onChainTotalCredits = await ethCall('0x15a4d1e4' + epochHex)

    const stats = {
      activeMiners: coordStats?.activeMiners ?? 0,
      currentEpochId: String(epochId),
      currentEpochTotalCredits: String(onChainTotalCredits ? parseInt(onChainTotalCredits, 16) : 0),
      estimatedEpochReward: coordStats?.currentEpochEstimateRaw || '0',
      totalMined: coordStats?.totalMinedRaw || '0',
      epochStartTimestamp: genesisTs + (epochId * epochDuration),
      nextEpochStartTimestamp: genesisTs + ((epochId + 1) * epochDuration),
      epochDurationSeconds: String(epochDuration),
      source: 'snapshot',
    }

    const pair = dexRes?.pairs?.[0]
    const price = pair ? {
      price: pair.priceUsd,
      change24h: pair.priceChange?.h24,
      change6h: pair.priceChange?.h6,
      change1h: pair.priceChange?.h1,
      volume24h: pair.volume?.h24,
      liquidity: pair.liquidity?.usd,
      marketCap: pair.marketCap || pair.fdv,
    } : null

    const snapshot = {
      stats,
      price,
      leaderboard: avcLb || { miners: [], pagination: { page: 1, limit: 200, total: 0, pages: 0 } },
      generatedAt: new Date().toISOString(),
      ts: Date.now(),
    }

    const resp = NextResponse.json(snapshot)
    // Edge caches for 45s, serves stale up to 5 min while revalidating
    resp.headers.set('Cache-Control', 's-maxage=45, stale-while-revalidate=300')
    return resp
  } catch (err) {
    return NextResponse.json({ error: 'Snapshot generation failed' }, { status: 500 })
  }
}
