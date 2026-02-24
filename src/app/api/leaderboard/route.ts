import { NextResponse } from 'next/server'

const ALCHEMY_URL = 'https://base-mainnet.g.alchemy.com/v2/Njbz8cn6hHtnlMHEGxpWB'
const MINING_CONTRACT = '0xd572e61e1B627d4105832C815Ccd722B5baD9233'
const COORDINATOR = 'https://coordinator.agentmoney.net'

// ReceiptSubmitted event signature — we'll get all receipt events and count per miner
// Event: ReceiptSubmitted(address indexed miner, uint256 indexed epochId, bytes32 challengeId, uint256 credits)
const RECEIPT_TOPIC = '0x' + Buffer.from(
  Array.from(
    new Uint8Array(
      // keccak256 of the event sig — we'll compute from logs instead
      // For now use getLogs with the contract and parse topics
      []
    )
  )
).toString('hex')

interface MinerCredits {
  address: string
  credits: number
  txCount: number
}

export async function GET() {
  try {
    // Get current epoch info
    const epochRes = await fetch(`${COORDINATOR}/v1/epoch`, { next: { revalidate: 30 } })
    const epoch = await epochRes.json()
    
    // Calculate block range for current epoch
    // Base produces ~2s blocks
    const epochStart = parseInt(epoch.nextEpochStartTimestamp) - parseInt(epoch.epochDurationSeconds)
    const now = Math.floor(Date.now() / 1000)
    const secondsIntoEpoch = now - epochStart
    const blocksIntoEpoch = Math.floor(secondsIntoEpoch / 2)
    
    // Get current block number
    const blockNumRes = await fetch(ALCHEMY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
    })
    const blockNumData = await blockNumRes.json()
    const currentBlock = parseInt(blockNumData.result, 16)
    const fromBlock = Math.max(currentBlock - blocksIntoEpoch, 0)

    // Get all logs from the mining contract for this epoch
    const logsRes = await fetch(ALCHEMY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getLogs',
        params: [{
          fromBlock: '0x' + fromBlock.toString(16),
          toBlock: 'latest',
          address: MINING_CONTRACT,
        }],
        id: 2,
      }),
    })
    const logsData = await logsRes.json()
    const logs = logsData.result || []

    // Aggregate by miner address (topic[1] is typically the miner)
    const minerMap = new Map<string, { credits: number; txCount: number }>()
    
    for (const log of logs) {
      if (log.topics && log.topics.length >= 2) {
        // Extract miner address from topic[1] (indexed address, padded to 32 bytes)
        const minerAddr = '0x' + log.topics[1].slice(26).toLowerCase()
        const existing = minerMap.get(minerAddr) || { credits: 0, txCount: 0 }
        
        // Each receipt = 1 credit (for 25M tier), parse data for actual credits if available
        let credits = 1
        if (log.data && log.data.length >= 66) {
          // Try to parse credits from data field (last uint256)
          const dataHex = log.data.slice(2)
          if (dataHex.length >= 128) {
            credits = parseInt(dataHex.slice(64, 128), 16) || 1
          }
        }
        
        existing.credits += credits
        existing.txCount += 1
        minerMap.set(minerAddr, existing)
      }
    }

    // Sort by credits descending
    const leaderboard: MinerCredits[] = Array.from(minerMap.entries())
      .map(([address, data]) => ({ address, ...data }))
      .sort((a, b) => b.credits - a.credits)

    const totalCredits = leaderboard.reduce((sum, m) => sum + m.credits, 0)

    return NextResponse.json({
      epoch: epoch.epochId,
      totalCredits,
      totalMiners: leaderboard.length,
      totalLogs: logs.length,
      fromBlock,
      currentBlock,
      leaderboard: leaderboard.slice(0, 100), // Top 100
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch leaderboard' }, { status: 500 })
  }
}
