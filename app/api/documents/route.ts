import { prisma } from "@/lib/prisma";
import { getCurrentUserProfile } from "@/lib/services/auth-server";
import { NextResponse } from "next/server";

// GET - Fetch documents
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const folderIdStr = searchParams.get("folderId");
    const folderId = folderIdStr ? parseInt(folderIdStr) : null;

    const reqLineId = searchParams.get("lineId");
    const searchQuery = searchParams.get("search")?.trim();
    const includeHidden = searchParams.get("includeHidden") === "true";
    const showTrash = searchParams.get("trash") === "true";

    const userProfile = await getCurrentUserProfile();
    if (!userProfile.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const lineId =
      userProfile.role === "operator" && userProfile.lineId
        ? userProfile.lineId
        : reqLineId;

    const where: any = {};

    if (showTrash) {
      where.is_active = false;
    } else {
      where.OR = [{ is_active: true }, { is_active: null }];
    }

    if (searchQuery) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { title: { contains: searchQuery, mode: "insensitive" } },
            { description: { contains: searchQuery, mode: "insensitive" } },
            { file_name: { contains: searchQuery, mode: "insensitive" } },
          ],
        },
      ];
    } else if (folderIdStr) {
      where.folder_id = folderId;
    } else {
      where.folder_id = null;
    }

    if (!includeHidden) {
      where.hidden_from_operator = false;
    }

    const rawDocs = await prisma.document.findMany({
      where,
      include: {
        folder: {
          select: {
            id: true,
            name: true,
            line_id: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
    });

    // Filter line di sisi server
    const documents = lineId
      ? rawDocs.filter((doc) => {
          if (doc.folder_id) {
            return doc.folder?.line_id === lineId;
          }
          return doc.line_id === lineId;
        })
      : rawDocs;

    const transformedDocuments = documents.map((doc) => ({
      id: doc.id,
      lineId: doc.line_id ?? doc.folder?.line_id ?? undefined,
      title: doc.title,
      description: doc.description,
      category: "Lainnya",
      type: doc.file_type,
      file: {
        name: doc.file_name,
        path: doc.file_path,
        size: doc.file_size,
      },
      targetTime: doc.target_time,
      hiddenFromOperator: doc.hidden_from_operator,
      linkedPartNumbers: [],
    }));

    return NextResponse.json(transformedDocuments);
  } catch (error: any) {
    console.error("Documents GET error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Create document
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      title,
      description,
      category_id,
      file_name,
      file_path,
      file_size,
      file_type,
      target_time,
      folder_id,
      line_id,
    } = body;

    if (!title || !file_name || !file_path) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const userProfile = await getCurrentUserProfile();
    if (!userProfile.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const newDoc = await prisma.document.create({
      data: {
        title,
        description: description || null,
        category_id: category_id ? parseInt(category_id) : null,
        folder_id: folder_id ? parseInt(folder_id) : null,
        line_id: line_id || null,
        file_name,
        file_path,
        file_size: file_size ? parseInt(file_size) : null,
        file_type: file_type || "pdf",
        target_time: target_time || null,
        is_active: true,
      },
    });

    return NextResponse.json(newDoc, { status: 201 });
  } catch (error: any) {
    console.error("Documents POST error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Bulk soft-delete documents
export async function DELETE(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body?.ids) ? body.ids : [];

    if (ids.length === 0) {
      return NextResponse.json(
        { error: "No document IDs provided" },
        { status: 400 }
      );
    }

    const userProfile = await getCurrentUserProfile();
    if (!userProfile.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Remove from display_documents first
    await prisma.displayDocument.deleteMany({
      where: { document_id: { in: ids } },
    });

    // Soft-delete all documents
    await prisma.document.updateMany({
      where: { id: { in: ids } },
      data: { is_active: false },
    });

    return NextResponse.json({ success: true, deleted: ids.length });
  } catch (error: any) {
    console.error("Documents bulk DELETE error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
