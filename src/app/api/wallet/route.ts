import { NextResponse } from 'next/server'

const COORDINATOR = 'https://coordinator.agentmoney.net'
const ALCHEMY_URL = `https://base-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
const MINING_CONTRACT = '0xd572e61e1B627d4105832C815Ccd722B5baD9233'

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

async function ethCallBatch(calls: { data: string; id: number }[]): Promise<Map<number, string>> {
  const results = new Map<number, string>()
  if (calls.length === 0) return results
  try {
    const res = await fetch(ALCHEMY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify(calls.map(c => ({
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
  return results
}

export const maxDuration = 15

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const address = searchParams.get('address')?.toLowerCase()

  if (!address) {
    return NextResponse.json({ error: 'address required' }, { status: 400 })
  }

  try {
    // Get coordinator data (per-epoch credits)
    const [coordRes, statsRes] = await Promise.all([
      fetch(`${COORDINATOR}/v1/credits?miner=${address}`, { signal: AbortSignal.timeout(5000) }).then(r => r.json()).catch(() => null),
      fetch(`${COORDINATOR}/v1/stats`, { signal: AbortSignal.timeout(5000) }).then(r => r.json()).catch(() => null),
    ])

    const currentEpoch = parseInt(statsRes?.currentEpoch || '4')
    const epochs = coordRes?.epochs || {}
    const totalCredits = parseInt(coordRes?.totalCredits || '0')

    // Get on-chain data for each epoch this miner participated in
    const addrPadded = address.slice(2).padStart(64, '0')
    const epochIds = Object.keys(epochs).map(Number).sort((a, b) => a - b)
    
    // Also check epochs they might not be in coordinator for
    const allEpochs = []
    for (let e = 1; e <= currentEpoch; e++) {
      allEpochs.push(e)
    }

    // Batch: credits(epoch, addr) for all epochs + totalSolves
    const calls: { data: string; id: number }[] = []
    for (let i = 0; i < allEpochs.length; i++) {
      const epochHex = allEpochs[i].toString(16).padStart(64, '0')
      calls.push({ data: '0xc8d11fd7' + epochHex + addrPadded, id: i })
    }
    // nextIndex (total solves)
    calls.push({ data: '0x641ce41d' + addrPadded, id: 1000 })

    const results = await ethCallBatch(calls)

    // Build epoch history
    const epochHistory: { epoch: number; credits: number; onChainCredits: number }[] = []
    for (let i = 0; i < allEpochs.length; i++) {
      const e = allEpochs[i]
      const onChainCredits = results.get(i) ? parseInt(results.get(i)!, 16) : 0
      const coordCredits = parseInt(epochs[String(e)] || '0')
      const credits = Math.max(onChainCredits, coordCredits)
      epochHistory.push({ epoch: e, credits, onChainCredits })
    }

    const totalSolves = results.get(1000) ? parseInt(results.get(1000)!, 16) : 0

    // Build activity grid (last 90 days worth of data based on epochs)
    // Each epoch is ~24h, so epoch history IS the activity data
    const activityGrid = epochHistory.map(eh => ({
      epoch: eh.epoch,
      credits: eh.credits,
      active: eh.credits > 0,
    }))

    // Calculate epoch reward estimates
    const epochRewardRaw = statsRes?.currentEpochEstimateRaw || '0'

    // Get total epoch credits for current epoch to calc share
    const currentEpochHex = currentEpoch.toString(16).padStart(64, '0')
    const totalEpochCreditsRes = await ethCall('0x15a4d1e4' + currentEpochHex)
    const totalEpochCredits = totalEpochCreditsRes ? parseInt(totalEpochCreditsRes, 16) : 0

    const currentEpochCredits = epochHistory.find(e => e.epoch === currentEpoch)?.credits || 0
    let estimatedReward = '0'
    if (totalEpochCredits > 0 && currentEpochCredits > 0) {
      estimatedReward = (BigInt(epochRewardRaw) * BigInt(currentEpochCredits) / BigInt(totalEpochCredits)).toString()
    }

    const epochsMined = epochHistory.filter(e => e.credits > 0).length
    const firstEpoch = epochHistory.find(e => e.credits > 0)?.epoch ?? null
    const maxCreditsInEpoch = Math.max(...epochHistory.map(e => e.credits), 0)

    const resp = NextResponse.json({
      address,
      totalCredits,
      totalSolves,
      epochsMined,
      totalEpochs: currentEpoch,
      firstEpoch,
      currentEpochCredits,
      estimatedReward,
      maxCreditsInEpoch,
      epochHistory,
      activityGrid,
    })
    resp.headers.set('Cache-Control', 's-maxage=30, stale-while-revalidate=60')
    return resp
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch wallet data' }, { status: 500 })
  }
}
