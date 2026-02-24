import { NextResponse } from 'next/server'

const ALCHEMY_URL = `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
const MINING_CONTRACT = '0xd572e61e1B627d4105832C815Ccd722B5baD9233'
const COORDINATOR = 'https://coordinator.agentmoney.net'
const AVC_API = 'https://botcoin.avc.codes/api/leaderboard'

// --- In-memory cache for miner addresses (refreshed every 5 min) ---
let cachedAddresses: string[] = []
let cachedTotalCredits = new Map<string, string>()
let addressCacheTime = 0
const ADDRESS_CACHE_TTL = 5 * 60 * 1000 // 5 min

// --- Leaderboard cache (refreshed every 30s) ---
interface MinerData {
  address: string
  totalCredits: string
  totalSolves: string
  currentEpochCredits: string
  estimateReward: string
}
let cachedLeaderboard: MinerData[] = []
let leaderboardCacheTime = 0
const LEADERBOARD_CACHE_TTL = 45 * 1000 // 45s

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

// Batch eth_call using Alchemy's batch JSON-RPC
async function ethCallBatch(calls: { data: string; id: number }[]): Promise<Map<number, string>> {
  const results = new Map<number, string>()
  if (calls.length === 0) return results

  // Split into chunks of 50 to avoid rate limits
  const chunks = []
  for (let i = 0; i < calls.length; i += 50) {
    chunks.push(calls.slice(i, i + 50))
  }

  for (const chunk of chunks) {
    try {
      const res = await fetch(ALCHEMY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(8000),
        body: JSON.stringify(chunk.map(c => ({
          jsonrpc: '2.0', method: 'eth_call',
          params: [{ to: MINING_CONTRACT, data: c.data }, 'latest'],
          id: c.id,
        }))),
      })
      const json = await res.json()
      for (const r of json) {
        if (r.result) results.set(r.id, r.result)
      }
    } catch {}
  }
  return results
}

async function fetchMinerAddresses(): Promise<string[]> {
  const now = Date.now()
  if (cachedAddresses.length > 0 && now - addressCacheTime < ADDRESS_CACHE_TTL) {
    return cachedAddresses
  }

  // Fetch all addresses + totalCredits from avc.codes (paginated)
  const addresses: string[] = []
  const credits = new Map<string, string>()
  let page = 1
  const limit = 100

  while (true) {
    try {
      const res = await fetch(`${AVC_API}?page=${page}&limit=${limit}&sortBy=totalCredits&sortOrder=desc`, { signal: AbortSignal.timeout(5000) })
      const data = await res.json()
      if (!data.miners || data.miners.length === 0) break
      for (const m of data.miners) {
        const addr = m.address.toLowerCase()
        addresses.push(addr)
        if (m.totalCredits) credits.set(addr, String(m.totalCredits))
      }
      if (!data.pagination || page >= data.pagination.pages) break
      page++
    } catch {
      break
    }
  }

  if (addresses.length > 0) {
    cachedAddresses = addresses
    cachedTotalCredits = credits
    addressCacheTime = now
  }
  return cachedAddresses
}

async function buildLeaderboard(): Promise<{ miners: MinerData[]; source: string; epochId: number }> {
  const now = Date.now()
  
  // Get current epoch
  const epochResult = await ethCall('0x76671808') // currentEpoch()
  const epochId = epochResult ? parseInt(epochResult, 16) : 4
  const epochHex = epochId.toString(16).padStart(64, '0')

  // Get miner addresses
  const addresses = await fetchMinerAddresses()
  if (addresses.length === 0) {
    throw new Error('No miner addresses available')
  }

  // Get on-chain totalCredits for epoch
  const totalCreditsResult = await ethCall('0x15a4d1e4' + epochHex)
  const epochTotalCredits = totalCreditsResult ? parseInt(totalCreditsResult, 16) : 0

  // Get epoch reward estimate from coordinator
  let epochRewardRaw = '0'
  try {
    const statsRes = await fetch(`${COORDINATOR}/v1/stats`)
    const stats = await statsRes.json()
    epochRewardRaw = stats.currentEpochEstimateRaw || '0'
  } catch {}

  // Batch on-chain calls: credits(epoch, addr) + nextIndex(addr) for each miner
  const calls: { data: string; id: number }[] = []
  for (let i = 0; i < addresses.length; i++) {
    const addrPadded = addresses[i].slice(2).padStart(64, '0')
    // credits(uint64 epoch, address miner) — selector 0xc8d11fd7
    calls.push({ data: '0xc8d11fd7' + epochHex + addrPadded, id: i * 2 })
    // nextIndex(address) — selector 0x641ce41d (total solves across all epochs)
    calls.push({ data: '0x641ce41d' + addrPadded, id: i * 2 + 1 })
  }

  const results = await ethCallBatch(calls)

  // Use avc.codes bulk data for totalCredits (already fetched during address discovery)
  // This avoids N individual coordinator calls which was the main bottleneck

  // Build miner data
  const miners: MinerData[] = []
  const epochReward = BigInt(epochRewardRaw)

  for (let i = 0; i < addresses.length; i++) {
    const addr = addresses[i]
    const epochCreditsHex = results.get(i * 2)
    const totalSolvesHex = results.get(i * 2 + 1)

    const epochCredits = epochCreditsHex ? parseInt(epochCreditsHex, 16) : 0
    const totalSolves = totalSolvesHex ? parseInt(totalSolvesHex, 16) : 0
    const totalCredits = cachedTotalCredits.get(addr) || String(epochCredits)

    // Estimate reward: (minerEpochCredits / totalEpochCredits) * epochReward
    let estimateReward = '0'
    if (epochTotalCredits > 0 && epochCredits > 0) {
      estimateReward = (epochReward * BigInt(epochCredits) / BigInt(epochTotalCredits)).toString()
    }

    if (parseInt(totalCredits) > 0 || totalSolves > 0) {
      miners.push({
        address: addr,
        totalCredits,
        totalSolves: String(totalSolves),
        currentEpochCredits: String(epochCredits),
        estimateReward,
      })
    }
  }

  return { miners, source: 'onchain+coordinator', epochId }
}

export const revalidate = 0
export const maxDuration = 30

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')))
  const sortBy = searchParams.get('sortBy') || 'currentEpochCredits'
  const sortOrder = searchParams.get('sortOrder') || 'desc'
  const search = searchParams.get('search')?.toLowerCase()

  try {
    const now = Date.now()

    // Return stale cache immediately if available, refresh in background
    let miners: MinerData[]
    let source = 'cache'
    let epochId = 0
    const staleThreshold = LEADERBOARD_CACHE_TTL * 4 // 3 min max staleness

    if (cachedLeaderboard.length > 0 && now - leaderboardCacheTime < LEADERBOARD_CACHE_TTL) {
      miners = [...cachedLeaderboard]
    } else if (cachedLeaderboard.length > 0 && now - leaderboardCacheTime < staleThreshold) {
      // Return stale data NOW, refresh in background
      miners = [...cachedLeaderboard]
      source = 'stale-cache'
      // Fire-and-forget background refresh
      buildLeaderboard().then(result => {
        cachedLeaderboard = result.miners
        leaderboardCacheTime = Date.now()
      }).catch(() => {})
    } else {
      const result = await buildLeaderboard()
      miners = result.miners
      source = result.source
      epochId = result.epochId
      cachedLeaderboard = miners
      leaderboardCacheTime = now
    }

    // Search filter
    if (search) {
      miners = miners.filter(m => m.address.includes(search))
    }

    // Sort
    const sortKey = sortBy as keyof MinerData
    miners.sort((a, b) => {
      const av = BigInt(a[sortKey] || '0')
      const bv = BigInt(b[sortKey] || '0')
      return sortOrder === 'desc' ? (bv > av ? 1 : bv < av ? -1 : 0) : (av > bv ? 1 : av < bv ? -1 : 0)
    })

    // Add ranks
    const total = miners.length
    const pages = Math.ceil(total / limit)
    const start = (page - 1) * limit
    const paged = miners.slice(start, start + limit).map((m, i) => ({
      rank: start + i + 1,
      ...m,
    }))

    const resp = NextResponse.json({
      miners: paged,
      pagination: { page, limit, total, pages },
      source,
    })
    // Aggressive CDN caching: serve stale for up to 5 min while revalidating in background
    resp.headers.set('Cache-Control', 's-maxage=60, stale-while-revalidate=300')
    return resp
  } catch (error: any) {
    // Fallback: avc.codes
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit), sortBy, sortOrder })
      if (search) params.set('search', search)
      const res = await fetch(`${AVC_API}?${params}`)
      const data = await res.json()
      return NextResponse.json({ ...data, source: 'avc-fallback' })
    } catch {
      return NextResponse.json({ error: 'All data sources failed' }, { status: 500 })
    }
  }
}
