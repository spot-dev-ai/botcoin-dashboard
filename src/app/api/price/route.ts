import { NextResponse } from 'next/server'

const BOTCOIN_CONTRACT = '0xA601877977340862Ca67f816eb079958E5bd0BA3'

export async function GET() {
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${BOTCOIN_CONTRACT}`,
      { next: { revalidate: 30 } }
    )
    const data = await res.json()
    const pair = data.pairs?.[0]

    if (!pair) {
      return NextResponse.json({ error: 'No pair found' }, { status: 404 })
    }

    return NextResponse.json({
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
    })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch price' }, { status: 500 })
  }
}
