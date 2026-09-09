import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// ---------- Shift helpers (mirrors useProductionLines.ts logic) ----------

function currentShiftWindow(): { start: Date; end: Date; shift: number } {
  const now = new Date()
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const s1start = new Date(base); s1start.setHours(7, 0, 0, 0)
  const s1end   = new Date(base); s1end.setHours(19, 30, 0, 0)

  if (now >= s1start && now < s1end) {
    return { shift: 1, start: s1start, end: s1end }
  }

  if (now >= s1end) {
    const s2end = new Date(base); s2end.setDate(base.getDate() + 1); s2end.setHours(7, 0, 0, 0)
    return { shift: 2, start: s1end, end: s2end }
  }

  // Before 07:00 — belongs to shift 2 that started yesterday evening
  const prevBase    = new Date(base); prevBase.setDate(base.getDate() - 1)
  const prevS2start = new Date(prevBase); prevS2start.setHours(19, 30, 0, 0)
  return { shift: 2, start: prevS2start, end: s1start }
}

// How many minutes ago was the last log entry before we consider a line idle
const IDLE_THRESHOLD_MS = 90 * 60 * 1000 // 90 minutes

interface LineRow {
  id: string
  name: string
}

interface LogRow {
  line_id: string | null
  mesin: string
  waktu_awal: string
  waktu_akhir: string | null
  part_number: string | null
  created_at: string | null
}

export async function GET() {
  const supabase = await createClient()
  const { start, end, shift } = currentShiftWindow()

  // 1. Fetch all active lines
  const { data: lineData, error: lineError } = await supabase
    .from('lines')
    .select('id, name')
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (lineError) {
    return NextResponse.json({ error: lineError.message }, { status: 500 })
  }

  const lines: LineRow[] = lineData ?? []

  if (lines.length === 0) {
    return NextResponse.json({ shift, checkedAt: new Date().toISOString(), lines: [] })
  }

  // 2. Fetch the latest production log entry per line_id within the current shift
  //    This is READ-ONLY and does not touch any write path.
  const { data: logData } = await supabase
    .from('prod_production_log' as any)
    .select('line_id, mesin, waktu_awal, waktu_akhir, part_number, created_at')
    .eq('is_active', true)
    .gte('waktu_awal', start.toISOString())
    .lt('waktu_awal', end.toISOString())
    .order('waktu_awal', { ascending: false })

  const logs: LogRow[] = (logData as LogRow[] | null) ?? []

  // Build a map: line_id -> most recent log row
  const latestByLine = new Map<string, LogRow>()
  for (const row of logs) {
    if (row.line_id && !latestByLine.has(row.line_id)) {
      latestByLine.set(row.line_id, row)
    }
  }

  const now = Date.now()

  const result = lines.map((line) => {
    const latest = latestByLine.get(line.id)

    if (!latest) {
      return {
        id: line.id,
        name: line.name,
        status: 'idle' as const,
        lastPartNumber: null,
        lastActivityAt: null,
        mesin: null,
      }
    }

    const lastTime = new Date(latest.waktu_awal).getTime()
    const msSinceLast = now - lastTime
    // If waktu_akhir is null, the entry is being actively logged (operator in-session).
    // Otherwise judge by recency.
    const isActive = !latest.waktu_akhir || msSinceLast <= IDLE_THRESHOLD_MS

    return {
      id: line.id,
      name: line.name,
      status: isActive ? ('active' as const) : ('idle' as const),
      lastPartNumber: latest.part_number,
      lastActivityAt: latest.waktu_awal,
      mesin: latest.mesin,
    }
  })

  return NextResponse.json({
    shift,
    checkedAt: new Date().toISOString(),
    lines: result,
  })
}
