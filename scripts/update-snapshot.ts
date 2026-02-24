#!/usr/bin/env npx tsx
// Fetches all API data and writes a static snapshot to public/snapshot.json
// Run via cron every 30-60s to keep it fresh

import { writeFileSync } from 'fs'
import { join } from 'path'

const BASE = process.env.SNAPSHOT_BASE_URL || 'http://localhost:3001'
const OUT = join(__dirname, '..', 'public', 'snapshot.json')

async function fetchJson(path: string) {
  const res = await fetch(`${BASE}${path}`, { signal: AbortSignal.timeout(25000) })
  if (!res.ok) throw new Error(`${path}: ${res.status}`)
  return res.json()
}

async function main() {
  try {
    const [stats, price, leaderboard] = await Promise.all([
      fetchJson('/api/stats'),
      fetchJson('/api/price'),
      fetchJson('/api/leaderboard?limit=200&sortBy=currentEpochCredits&sortOrder=desc'),
    ])

    const snapshot = {
      stats,
      price,
      leaderboard,
      generatedAt: new Date().toISOString(),
      ts: Date.now(),
    }

    writeFileSync(OUT, JSON.stringify(snapshot))
    console.log(`[${new Date().toLocaleTimeString()}] snapshot written (${(JSON.stringify(snapshot).length / 1024).toFixed(1)}KB)`)
  } catch (err: any) {
    console.error(`[${new Date().toLocaleTimeString()}] snapshot failed:`, err.message)
    process.exit(1)
  }
}

main()
