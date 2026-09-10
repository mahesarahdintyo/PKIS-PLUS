import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// ---------- WIB (UTC+7) shift helpers ----------
// Timestamps in database are UTC ISO strings.
// Shift 1: WIB 07:00 – 19:30  (UTC 00:00 – 12:30 on same WIB date)
// Shift 2: WIB 19:30 – 07:00  (UTC 12:30 – 00:00 next day)

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000

function currentShiftWindowUTC(): { shift: number; start: Date; end: Date } {
  const nowUtcMs = Date.now()

  // Interpret current instant as WIB calendar date
  const nowAsWib = new Date(nowUtcMs + WIB_OFFSET_MS)
  const y = nowAsWib.getUTCFullYear()
  const mo = nowAsWib.getUTCMonth()
  const d = nowAsWib.getUTCDate()

  // Shift-1 boundaries in UTC
  const s1StartMs = Date.UTC(y, mo, d, 0, 0, 0, 0)
  const s1EndMs = Date.UTC(y, mo, d, 12, 30, 0, 0)

  if (nowUtcMs >= s1StartMs && nowUtcMs < s1EndMs) {
    return { shift: 1, start: new Date(s1StartMs), end: new Date(s1EndMs) }
  }

  if (nowUtcMs >= s1EndMs) {
    // Shift-2 started today at WIB 19:30, ends tomorrow WIB 07:00
    const s2EndMs = Date.UTC(y, mo, d + 1, 0, 0, 0, 0)
    return { shift: 2, start: new Date(s1EndMs), end: new Date(s2EndMs) }
  }

  // Before UTC 00:00 (WIB 07:00) -> Shift-2 started yesterday evening
  const prevS1EndMs = Date.UTC(y, mo, d - 1, 12, 30, 0, 0)
  return { shift: 2, start: new Date(prevS1EndMs), end: new Date(s1StartMs) }
}

// A line is considered "active" (recent save) if committed within 45 minutes
const RECENT_WINDOW_MS = 45 * 60 * 1000

interface LogRow {
  line_id: string | null
  mesin: string
  waktu_awal: string
  waktu_akhir: string | null
  part_number: string | null
  qty: number | null
  created_at: string | null
}

export async function GET() {
  try {
    const supabase = await createClient()
    const { shift, start, end } = currentShiftWindowUTC()

    // 1. Fetch active lines
    const { data: lineData, error: lineError } = await supabase
      .from('lines')
      .select('id, name')
      .eq('is_active', true)
      .order('name', { ascending: true })

    if (lineError) {
      return NextResponse.json({ error: lineError.message }, { status: 500 })
    }

    const lines = lineData ?? []

    if (lines.length === 0) {
      return NextResponse.json({
        shift,
        checkedAt: new Date().toISOString(),
        shiftStart: start.toISOString(),
        shiftEnd: end.toISOString(),
        lines: [],
      })
    }

    // 2. Query production logs for the current shift window.
    // Read-only query: purely SELECT, does not modify any state.
    const { data: logData, error: logError } = await supabase
      .from('prod_production_log' as any)
      .select('line_id, mesin, waktu_awal, waktu_akhir, part_number, qty, created_at')
      .eq('is_active', true)
      .gte('waktu_awal', start.toISOString())
      .lt('waktu_awal', end.toISOString())
      .order('waktu_akhir', { ascending: false, nullsFirst: false })

    if (logError) {
      console.error('Error fetching production logs for system monitor:', logError)
    }

    const logs: LogRow[] = (logData as LogRow[] | null) ?? []

    // Group logs by line_id (or match via mesin if line_id missing)
    const lineStats = new Map<
      string,
      {
        latest: LogRow
        count: number
      }
    >()

    for (const row of logs) {
      if (!row.line_id) continue

      const existing = lineStats.get(row.line_id)
      if (!existing) {
        lineStats.set(row.line_id, {
          latest: row,
          count: 1,
        })
      } else {
        existing.count += 1
      }
    }

    const nowMs = Date.now()

    const result = lines.map((line) => {
      const stat = lineStats.get(line.id)

      if (!stat) {
        return {
          id: line.id,
          name: line.name,
          status: 'idle' as const, // Belum ada input di shift ini
          lastPartNumber: null,
          lastQty: null,
          lastActivityAt: null,
          mesin: null,
          totalBatches: 0,
          minutesAgo: null,
        }
      }

      const latest = stat.latest
      const committedAt = latest.waktu_akhir
        ? new Date(latest.waktu_akhir).getTime()
        : latest.created_at
        ? new Date(latest.created_at).getTime()
        : new Date(latest.waktu_awal).getTime()

      const diffMs = Math.max(0, nowMs - committedAt)
      const minutesAgo = Math.round(diffMs / 60000)

      // Status:
      // - "active": ada input yang baru saja disimpan (< 45 menit lalu)
      // - "recorded": sudah ada input tersimpan di shift ini (tetap tampil, TIDAK hilang/idle)
      const status = diffMs <= RECENT_WINDOW_MS ? ('active' as const) : ('recorded' as const)

      return {
        id: line.id,
        name: line.name,
        status,
        lastPartNumber: latest.part_number,
        lastQty: latest.qty,
        lastActivityAt: latest.waktu_akhir ?? latest.waktu_awal,
        mesin: latest.mesin,
        totalBatches: stat.count,
        minutesAgo,
      }
    })

    return NextResponse.json({
      shift,
      checkedAt: new Date().toISOString(),
      shiftStart: start.toISOString(),
      shiftEnd: end.toISOString(),
      lines: result,
      note: 'Data memantau catatan input produksi yang telah disimpan ke server pada shift berjalan.',
    })
  } catch (err: any) {
    console.error('System production status API error:', err)
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 })
  }
}
