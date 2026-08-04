import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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

function setMemoryHeartbeat(landId: string, lastSeenAt: string) {
  globalThis.futabaDisplayHeartbeatsByLand = {
    ...(globalThis.futabaDisplayHeartbeatsByLand ?? {}),
    [landId]: lastSeenAt,
  }
}

function clearMemoryHeartbeat(landId: string) {
  const currentHeartbeats = { ...(globalThis.futabaDisplayHeartbeatsByLand ?? {}) }
  delete currentHeartbeats[landId]
  globalThis.futabaDisplayHeartbeatsByLand = currentHeartbeats
}

function getLandId(value: unknown) {
  if (!value || typeof value !== 'object') return ''

  const body = value as { landId?: unknown }
  return typeof body.landId === 'string' ? body.landId.trim() : ''
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const landId = getLandId(body)

    if (!landId) {
      return NextResponse.json(
        { error: 'Land ID is required' },
        { status: 400 }
      )
    }

    const lastSeenAt = new Date().toISOString()
    const supabase = await createClient()

    const { error } = await supabase
      .from('display_heartbeats')
      .upsert(
        {
          land_id: landId,
          last_seen_at: lastSeenAt,
        },
        {
          onConflict: 'land_id',
        }
      )

    if (error) {
      if (isMissingHeartbeatTableError(error)) {
        setMemoryHeartbeat(landId, lastSeenAt)
        return NextResponse.json({ success: true, hasDatabase: false })
      }

      throw error
    }

    setMemoryHeartbeat(landId, lastSeenAt)
    return NextResponse.json({ success: true, hasDatabase: true })
  } catch (error) {
    console.error('Display heartbeat POST error:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const landId = searchParams.get('landId')?.trim()

    if (!landId) {
      return NextResponse.json(
        { error: 'Land ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const { error } = await supabase
      .from('display_heartbeats')
      .delete()
      .eq('land_id', landId)

    if (error && !isMissingHeartbeatTableError(error)) {
      throw error
    }

    clearMemoryHeartbeat(landId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Display heartbeat DELETE error:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
