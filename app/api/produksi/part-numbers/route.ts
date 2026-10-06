// app/api/produksi/part-numbers/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

    if (lineId && mesin) {
      where.OR = [{ line_id: lineId }, { mesin: mesin }];
    } else if (lineId) {
      const lineData = await prisma.line.findUnique({
        where: { id: lineId },
        select: { machine_type: true },
      });
      const mesinKey = lineData?.machine_type ? lineData.machine_type.replace(/-/g, "_") : null;
      if (mesinKey) {
        where.OR = [{ line_id: lineId }, { mesin: mesinKey }];
      } else {
        where.line_id = lineId;
      }
    } else if (mesin) {
      where.mesin = mesin;
    }

    const data = await prisma.prodPartNumber.findMany({
      where,
      orderBy: { value: "asc" },
    });

    return NextResponse.json({ data, error: null });
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

    const data = await prisma.prodPartNumber.create({
      data: {
        mesin,
        line_id: line_id ?? null,
        value: value.trim(),
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

    return NextResponse.json({ data, error: null });
  } catch (e: any) {
    console.error("[DELETE /api/produksi/part-numbers]", e);
    return NextResponse.json({ data: null, error: e.message }, { status: 500 });
  }
}
