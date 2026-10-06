// app/api/produksi/master-data/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function normalizeType(t: string | null): string {
  if (!t) return "all";
  if (t === "problems" || t === "downtime-problems") return "downtime-problems";
  if (t === "nonproduksi" || t === "nonproduksi-types") return "nonproduksi-types";
  return t;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = normalizeType(searchParams.get("type"));
    const mesin = searchParams.get("mesin");
    const lineId = searchParams.get("line_id");

    const where: any = {};
    if (mesin && mesin !== "all") where.mesin = mesin;
    if (lineId && lineId !== "all") where.line_id = lineId;

    if (type === "settings") {
      const settingsWhere: any = {};
      if (mesin && mesin !== "all") settingsWhere.mesin = mesin;
      const data = await prisma.prodMesinSettings.findMany({
        where: settingsWhere,
        orderBy: { mesin: "asc" },
      });
      return NextResponse.json({ data, error: null });
    }

    if (type === "downtime-problems") {
      const data = await prisma.prodDowntimeProblem.findMany({
        where: { ...where, is_active: true },
        orderBy: { value: "asc" },
      });
      return NextResponse.json({ data, error: null });
    }

    if (type === "nonproduksi-types") {
      const data = await prisma.prodNonproduksiType.findMany({
        where: { ...where, is_active: true },
        orderBy: { nama: "asc" },
      });
      return NextResponse.json({ data, error: null });
    }

    // Default: return all 3
    const settingsWhere: any = {};
    if (mesin && mesin !== "all") settingsWhere.mesin = mesin;
    const [settings, downtimeProblems, nonproduksiTypes] = await Promise.all([
      prisma.prodMesinSettings.findMany({ where: settingsWhere, orderBy: { mesin: "asc" } }),
      prisma.prodDowntimeProblem.findMany({ where: { ...where, is_active: true }, orderBy: { value: "asc" } }),
      prisma.prodNonproduksiType.findMany({ where: { ...where, is_active: true }, orderBy: { nama: "asc" } }),
    ]);

    return NextResponse.json({
      data: { settings, downtimeProblems, nonproduksiTypes },
      error: null,
    });
  } catch (e: any) {
    console.error("[GET /api/produksi/master-data]", e);
    return NextResponse.json({ data: null, error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const type = normalizeType(body.type);
    const { data } = body;

    if (!type || !data) {
      return NextResponse.json({ data: null, error: "type dan data wajib diisi" }, { status: 400 });
    }

    if (type === "settings") {
      const { mesin, gsph_target_mode, gsph_target_fixed, target_availability } = data;
      const res = await prisma.prodMesinSettings.upsert({
        where: { mesin },
        update: {
          gsph_target_mode: gsph_target_mode ?? undefined,
          gsph_target_fixed: gsph_target_fixed !== undefined ? Number(gsph_target_fixed) : undefined,
          target_availability: target_availability !== undefined ? Number(target_availability) : undefined,
        },
        create: {
          mesin,
          gsph_target_mode: gsph_target_mode ?? "fixed",
          gsph_target_fixed: gsph_target_fixed !== undefined ? Number(gsph_target_fixed) : 0,
          target_availability: target_availability !== undefined ? Number(target_availability) : undefined,
        },
      });
      return NextResponse.json({ data: res, error: null });
    }

    if (type === "downtime-problems") {
      const { mesin, line_id, value } = data;
      const res = await prisma.prodDowntimeProblem.create({
        data: {
          mesin,
          line_id: line_id ?? null,
          value: value.trim(),
          is_active: true,
        },
      });
      return NextResponse.json({ data: res, error: null });
    }

    if (type === "nonproduksi-types") {
      const { mesin, line_id, nama } = data;
      const res = await prisma.prodNonproduksiType.create({
        data: {
          mesin,
          line_id: line_id ?? null,
          nama: (nama || "").trim(),
          is_active: true,
        },
      });
      return NextResponse.json({ data: res, error: null });
    }

    return NextResponse.json({ data: null, error: "Tipe tidak valid" }, { status: 400 });
  } catch (e: any) {
    console.error("[POST /api/produksi/master-data]", e);
    return NextResponse.json({ data: null, error: e.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const type = normalizeType(body.type);
    const { id, data } = body;

    if (!type || !id) {
      return NextResponse.json({ data: null, error: "type dan id wajib diisi" }, { status: 400 });
    }

    if (type === "downtime-problems") {
      const res = await prisma.prodDowntimeProblem.update({
        where: { id },
        data,
      });
      return NextResponse.json({ data: res, error: null });
    }

    if (type === "nonproduksi-types") {
      const res = await prisma.prodNonproduksiType.update({
        where: { id },
        data,
      });
      return NextResponse.json({ data: res, error: null });
    }

    if (type === "settings") {
      // PK is mesin, id here refers to the mesin value
      const { gsph_target_mode, gsph_target_fixed, target_availability, updated_by } = data || {};
      const res = await prisma.prodMesinSettings.update({
        where: { mesin: String(id) },
        data: {
          ...(gsph_target_mode !== undefined ? { gsph_target_mode } : {}),
          ...(gsph_target_fixed !== undefined ? { gsph_target_fixed: Number(gsph_target_fixed) } : {}),
          ...(target_availability !== undefined ? { target_availability: Number(target_availability) } : {}),
          ...(updated_by !== undefined ? { updated_by } : {}),
        },
      });
      return NextResponse.json({ data: res, error: null });
    }

    return NextResponse.json({ data: null, error: "Tipe tidak valid" }, { status: 400 });
  } catch (e: any) {
    console.error("[PATCH /api/produksi/master-data]", e);
    return NextResponse.json({ data: null, error: e.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const type = normalizeType(body.type || searchParams.get("type"));
    const id = body.id || searchParams.get("id");

    if (!type || !id) {
      return NextResponse.json({ data: null, error: "type dan id wajib diisi" }, { status: 400 });
    }

    if (type === "downtime-problems") {
      const res = await prisma.prodDowntimeProblem.update({
        where: { id },
        data: { is_active: false },
      });
      return NextResponse.json({ data: res, error: null });
    }

    if (type === "nonproduksi-types") {
      const res = await prisma.prodNonproduksiType.update({
        where: { id },
        data: { is_active: false },
      });
      return NextResponse.json({ data: res, error: null });
    }

    return NextResponse.json({ data: null, error: "Tipe tidak valid" }, { status: 400 });
  } catch (e: any) {
    console.error("[DELETE /api/produksi/master-data]", e);
    return NextResponse.json({ data: null, error: e.message }, { status: 500 });
  }
}
