// app/api/produksi/part-numbers/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcastDbChange } from "@/lib/socket";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lineId = searchParams.get("line_id");
    const mesin = searchParams.get("mesin");
    const search = searchParams.get("search");
    const isActiveStr = searchParams.get("is_active");
    const isActive = isActiveStr !== null ? isActiveStr === "true" : true;

    const where: any = {};
    if (isActiveStr !== "all") {
      where.is_active = isActive;
    }

    if (search) {
      where.value = { contains: search, mode: "insensitive" };
    }

    const mesinVariants: string[] = [];
    if (mesin && mesin !== "all") {
      mesinVariants.push(mesin);
      if (mesin.includes("-")) mesinVariants.push(mesin.replace(/-/g, "_"));
      if (mesin.includes("_")) mesinVariants.push(mesin.replace(/_/g, "-"));
    }

    if (lineId && lineId !== "all") {
      const resolvedMesins = [...mesinVariants];
      if (resolvedMesins.length === 0) {
        const lineData = await prisma.line.findUnique({
          where: { id: lineId },
          select: { machine_type: true, name: true },
        });
        if (lineData?.machine_type) {
          const mk = lineData.machine_type;
          resolvedMesins.push(mk, mk.replace(/-/g, "_"), mk.replace(/_/g, "-"));
        }
      }
      if (resolvedMesins.length > 0) {
        where.OR = [
          { line_id: lineId },
          { mesin: { in: Array.from(new Set(resolvedMesins)) } },
        ];
      } else {
        where.line_id = lineId;
      }
    } else if (mesinVariants.length > 0) {
      where.mesin = { in: Array.from(new Set(mesinVariants)) };
    }

    const data = await prisma.prodPartNumber.findMany({
      where,
      orderBy: { value: "asc" },
    });

    const mapped = data.map((item) => ({
      ...item,
      output_ratio: item.output_ratio != null ? Number(item.output_ratio) : 1,
      stroke_ratio: item.stroke_ratio != null ? Number(item.stroke_ratio) : null,
      std_mp: item.std_mp != null ? Number(item.std_mp) : null,
      std_ct: item.std_ct != null ? Number(item.std_ct) : null,
      harga_pcs: item.harga_pcs != null ? Number(item.harga_pcs) : null,
    }));

    return NextResponse.json({ data: mapped, error: null });
  } catch (e: any) {
    console.error("[GET /api/produksi/part-numbers]", e);
    return NextResponse.json({ data: null, error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      mesin,
      line_id,
      value,
      next_processes,
      output_ratio,
      stroke_ratio,
      std_mp,
      std_ct,
      harga_pcs,
      document_id,
      is_active,
    } = body;

    if (!mesin || !value) {
      return NextResponse.json(
        { data: null, error: "mesin dan value wajib diisi" },
        { status: 400 }
      );
    }

    const cleanValue = value.trim();

    const data = await prisma.prodPartNumber.upsert({
      where: {
        mesin_value: {
          mesin,
          value: cleanValue,
        },
      },
      update: {
        line_id: line_id !== undefined ? (line_id ?? null) : undefined,
        next_processes: next_processes ?? undefined,
        output_ratio: output_ratio !== undefined ? output_ratio : undefined,
        stroke_ratio: stroke_ratio !== undefined ? stroke_ratio : undefined,
        std_mp: std_mp !== undefined ? std_mp : undefined,
        std_ct: std_ct !== undefined ? std_ct : undefined,
        harga_pcs: harga_pcs !== undefined ? harga_pcs : undefined,
        document_id: document_id !== undefined ? (document_id ?? null) : undefined,
        is_active: is_active !== undefined ? is_active : true,
      },
      create: {
        mesin,
        line_id: line_id ?? null,
        value: cleanValue,
        next_processes: next_processes ?? [],
        output_ratio: output_ratio !== undefined ? output_ratio : 1,
        stroke_ratio: stroke_ratio !== undefined ? stroke_ratio : null,
        std_mp: std_mp !== undefined ? std_mp : null,
        std_ct: std_ct !== undefined ? std_ct : null,
        harga_pcs: harga_pcs !== undefined ? harga_pcs : null,
        document_id: document_id ?? null,
        is_active: is_active !== undefined ? is_active : true,
      },
    });

    broadcastDbChange("prod_part_numbers", "INSERT", { eventType: "INSERT", new: data });

    return NextResponse.json({ data, error: null });
  } catch (e: any) {
    console.error("[POST /api/produksi/part-numbers]", e);
    return NextResponse.json({ data: null, error: e.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updateFields } = body;

    if (!id) {
      return NextResponse.json({ data: null, error: "id wajib diisi" }, { status: 400 });
    }

    const data = await prisma.prodPartNumber.update({
      where: { id },
      data: updateFields,
    });

    broadcastDbChange("prod_part_numbers", "UPDATE", { eventType: "UPDATE", new: data });

    return NextResponse.json({ data, error: null });
  } catch (e: any) {
    console.error("[PATCH /api/produksi/part-numbers]", e);
    return NextResponse.json({ data: null, error: e.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const id = body.id || searchParams.get("id");

    if (!id) {
      return NextResponse.json({ data: null, error: "id wajib diisi" }, { status: 400 });
    }

    const data = await prisma.prodPartNumber.update({
      where: { id },
      data: { is_active: false },
    });

    broadcastDbChange("prod_part_numbers", "DELETE", { eventType: "DELETE", old: { id } });

    return NextResponse.json({ data, error: null });
  } catch (e: any) {
    console.error("[DELETE /api/produksi/part-numbers]", e);
    return NextResponse.json({ data: null, error: e.message }, { status: 500 });
  }
}
