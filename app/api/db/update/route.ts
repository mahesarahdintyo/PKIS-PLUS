// app/api/db/update/route.ts
// Generic update endpoint — dipakai oleh lib/supabase/client.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcastDbChange } from "@/lib/socket";
import { buildWhere } from "@/app/api/db/query/route";

const TABLE_MAP: Record<string, any> = {
  lines: prisma.line,
  folders: prisma.folder,
  documents: prisma.document,
  display_documents: prisma.displayDocument,
  display_heartbeats: prisma.displayHeartbeat,
  production_reports: prisma.productionReport,
  profiles: prisma.profile,
  andon_calls: prisma.andonCall,
  andon_leaders: prisma.andonLeader,
  push_subscriptions: prisma.pushSubscription,
  prod_production_log: prisma.prodProductionLog,
  prod_downtime_log: prisma.prodDowntimeLog,
  prod_part_numbers: prisma.prodPartNumber,
  prod_downtime_problems: prisma.prodDowntimeProblem,
  prod_dandori_log: prisma.prodDandoriLog,
  prod_production_planning: prisma.prodProductionPlanning,
  prod_nonproduksi_types: prisma.prodNonproduksiType,
  prod_mesin_settings: prisma.prodMesinSettings,
  prod_attendance_log: prisma.prodAttendanceLog,
  prod_safety_log: prisma.prodSafetyLog,
  prod_scrap_top_end: prisma.prodScrapTopEnd,
  productivity_daily_reference: prisma.productivityDailyReference,
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { table, data, filters = [], inFilters = [] } = body;

    const model = TABLE_MAP[table];
    if (!model) {
      return NextResponse.json({ error: `Table '${table}' tidak dikenali` }, { status: 400 });
    }

    const where = buildWhere(filters, inFilters);
    const result = await model.updateMany({ where, data });

    broadcastDbChange(table, "UPDATE", { eventType: "UPDATE", new: data });

    return NextResponse.json({ data: result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
