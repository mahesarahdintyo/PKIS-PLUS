import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

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

function setMemoryHeartbeat(lineId: string, lastSeenAt: string) {
  globalThis.futabaDisplayHeartbeatsByLine = {
    ...(globalThis.futabaDisplayHeartbeatsByLine ?? {}),
    [lineId]: lastSeenAt,
  }
}

function clearMemoryHeartbeat(lineId: string) {
  const currentHeartbeats = { ...(globalThis.futabaDisplayHeartbeatsByLine ?? {}) }
  delete currentHeartbeats[lineId]
  globalThis.futabaDisplayHeartbeatsByLine = currentHeartbeats
}

function getLineId(value: unknown) {
  if (!value || typeof value !== 'object') return ''

  const body = value as { lineId?: unknown; landId?: unknown }
  const val = body.lineId ?? body.landId
  return typeof val === 'string' ? val.trim() : ''
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const lineId = getLineId(body)

    if (!lineId) {
      return NextResponse.json(
        { error: 'Line ID is required' },
        { status: 400 }
      )
    }

    const lastSeenAt = new Date().toISOString()
    const supabase = await createClient()

    const { error } = await supabase
      .from('display_heartbeats')
      .upsert(
        {
          line_id: lineId,
          last_seen_at: lastSeenAt,
        },
        {
          onConflict: 'line_id',
        }
      )

    if (error) {
      if (isMissingHeartbeatTableError(error)) {
        setMemoryHeartbeat(lineId, lastSeenAt)
        return NextResponse.json({ success: true, hasDatabase: false })
      }

      throw error
    }

    setMemoryHeartbeat(lineId, lastSeenAt)
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
    const lineId = (searchParams.get('lineId') ?? searchParams.get('landId'))?.trim()

    if (!lineId) {
      return NextResponse.json(
        { error: 'Line ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const { error } = await supabase
      .from('display_heartbeats')
      .delete()
      .or(`line_id.eq.${lineId},land_id.eq.${lineId}`)

    if (error && !isMissingHeartbeatTableError(error)) {
      throw error
    }

    clearMemoryHeartbeat(lineId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Display heartbeat DELETE error:', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
