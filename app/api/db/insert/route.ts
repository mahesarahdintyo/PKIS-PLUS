// app/api/db/insert/route.ts
// Generic insert endpoint — dipakai oleh lib/supabase/client.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcastDbChange } from "@/lib/socket";

const TABLE_MAP: Record<string, any> = {
  lines: prisma.line,
  folders: prisma.folder,
  documents: prisma.document,
  categories: prisma.category,
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
  prod_line_settings: prisma.prodLineSettings,
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { table, data } = body;

    const model = TABLE_MAP[table];
    if (!model) {
      return NextResponse.json({ error: `Table '${table}' tidak dikenali` }, { status: 400 });
    }

    let result;
    if (Array.isArray(data)) {
      result = await model.createMany({ data, skipDuplicates: true });
    } else {
      result = await model.create({ data });
      broadcastDbChange(table, "INSERT", { eventType: "INSERT", new: result });
    }

    return NextResponse.json({ data: result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
