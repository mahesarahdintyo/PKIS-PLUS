// app/api/lines/route.ts
// Refactored: Supabase → Prisma

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserProfile } from "@/lib/services/auth-server";
import { broadcastDbChange } from "@/lib/socket";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeHidden = searchParams.get("includeHidden") === "true";
    const showTrash = searchParams.get("trash") === "true";
    const userProfile = await getCurrentUserProfile();

    const where: any = {};

    if (userProfile.role === "operator" && userProfile.lineId) {
      where.id = userProfile.lineId;
    } else if (!includeHidden) {
      where.hidden_from_operator = false;
    }

    if (showTrash) {
      where.is_active = false;
    } else {
      where.OR = [{ is_active: true }, { is_active: null }];
    }

    const [lines, documents] = await Promise.all([
      prisma.line.findMany({
        where,
        orderBy: { name: "asc" },
      }),
      prisma.document.findMany({
        where: { OR: [{ is_active: true }, { is_active: null }] },
        select: { line_id: true, folder: { select: { line_id: true } } },
      }),
    ]);

    // Count documents per line
    const documentCountByLineId = new Map<string, number>();
    for (const doc of documents) {
      const lineId = doc.line_id ?? (doc.folder as any)?.line_id;
      if (lineId) {
        documentCountByLineId.set(lineId, (documentCountByLineId.get(lineId) ?? 0) + 1);
      }
    }

    return NextResponse.json(
      lines.map((line) => ({
        ...line,
        document_count: documentCountByLineId.get(line.id) ?? 0,
      }))
    );
  } catch (error) {
    console.error("Lines GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userProfile = await getCurrentUserProfile();
    if (!userProfile.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description =
      typeof body.description === "string" && body.description.trim()
        ? body.description.trim()
        : null;
    const machine_type =
      typeof body.machine_type === "string" && body.machine_type.trim()
        ? body.machine_type.trim()
        : null;
    const station_config =
      body.station_config && typeof body.station_config === "object"
        ? body.station_config
        : { mode: "none" };

    if (!name) {
      return NextResponse.json(
        { error: "Nama line produksi tidak boleh kosong" },
        { status: 400 }
      );
    }

    // Cek duplikat nama (case-insensitive)
    const existing = await prisma.line.findFirst({
      where: { name: { contains: name, mode: "insensitive" }, is_active: true },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Line produksi dengan nama "${name}" sudah ada. Gunakan nama yang berbeda.` },
        { status: 409 }
      );
    }

    const newLine = await prisma.line.create({
      data: { name, description, machine_type, station_config, is_active: true },
    });

    broadcastDbChange("lines", "INSERT", { eventType: "INSERT", new: newLine });

    return NextResponse.json(newLine, { status: 201 });
  } catch (error) {
    console.error("Lines POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const userProfile = await getCurrentUserProfile();
    if (!userProfile.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description =
      typeof body.description === "string" && body.description.trim()
        ? body.description.trim()
        : null;

    const hasMachineType = "machine_type" in body;
    const machine_type = hasMachineType
      ? typeof body.machine_type === "string" && body.machine_type.trim()
        ? body.machine_type.trim()
        : null
      : undefined;

    const hasStationConfig = "station_config" in body;
    const station_config =
      hasStationConfig && body.station_config && typeof body.station_config === "object"
        ? body.station_config
        : undefined;

    if (!id) return NextResponse.json({ error: "Line ID tidak valid" }, { status: 400 });
    if (!name) return NextResponse.json({ error: "Nama line produksi tidak boleh kosong" }, { status: 400 });

    // Cek duplikat nama kecuali diri sendiri
    const existing = await prisma.line.findFirst({
      where: {
        name: { contains: name, mode: "insensitive" },
        is_active: true,
        NOT: { id },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `Line produksi dengan nama "${name}" sudah ada.` },
        { status: 409 }
      );
    }

    const updateData: any = { name, description };
    if (hasMachineType) updateData.machine_type = machine_type;
    if (hasStationConfig) updateData.station_config = station_config;

    const updatedLine = await prisma.line.update({ where: { id }, data: updateData });
    broadcastDbChange("lines", "UPDATE", { eventType: "UPDATE", new: updatedLine });

    return NextResponse.json(updatedLine);
  } catch (error) {
    console.error("Lines PUT error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const userProfile = await getCurrentUserProfile();
    if (!userProfile.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : "";
    const hiddenFromOperator = body.hidden_from_operator;

    if (!id) return NextResponse.json({ error: "Line ID is required" }, { status: 400 });
    if (typeof hiddenFromOperator !== "boolean") {
      return NextResponse.json({ error: "hidden_from_operator must be a boolean" }, { status: 400 });
    }

    const updatedLine = await prisma.line.update({
      where: { id },
      data: { hidden_from_operator: hiddenFromOperator },
    });

    if (!updatedLine) {
      return NextResponse.json({ error: "Data tidak ditemukan." }, { status: 403 });
    }

    broadcastDbChange("lines", "UPDATE", { eventType: "UPDATE", new: updatedLine });
    return NextResponse.json(updatedLine);
  } catch (error) {
    console.error("Lines PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const userProfile = await getCurrentUserProfile();
    if (!userProfile.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "Line ID is required" }, { status: 400 });

    // 1. Get all folders of this line
    const folders = await prisma.folder.findMany({
      where: { line_id: id },
      select: { id: true },
    });
    const folderIds = folders.map((f) => f.id);

    // 2. Find documents in this line or its folders
    const documentFilter: any = { OR: [{ line_id: id }] };
    if (folderIds.length > 0) {
      documentFilter.OR.push({ folder_id: { in: folderIds } });
    }

    const documents = await prisma.document.findMany({
      where: documentFilter,
      select: { id: true },
    });
    const docIds = documents.map((d) => d.id);

    if (docIds.length > 0) {
      // Clear display_documents references
      await prisma.displayDocument.deleteMany({
        where: { document_id: { in: docIds } },
      });
      // Soft delete documents
      await prisma.document.updateMany({
        where: { id: { in: docIds } },
        data: { is_active: false },
      });
    }

    // 3. Soft delete folders
    if (folderIds.length > 0) {
      await prisma.folder.updateMany({
        where: { id: { in: folderIds } },
        data: { is_active: false },
      });
    }

    // 4. Delete display heartbeats
    await prisma.displayHeartbeat.deleteMany({ where: { line_id: id } });

    // 5. Soft delete the line
    await prisma.line.update({ where: { id }, data: { is_active: false } });

    broadcastDbChange("lines", "DELETE", { eventType: "DELETE", old: { id } });

    return NextResponse.json({ success: true, message: "Line soft deleted successfully" });
  } catch (error) {
    console.error("Lines DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
