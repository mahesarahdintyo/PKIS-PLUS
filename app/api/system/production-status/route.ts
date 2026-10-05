import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// ---------- WIB (UTC+7) shift helpers ----------
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

function currentShiftWindowUTC(): { shift: number; start: Date; end: Date } {
  const nowUtcMs = Date.now();
  const nowAsWib = new Date(nowUtcMs + WIB_OFFSET_MS);
  const y = nowAsWib.getUTCFullYear();
  const mo = nowAsWib.getUTCMonth();
  const d = nowAsWib.getUTCDate();

  const s1StartMs = Date.UTC(y, mo, d, 0, 0, 0, 0);
  const s1EndMs = Date.UTC(y, mo, d, 12, 30, 0, 0);

  if (nowUtcMs >= s1StartMs && nowUtcMs < s1EndMs) {
    return { shift: 1, start: new Date(s1StartMs), end: new Date(s1EndMs) };
  }

  if (nowUtcMs >= s1EndMs) {
    const s2EndMs = Date.UTC(y, mo, d + 1, 0, 0, 0, 0);
    return { shift: 2, start: new Date(s1EndMs), end: new Date(s2EndMs) };
  }

  const prevS1EndMs = Date.UTC(y, mo, d - 1, 12, 30, 0, 0);
  return { shift: 2, start: new Date(prevS1EndMs), end: new Date(s1StartMs) };
}

const RECENT_WINDOW_MS = 45 * 60 * 1000;

export async function GET() {
  try {
    const { shift, start, end } = currentShiftWindowUTC();

    // 1. Fetch active lines
    const lines = await prisma.line.findMany({
      where: { is_active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    if (lines.length === 0) {
      return NextResponse.json({
        shift,
        checkedAt: new Date().toISOString(),
        shiftStart: start.toISOString(),
        shiftEnd: end.toISOString(),
        lines: [],
      });
    }

    // 2. Query production logs for the current shift window
    const logs = await prisma.prodProductionLog.findMany({
      where: {
        is_active: true,
        waktu_awal: {
          gte: start,
          lt: end,
        },
      },
      select: {
        line_id: true,
        mesin: true,
        waktu_awal: true,
        waktu_akhir: true,
        part_number: true,
        qty: true,
        created_at: true,
      },
      orderBy: { waktu_akhir: "desc" },
    });

    // Group logs by line_id
    const lineStats = new Map<
      string,
      {
        latest: (typeof logs)[0];
        count: number;
      }
    >();

    for (const row of logs) {
      if (!row.line_id) continue;

      const existing = lineStats.get(row.line_id);
      if (!existing) {
        lineStats.set(row.line_id, {
          latest: row,
          count: 1,
        });
      } else {
        existing.count += 1;
      }
    }

    const nowMs = Date.now();

    const result = lines.map((line: { id: string; name: string }) => {
      const stat = lineStats.get(line.id);

      if (!stat) {
        return {
          id: line.id,
          name: line.name,
          status: "idle" as const,
          lastPartNumber: null,
          lastQty: null,
          lastActivityAt: null,
          mesin: null,
          totalBatches: 0,
        };
      }

      const latestLog = stat.latest;
      const lastActivityTime = latestLog.waktu_akhir
        ? new Date(latestLog.waktu_akhir).getTime()
        : new Date(latestLog.waktu_awal).getTime();

      const isRunning =
        !latestLog.waktu_akhir || nowMs - lastActivityTime < RECENT_WINDOW_MS;

      return {
        id: line.id,
        name: line.name,
        status: isRunning ? ("running" as const) : ("idle" as const),
        lastPartNumber: latestLog.part_number,
        lastQty: latestLog.qty,
        lastActivityAt: latestLog.waktu_akhir
          ? latestLog.waktu_akhir.toISOString()
          : latestLog.waktu_awal.toISOString(),
        mesin: latestLog.mesin,
        totalBatches: stat.count,
      };
    });

    return NextResponse.json({
      shift,
      checkedAt: new Date().toISOString(),
      shiftStart: start.toISOString(),
      shiftEnd: end.toISOString(),
      lines: result,
    });
  } catch (error: any) {
    console.error("System production status API error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
