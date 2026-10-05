// app/api/db/upsert/route.ts
// Generic upsert endpoint — dipakai oleh lib/supabase/client.ts

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcastDbChange } from "@/lib/socket";

const TABLE_MAP: Record<string, any> = {
  push_subscriptions: prisma.pushSubscription,
  andon_leaders: prisma.andonLeader,
  prod_mesin_settings: prisma.prodMesinSettings,
  prod_line_settings: prisma.prodLineSettings,
  display_documents: prisma.displayDocument,
  display_heartbeats: prisma.displayHeartbeat,
  productivity_daily_reference: prisma.productivityDailyReference,
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { table, data, onConflict } = body;

    const model = TABLE_MAP[table];
    if (!model) {
      return NextResponse.json({ error: `Table '${table}' tidak dikenali untuk upsert` }, { status: 400 });
    }

    // Tentukan unique key dari onConflict
    const conflictField = onConflict?.split(",")[0]?.trim() || "id";
    const conflictValue = data[conflictField];

    let result;
    if (conflictValue !== undefined) {
      result = await (model as any).upsert({
        where: { [conflictField]: conflictValue },
        create: data,
        update: data,
      });
    } else {
      result = await (model as any).create({ data });
    }

    broadcastDbChange(table, "INSERT", { eventType: "INSERT", new: result });
    return NextResponse.json({ data: result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
