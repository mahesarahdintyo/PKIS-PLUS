// app/api/produksi/scrap/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tahun = searchParams.get("tahun");
    const bulan = searchParams.get("bulan");
    const limit = parseInt(searchParams.get("limit") || "60", 10);
    const page = parseInt(searchParams.get("page") || "0", 10);
    const isActiveStr = searchParams.get("is_active");
    const isActive = isActiveStr !== null ? isActiveStr === "true" : true;

    const where: any = {};
    if (isActiveStr !== "all") where.is_active = isActive;
    if (tahun && tahun !== "all") where.tahun = parseInt(tahun, 10);
    if (bulan && bulan !== "all") where.bulan = parseInt(bulan, 10);

    const data = await prisma.prodScrapTopEnd.findMany({
      where,
      orderBy: [{ tahun: "desc" }, { bulan: "desc" }],
      take: limit,
      skip: page * limit,
    });

    return NextResponse.json({ data, error: null });
  } catch (e: any) {
    console.error("[GET /api/produksi/scrap]", e);
    return NextResponse.json({ data: null, error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = body.data || body;

    const res = await prisma.prodScrapTopEnd.upsert({
      where: {
        tahun_bulan: {
          tahun: Number(data.tahun),
          bulan: Number(data.bulan),
        },
      },
      update: {
        scrap_value_kidr: data.scrap_value_kidr !== undefined ? Number(data.scrap_value_kidr) : undefined,
        total_value_kidr: data.total_value_kidr !== undefined ? Number(data.total_value_kidr) : undefined,
        target_rasio: data.target_rasio !== undefined ? Number(data.target_rasio) : undefined,
        is_active: data.is_active !== undefined ? data.is_active : true,
      },
      create: {
        tahun: Number(data.tahun),
        bulan: Number(data.bulan),
        scrap_value_kidr: data.scrap_value_kidr !== undefined ? Number(data.scrap_value_kidr) : 0,
        total_value_kidr: data.total_value_kidr !== undefined ? Number(data.total_value_kidr) : 0,
        target_rasio: data.target_rasio !== undefined ? Number(data.target_rasio) : null,
        is_active: data.is_active !== undefined ? data.is_active : true,
      },
    });

    return NextResponse.json({ data: res, error: null });
  } catch (e: any) {
    console.error("[POST /api/produksi/scrap]", e);
    return NextResponse.json({ data: null, error: e.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, ids, data } = body;

    if (!id && (!ids || ids.length === 0)) {
      return NextResponse.json({ data: null, error: "id atau ids wajib diisi" }, { status: 400 });
    }

    // Only allow schema fields
    const allowedFields = ["scrap_value_kidr", "total_value_kidr", "target_rasio", "is_active"];
    const cleanData: any = {};
    for (const key of allowedFields) {
      if (data[key] !== undefined) {
        cleanData[key] = key !== "is_active" ? Number(data[key]) : data[key];
      }
    }

    if (ids && ids.length > 0) {
      const res = await prisma.prodScrapTopEnd.updateMany({
        where: { id: { in: ids } },
        data: cleanData,
      });
      return NextResponse.json({ data: res, error: null });
    }

    const res = await prisma.prodScrapTopEnd.update({
      where: { id },
      data: cleanData,
    });

    return NextResponse.json({ data: res, error: null });
  } catch (e: any) {
    console.error("[PATCH /api/produksi/scrap]", e);
    return NextResponse.json({ data: null, error: e.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { searchParams } = new URL(request.url);
    const id = body.id || searchParams.get("id");
    const ids = body.ids || (id ? [id] : []);

    if (ids.length === 0) {
      return NextResponse.json({ data: null, error: "id atau ids wajib diisi" }, { status: 400 });
    }

    const res = await prisma.prodScrapTopEnd.updateMany({
      where: { id: { in: ids } },
      data: { is_active: false },
    });

    return NextResponse.json({ data: res, count: res.count, error: null });
  } catch (e: any) {
    console.error("[DELETE /api/produksi/scrap]", e);
    return NextResponse.json({ data: null, error: e.message }, { status: 500 });
  }
}
