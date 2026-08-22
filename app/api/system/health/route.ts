import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const DISPLAY_ONLINE_THRESHOLD_MS = 20_000
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? 'v1.0.0'

interface LineRow {
  id: string
  name: string
}

interface HeartbeatRow {
  line_id: string
  last_seen_at: string
}

declare global {
  // eslint-disable-next-line no-var
  var futabaDisplayHeartbeatsByLine: Record<string, string> | undefined
}

function isMissingHeartbeatTableError(error: { code?: string; message?: string } | null) {
  return (
    error?.code === '42P01' ||
    error?.message?.toLowerCase().includes('display_heartbeats') === true
  )
}

function isOnline(lastSeenAt?: string) {
  if (!lastSeenAt) return false

  const lastSeenTime = new Date(lastSeenAt).getTime()
  if (Number.isNaN(lastSeenTime)) return false

  return Date.now() - lastSeenTime <= DISPLAY_ONLINE_THRESHOLD_MS
}

export async function GET() {
  const checkedAt = new Date().toISOString()
  const supabase = await createClient()
  let databaseConnected = false
  let storageConnected = false
  let lines: LineRow[] = []
  let heartbeats: HeartbeatRow[] = []

  const { data: lineData, error: lineError } = await supabase
    .from('lines')
    .select('id, name')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (!lineError) {
    databaseConnected = true
    lines = lineData ?? []
  }

  const { error: storageError } = await supabase.storage
    .from('documents')
    .list('', {
      limit: 1,
    })

  storageConnected = !storageError

  if (databaseConnected) {
    const { data: heartbeatData, error: heartbeatError } = await supabase
      .from('display_heartbeats')
      .select('line_id, last_seen_at')

    if (!heartbeatError) {
      heartbeats = heartbeatData ?? []
    } else if (!isMissingHeartbeatTableError(heartbeatError)) {
      console.error('System health heartbeat error:', heartbeatError)
    }
  }

  const memoryHeartbeats = globalThis.futabaDisplayHeartbeatsByLine ?? {}
  const heartbeatByLine = new Map<string, string>()

  for (const heartbeat of heartbeats) {
    heartbeatByLine.set(heartbeat.line_id, heartbeat.last_seen_at)
  }

  for (const [lineId, lastSeenAt] of Object.entries(memoryHeartbeats)) {
    if (!heartbeatByLine.has(lineId)) {
      heartbeatByLine.set(lineId, lastSeenAt)
    }
  }

  const displays = lines.map((line) => {
    const lastSeenAt = heartbeatByLine.get(line.id)

    return {
      id: line.id,
      name: line.name,
      online: isOnline(lastSeenAt),
      lastSeenAt: lastSeenAt ?? null,
    }
  })

  return NextResponse.json({
    checkedAt,
    version: APP_VERSION,
    database: {
      connected: databaseConnected,
      error: lineError?.message ?? null,
    },
    storage: {
      connected: storageConnected,
      error: storageError?.message ?? null,
    },
    displays,
  })
}
