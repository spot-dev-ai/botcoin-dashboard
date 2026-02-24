import { NextResponse } from 'next/server'

const BOTCOIN_CONTRACT = '0xA601877977340862Ca67f816eb079958E5bd0BA3'
const POOL_ADDRESS = '0x5154ba0d6cfb5fe27644bc856064991e1c7672b7eb533d5d457db4c7144c2af5'
const GECKO_OHLCV = `https://api.geckoterminal.com/api/v2/networks/base/pools/${POOL_ADDRESS}/ohlcv/hour?aggregate=4&limit=50`

// Cache 4h candles (refresh every 5 min)
let cachedCandles: { t: number; p: number }[] = []
let candleCacheTime = 0
const CANDLE_CACHE_TTL = 60 * 1000

async function fetchCandles(): Promise<{ t: number; p: number }[]> {
  const now = Date.now()
  if (cachedCandles.length > 0 && now - candleCacheTime < CANDLE_CACHE_TTL) {
    return cachedCandles
  }
  try {
    const res = await fetch(GECKO_OHLCV, { next: { revalidate: 60 } })
    const data = await res.json()
    const ohlcv = data?.data?.attributes?.ohlcv_list ?? []
    // ohlcv: [timestamp, open, high, low, close, volume] — newest first
    const candles = ohlcv
      .map((c: number[]) => ({ t: c[0], p: c[4] })) // close price
      .reverse() // oldest first for chart
    if (candles.length > 0) {
      cachedCandles = candles
      candleCacheTime = now
    }
    return cachedCandles
  } catch {
    return cachedCandles
  }
}

export async function GET() {
  try {
    const [dexRes, candles] = await Promise.all([
      fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${BOTCOIN_CONTRACT}`,
        { next: { revalidate: 15 } }
      ).then(r => r.json()),
      fetchCandles(),
    ])

    const pair = dexRes.pairs?.[0]
    if (!pair) {
      return NextResponse.json({ error: 'No pair found' }, { status: 404 })
    }

    const resp = NextResponse.json({
      price: pair.priceUsd,
      priceNative: pair.priceNative,
      change24h: pair.priceChange?.h24,
      change6h: pair.priceChange?.h6,
      change1h: pair.priceChange?.h1,
      volume24h: pair.volume?.h24,
      liquidity: pair.liquidity?.usd,
      marketCap: pair.marketCap || pair.fdv,
      pairAddress: pair.pairAddress,
      dexId: pair.dexId,
      history: candles,
    })
    resp.headers.set('Cache-Control', 's-maxage=15, stale-while-revalidate=30')
    return resp
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch price' }, { status: 500 })
  }
}
