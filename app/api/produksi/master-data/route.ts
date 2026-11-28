// app/api/produksi/master-data/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcastDbChange } from "@/lib/socket";

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

    let resolvedMesin = mesin && mesin !== "all" ? mesin : null;
    if (!resolvedMesin && lineId && lineId !== "all") {
      const lineData = await prisma.line.findUnique({
        where: { id: lineId },
        select: { machine_type: true },
      });
      if (lineData?.machine_type) {
        resolvedMesin = lineData.machine_type.replace(/-/g, "_");
      }
    }

    if (type === "settings") {
      const settingsWhere: any = {};
      if (resolvedMesin) settingsWhere.mesin = resolvedMesin;
      const data = await prisma.prodMesinSettings.findMany({
        where: settingsWhere,
        orderBy: { mesin: "asc" },
      });
      const mapped = data.map((s) => ({
        ...s,
        gsph_target_fixed: s.gsph_target_fixed != null ? Number(s.gsph_target_fixed) : 0,
        target_availability: s.target_availability != null ? Number(s.target_availability) : null,
      }));
      if (resolvedMesin) {
        return NextResponse.json({ data: mapped[0] || null, error: null });
      }
      return NextResponse.json({ data: mapped, error: null });
    }

    const itemWhere: any = { is_active: true };
    if (resolvedMesin && lineId && lineId !== "all") {
      itemWhere.OR = [
        { mesin: resolvedMesin },
        { line_id: lineId },
      ];
    } else if (resolvedMesin) {
      itemWhere.mesin = resolvedMesin;
    } else if (lineId && lineId !== "all") {
      itemWhere.OR = [
        { line_id: lineId },
        { line_id: null },
      ];
    }

    if (type === "downtime-problems") {
      const data = await prisma.prodDowntimeProblem.findMany({
        where: itemWhere,
        orderBy: { value: "asc" },
      });
      const seen = new Set<string>();
      const deduped = data.filter((item) => {
        const key = item.value.trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return NextResponse.json({ data: deduped, error: null });
    }

    if (type === "nonproduksi-types") {
      const data = await prisma.prodNonproduksiType.findMany({
        where: itemWhere,
        orderBy: { nama: "asc" },
      });
      const seen = new Set<string>();
      const deduped = data.filter((item) => {
        const key = item.nama.trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return NextResponse.json({ data: deduped, error: null });
    }

    // Default: return all 3
    const settingsWhere: any = {};
    if (resolvedMesin) settingsWhere.mesin = resolvedMesin;
    const [rawSettings, rawProblems, rawNonproduksi] = await Promise.all([
      prisma.prodMesinSettings.findMany({ where: settingsWhere, orderBy: { mesin: "asc" } }),
      prisma.prodDowntimeProblem.findMany({ where: itemWhere, orderBy: { value: "asc" } }),
      prisma.prodNonproduksiType.findMany({ where: itemWhere, orderBy: { nama: "asc" } }),
    ]);

    const settings = rawSettings.map((s) => ({
      ...s,
      gsph_target_fixed: s.gsph_target_fixed != null ? Number(s.gsph_target_fixed) : 0,
      target_availability: s.target_availability != null ? Number(s.target_availability) : null,
    }));

    const seenProbs = new Set<string>();
    const downtimeProblems = rawProblems.filter((p) => {
      const key = p.value.trim().toLowerCase();
      if (seenProbs.has(key)) return false;
      seenProbs.add(key);
      return true;
    });

    const seenNp = new Set<string>();
    const nonproduksiTypes = rawNonproduksi.filter((np) => {
      const key = np.nama.trim().toLowerCase();
      if (seenNp.has(key)) return false;
      seenNp.add(key);
      return true;
    });

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
      const cleanValue = (value || "").trim();
      const res = await prisma.prodDowntimeProblem.upsert({
        where: {
          mesin_value: {
            mesin,
            value: cleanValue,
          },
        },
        update: {
          is_active: true,
          ...(line_id !== undefined ? { line_id: line_id ?? null } : {}),
        },
        create: {
          mesin,
          line_id: line_id ?? null,
          value: cleanValue,
          is_active: true,
        },
      });
      broadcastDbChange("prod_downtime_problems", "INSERT", { eventType: "INSERT", new: res });
      return NextResponse.json({ data: res, error: null });
    }

    if (type === "nonproduksi-types") {
      const { mesin, line_id, nama } = data;
      const cleanNama = (nama || "").trim();
      const res = await prisma.prodNonproduksiType.upsert({
        where: {
          mesin_nama: {
            mesin,
            nama: cleanNama,
          },
        },
        update: {
          is_active: true,
          ...(line_id !== undefined ? { line_id: line_id ?? null } : {}),
        },
        create: {
          mesin,
          line_id: line_id ?? null,
          nama: cleanNama,
          is_active: true,
        },
      });
      broadcastDbChange("prod_nonproduksi_types", "INSERT", { eventType: "INSERT", new: res });
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
      broadcastDbChange("prod_downtime_problems", "UPDATE", { eventType: "UPDATE", new: res });
      return NextResponse.json({ data: res, error: null });
    }

    if (type === "nonproduksi-types") {
      const res = await prisma.prodNonproduksiType.update({
        where: { id },
        data,
      });
      broadcastDbChange("prod_nonproduksi_types", "UPDATE", { eventType: "UPDATE", new: res });
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
      broadcastDbChange("prod_downtime_problems", "DELETE", { eventType: "DELETE", old: { id } });
      return NextResponse.json({ data: res, error: null });
    }

    if (type === "nonproduksi-types") {
      const res = await prisma.prodNonproduksiType.update({
        where: { id },
        data: { is_active: false },
      });
      broadcastDbChange("prod_nonproduksi_types", "DELETE", { eventType: "DELETE", old: { id } });
      return NextResponse.json({ data: res, error: null });
    }

    return NextResponse.json({ data: null, error: "Tipe tidak valid" }, { status: 400 });
  } catch (e: any) {
    console.error("[DELETE /api/produksi/master-data]", e);
    return NextResponse.json({ data: null, error: e.message }, { status: 500 });
  }
}
