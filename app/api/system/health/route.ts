import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const DISPLAY_ONLINE_THRESHOLD_MS = 20_000
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? 'v1.0.0'

interface LandRow {
  id: string
  name: string
}

interface HeartbeatRow {
  land_id: string
  last_seen_at: string
}

declare global {
  // eslint-disable-next-line no-var
  var futabaDisplayHeartbeatsByLand: Record<string, string> | undefined
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
  let lands: LandRow[] = []
  let heartbeats: HeartbeatRow[] = []

  const { data: landData, error: landError } = await supabase
    .from('lands')
    .select('id, name')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (!landError) {
    databaseConnected = true
    lands = landData ?? []
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
      .select('land_id, last_seen_at')

    if (!heartbeatError) {
      heartbeats = heartbeatData ?? []
    } else if (!isMissingHeartbeatTableError(heartbeatError)) {
      console.error('System health heartbeat error:', heartbeatError)
    }
  }

  const memoryHeartbeats = globalThis.futabaDisplayHeartbeatsByLand ?? {}
  const heartbeatByLand = new Map<string, string>()

  for (const heartbeat of heartbeats) {
    heartbeatByLand.set(heartbeat.land_id, heartbeat.last_seen_at)
  }

  for (const [landId, lastSeenAt] of Object.entries(memoryHeartbeats)) {
    if (!heartbeatByLand.has(landId)) {
      heartbeatByLand.set(landId, lastSeenAt)
    }
  }

  const displays = lands.map((land) => {
    const lastSeenAt = heartbeatByLand.get(land.id)

    return {
      id: land.id,
      name: land.name,
      online: isOnline(lastSeenAt),
      lastSeenAt: lastSeenAt ?? null,
    }
  })

  return NextResponse.json({
    checkedAt,
    version: APP_VERSION,
    database: {
      connected: databaseConnected,
      error: landError?.message ?? null,
    },
    storage: {
      connected: storageConnected,
      error: storageError?.message ?? null,
    },
    displays,
  })
}
