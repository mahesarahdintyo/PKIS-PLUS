// app/api/produksi/sync-offline/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { table, data } = body;

    if (!table || !data) {
      return NextResponse.json({ error: "table dan data wajib diisi" }, { status: 400 });
    }

    const payload = { ...data };
    delete payload._pending;
    if (payload.id && String(payload.id).startsWith("pending_")) {
      delete payload.id;
    }

    switch (table) {
      case "prod_production_log": {
        if (payload.waktu_awal) payload.waktu_awal = new Date(payload.waktu_awal);
        if (payload.waktu_akhir) payload.waktu_akhir = new Date(payload.waktu_akhir);
        const res = await prisma.prodProductionLog.create({ data: payload });
        return NextResponse.json({ data: res });
      }
      case "prod_dandori_log": {
        if (payload.waktu_awal) payload.waktu_awal = new Date(payload.waktu_awal);
        if (payload.waktu_akhir) payload.waktu_akhir = new Date(payload.waktu_akhir);
        const res = await prisma.prodDandoriLog.create({ data: payload });
        return NextResponse.json({ data: res });
      }
      case "prod_downtime_log": {
        if (payload.start_time) payload.start_time = new Date(payload.start_time);
        if (payload.end_time) payload.end_time = new Date(payload.end_time);
        const res = await prisma.prodDowntimeLog.create({ data: payload });
        return NextResponse.json({ data: res });
      }
      case "prod_production_planning": {
        if (payload.tanggal) payload.tanggal = new Date(payload.tanggal);
        const res = await prisma.prodProductionPlanning.create({ data: payload });
        return NextResponse.json({ data: res });
      }
      case "prod_safety_log": {
        if (payload.tanggal) payload.tanggal = new Date(payload.tanggal);
        const res = await prisma.prodSafetyLog.create({ data: payload });
        return NextResponse.json({ data: res });
      }
      case "prod_scrap_top_end": {
        const res = await prisma.prodScrapTopEnd.create({ data: payload });
        return NextResponse.json({ data: res });
      }
      case "prod_attendance_log": {
        if (payload.tanggal) payload.tanggal = new Date(payload.tanggal);
        const res = await prisma.prodAttendanceLog.create({ data: payload });
        return NextResponse.json({ data: res });
      }
      default:
        return NextResponse.json({ error: `Tabel ${table} tidak didukung` }, { status: 400 });
    }
  } catch (e: any) {
    console.error("[POST /api/produksi/sync-offline]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
