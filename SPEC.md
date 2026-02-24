# BOTCOIN Mining Dashboard — Build Spec

## Overview
Build a Next.js dashboard that tracks BOTCOIN mining activity on Base chain. Use the EXACT same dark theme/design system as the reference CSS in `globals-reference.css` (modern dark theme, blue accent, card-based layout).

## Tech Stack
- Next.js 14+ (App Router)
- React + TypeScript
- Tailwind CSS
- Recharts (for any charts)
- No database — all data fetched live from APIs

## Data Sources

### 1. Coordinator API (primary)
Base URL: `https://coordinator.agentmoney.net`

**Endpoints:**
- `GET /v1/stats` — Returns: `{ activeMiners, currentEpoch, totalMined, totalMinedRaw, currentEpochEstimate, currentEpochEstimateRaw, lastUpdated }`
- `GET /v1/epoch` — Returns: `{ epochId, genesisTimestamp, epochDurationSeconds (86400), nextEpochStartTimestamp, prevEpochId }`
- `GET /v1/credits?miner=0x...` — Returns: `{ miner, totalCredits, epochs: { "3": "82" } }`

### 2. Alchemy RPC (on-chain data for leaderboard)
URL: `https://base-mainnet.g.alchemy.com/v2/Njbz8cn6hHtnlMHEGxpWB`

### 3. BOTCOIN Contract
Address: `0xA601877977340862Ca67f816eb079958E5bd0BA3` (Base chain, ERC-20)

### 4. Mining Contract  
Address: `0xd572e61e1B627d4105832C815Ccd722B5baD9233` (Base chain)
- This is where receipts are submitted and rewards claimed
- Parse ReceiptSubmitted events to build the leaderboard

## Dashboard Sections

### Top Stats Bar (4 cards, grid)
1. **Active Miners** — from `/v1/stats` `activeMiners`
2. **Current Epoch** — from `/v1/epoch` `epochId` (e.g. "Epoch #3")
3. **Epoch Reward (Est.)** — from `/v1/stats` `currentEpochEstimate` (format as BOTCOIN with commas)
4. **Total BOTCOIN Mined** — from `/v1/stats` `totalMined` (format with commas)

### Epoch Countdown Timer
- Big countdown: hours:minutes:seconds until `nextEpochStartTimestamp`
- Show epoch progress bar (% of 24h elapsed)
- Epoch info: genesis was timestamp 1771549843 (Feb 20, 2026 14:10:43 UTC), each epoch = 86400s (24h)

### Mining Leaderboard (main section)
- Table showing all miners in current epoch
- Columns: Rank, Wallet Address (truncated), Credits This Epoch, % of Total
- Data source: Parse `ReceiptSubmitted` events from the mining contract on Base chain
- Use Alchemy `eth_getLogs` to fetch events from the mining contract
- Sort by credits descending
- Highlight our wallet: `0x6a6c98e4a70e6820f828fb3e5faaa7f03b520963`
- Auto-refresh every 30 seconds

### BOTCOIN Price Section (optional sidebar)
- Current price (from DexScreener or CoinGecko API)
- 24h change
- Market cap

## Design Requirements
- Copy the EXACT CSS variables and design system from `globals-reference.css`
- Dark theme (#0a0a0a background, card-based, subtle borders)
- Blue accent (#3b82f6) for primary elements
- Monospace font for numbers/addresses
- Responsive (mobile-friendly)
- Smooth animations on data updates
- Card hover effects matching the reference

## API Routes (Next.js)
Create these server-side API routes to avoid CORS:
- `/api/stats` — proxy coordinator stats + epoch
- `/api/leaderboard` — fetch on-chain events from Alchemy, aggregate credits per miner
- `/api/price` — fetch BOTCOIN price from DexScreener

## Environment Variables
```
ALCHEMY_API_URL=https://base-mainnet.g.alchemy.com/v2/Njbz8cn6hHtnlMHEGxpWB
COORDINATOR_URL=https://coordinator.agentmoney.net
BOTCOIN_CONTRACT=0xA601877977340862Ca67f816eb079958E5bd0BA3
MINING_CONTRACT=0xd572e61e1B627d4105832C815Ccd722B5baD9233
```

## Run
- `npm run dev` should start on port 3001 (3000 is taken by HL dashboard)
- Must work immediately with just `npm install && npm run dev`

## Reference
- Existing leaderboard for data format: https://botcoin.avc.codes/
- BOTCOIN website: https://agentmoney.net/
- Our wallet: 0x6a6c98e4a70e6820f828fb3e5faaa7f03b520963
