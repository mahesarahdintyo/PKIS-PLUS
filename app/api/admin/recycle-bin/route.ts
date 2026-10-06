import { prisma } from "@/lib/prisma";
import { getCurrentUserProfile } from "@/lib/services/auth-server";
import { NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";

/** Verify the caller is an authenticated admin or leader. Returns 401/403 response on failure. */
async function requireAdminOrLeader(): Promise<NextResponse | null> {
  const { user, role } = await getCurrentUserProfile();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (role !== "admin" && role !== "leader") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return null; // guard passed
}

// All production tables that support soft-delete via is_active
const PROD_LOG_MODELS: Record<string, { model: any; key: string; label: string }> = {
  attendance_log: { model: prisma.prodAttendanceLog, key: "attendance_log", label: "Absensi" },
  productivity_ref: { model: prisma.productivityDailyReference, key: "productivity_ref", label: "Earned Hours" },
  scrap: { model: prisma.prodScrapTopEnd, key: "scrap", label: "Scrap" },
  safety_log: { model: prisma.prodSafetyLog, key: "safety_log", label: "Safety" },
  production_log: { model: prisma.prodProductionLog, key: "production_log", label: "Produksi" },
  downtime_log: { model: prisma.prodDowntimeLog, key: "downtime_log", label: "Downtime" },
  dandori_log: { model: prisma.prodDandoriLog, key: "dandori_log", label: "Non-Produksi" },
  production_planning: { model: prisma.prodProductionPlanning, key: "production_planning", label: "Planning" },
  andon_leader: { model: prisma.andonLeader, key: "andon_leader", label: "Andon Leader" },
  part_number: { model: prisma.prodPartNumber, key: "part_number", label: "Part Number" },
  nonproduksi_type: { model: prisma.prodNonproduksiType, key: "nonproduksi_type", label: "Jenis Non-Produksi" },
  downtime_problem: { model: prisma.prodDowntimeProblem, key: "downtime_problem", label: "Problem Downtime" },
};

async function deletePhysicalFiles(filePaths: string[]) {
  const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), "public", "uploads");
  for (const filePath of filePaths) {
    if (!filePath) continue;
    try {
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(uploadDir, filePath);
      await fs.unlink(fullPath).catch(() => {});
    } catch {}
  }
}

// Helper to hard delete a single record according to its type
async function hardDeleteRecord(type: string, id: string | number): Promise<{ success: boolean; error?: string }> {
  try {
    if (type === "line" || type === "land") {
      const lineId = String(id);
      const folders = await prisma.folder.findMany({
        where: { line_id: lineId },
        select: { id: true },
      });
      const folderIds = folders.map((f) => f.id);

      const docsInLine = await prisma.document.findMany({
        where: { line_id: lineId },
        select: { id: true, file_path: true },
      });

      let docsInFolders: { id: string; file_path: string }[] = [];
      if (folderIds.length > 0) {
        docsInFolders = await prisma.document.findMany({
          where: { folder_id: { in: folderIds } },
          select: { id: true, file_path: true },
        });
      }

      const allDocs = [...docsInLine, ...docsInFolders];
      const uniqueDocsMap = new Map<string, { id: string; file_path: string }>();
      allDocs.forEach((d) => uniqueDocsMap.set(d.id, d));
      const docs = Array.from(uniqueDocsMap.values());

      const filePaths = docs.map((d) => d.file_path).filter(Boolean);
      await deletePhysicalFiles(filePaths);

      const docIds = docs.map((d) => d.id);
      if (docIds.length > 0) {
        await prisma.displayDocument.deleteMany({
          where: { document_id: { in: docIds } },
        });
        await prisma.document.deleteMany({
          where: { id: { in: docIds } },
        });
      }

      if (folderIds.length > 0) {
        await prisma.folder.deleteMany({
          where: { id: { in: folderIds } },
        });
      }

      await prisma.productionReport.deleteMany({ where: { line_id: lineId } });
      await prisma.displayHeartbeat.deleteMany({ where: { line_id: lineId } });
      await prisma.line.deleteMany({ where: { id: lineId } });

      return { success: true };
    } else if (type === "folder") {
      const folderId = typeof id === "string" ? BigInt(id) : BigInt(id as number);

      const allFolderIds: bigint[] = [folderId];
      const queue: bigint[] = [folderId];

      while (queue.length > 0) {
        const currentIds = queue.splice(0, queue.length);
        const children = await prisma.folder.findMany({
          where: { parent_id: { in: currentIds } },
          select: { id: true },
        });

        if (children.length > 0) {
          const childIds = children.map((f) => f.id);
          allFolderIds.push(...childIds);
          queue.push(...childIds);
        }
      }

      const docs = await prisma.document.findMany({
        where: { folder_id: { in: allFolderIds } },
        select: { id: true, file_path: true },
      });

      if (docs.length > 0) {
        await deletePhysicalFiles(docs.map((d) => d.file_path).filter(Boolean));
        const docIds = docs.map((d) => d.id);
        await prisma.displayDocument.deleteMany({
          where: { document_id: { in: docIds } },
        });
        await prisma.document.deleteMany({
          where: { id: { in: docIds } },
        });
      }

      await prisma.folder.deleteMany({
        where: { id: { in: allFolderIds } },
      });

      return { success: true };
    } else if (type === "document") {
      const docId = String(id);
      const doc = await prisma.document.findUnique({
        where: { id: docId },
        select: { id: true, file_path: true },
      });

      if (doc?.file_path) {
        await deletePhysicalFiles([doc.file_path]);
      }

      await prisma.displayDocument.deleteMany({
        where: { document_id: docId },
      });
      await prisma.document.deleteMany({
        where: { id: docId },
      });

      return { success: true };
    } else if (type === "production_report") {
      await prisma.productionReport.deleteMany({ where: { id: String(id) } });
      return { success: true };
    } else if (PROD_LOG_MODELS[type]) {
      const { model } = PROD_LOG_MODELS[type];
      await model.deleteMany({ where: { id: String(id) } });
      return { success: true };
    } else {
      return { success: false, error: `Tipe tidak valid: ${type}` };
    }
  } catch (error: any) {
    return { success: false, error: error.message || String(error) };
  }
}

// DELETE - Delete single item, bulk items, or empty the whole Recycle Bin
export async function DELETE(request: Request) {
  const authResponse = await requireAdminOrLeader();
  if (authResponse) return authResponse;

  try {
    let type: string | null = null;
    let id: string | number | null = null;
    let items: Array<{ type: string; id: string | number }> | null = null;
    let action: string | null = null;

    try {
      const body = await request.json();
      type = body?.type ?? null;
      id = body?.id ?? null;
      items = Array.isArray(body?.items) ? body.items : null;
      action = body?.action ?? null;
    } catch {
      // JSON body was empty or not sent
    }

    if (!type && !id && !items && !action) {
      const { searchParams } = new URL(request.url);
      type = searchParams.get("type");
      id = searchParams.get("id");
      action = searchParams.get("action");
    }

    // 1. Bulk Items Permanent Hard Delete
    if (items && items.length > 0) {
      const errors: string[] = [];
      let deletedCount = 0;

      for (const item of items) {
        if (!item.type || !item.id) continue;
        const res = await hardDeleteRecord(item.type, item.id);
        if (res.success) {
          deletedCount++;
        } else if (res.error) {
          errors.push(res.error);
        }
      }

      if (errors.length > 0 && deletedCount === 0) {
        return NextResponse.json({ error: errors.join(", ") }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        deletedCount,
        message: `${deletedCount} item berhasil dihapus secara permanen.`,
      });
    }

    // 2. Single Item Permanent Hard Delete
    if (type && id) {
      const res = await hardDeleteRecord(type, id);
      if (!res.success) {
        return NextResponse.json({ error: res.error ?? "Gagal menghapus item" }, { status: 500 });
      }
      return NextResponse.json({
        success: true,
        message: "Item berhasil dihapus secara permanen.",
      });
    }

    // 3. Empty Entire Recycle Bin (action === 'empty_all')
    if (action !== "empty_all") {
      return NextResponse.json(
        { error: "Parameter type/id, items, atau action=empty_all diperlukan" },
        { status: 400 }
      );
    }

    const documents = await prisma.document.findMany({
      where: { is_active: false },
      select: { id: true, file_path: true },
    });

    const docIds = documents.map((d) => d.id);
    await deletePhysicalFiles(documents.map((d) => d.file_path).filter(Boolean));

    if (docIds.length > 0) {
      await prisma.displayDocument.deleteMany({
        where: { document_id: { in: docIds } },
      });
      await prisma.document.deleteMany({
        where: { id: { in: docIds } },
      });
    }

    const deletedFolders = await prisma.folder.deleteMany({
      where: { is_active: false },
    });

    const deletedProductionReports = await prisma.productionReport.deleteMany({
      where: { is_active: false },
    });

    const inactiveLines = await prisma.line.findMany({
      where: { is_active: false },
      select: { id: true },
    });
    const lineIds = inactiveLines.map((l) => l.id);
    if (lineIds.length > 0) {
      await prisma.displayHeartbeat.deleteMany({
        where: { line_id: { in: lineIds } },
      });
      await prisma.line.deleteMany({
        where: { id: { in: lineIds } },
      });
    }

    let deletedProdLogs = 0;
    for (const { model } of Object.values(PROD_LOG_MODELS)) {
      const res = await model.deleteMany({
        where: { is_active: false },
      });
      deletedProdLogs += res.count;
    }

    return NextResponse.json({
      success: true,
      message: "Tempat sampah berhasil dikosongkan secara permanen.",
      deleted: {
        lines: lineIds.length,
        folders: deletedFolders.count,
        documents: documents.length,
        productionReports: deletedProductionReports.count,
        prodLogs: deletedProdLogs,
      },
    });
  } catch (error: any) {
    console.error("Recycle Bin empty error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Restore a single item (set is_active = true)
export async function POST(request: Request) {
  const authResponse = await requireAdminOrLeader();
  if (authResponse) return authResponse;

  try {
    const body = await request.json();
    const { type, id } = body;

    if (!type || !id) {
      return NextResponse.json(
        { error: "Type and ID are required" },
        { status: 400 }
      );
    }

    if (type === "line" || type === "land") {
      const lineId = String(id);
      await prisma.line.updateMany({ where: { id: lineId }, data: { is_active: true } });

      const folders = await prisma.folder.findMany({
        where: { line_id: lineId },
        select: { id: true },
      });
      const folderIds = folders.map((f) => f.id);

      if (folderIds.length > 0) {
        await prisma.folder.updateMany({ where: { id: { in: folderIds } }, data: { is_active: true } });
        await prisma.document.updateMany({ where: { folder_id: { in: folderIds } }, data: { is_active: true } });
      }

      await prisma.document.updateMany({ where: { line_id: lineId }, data: { is_active: true } });
    } else if (type === "folder") {
      const folderId = typeof id === "string" ? BigInt(id) : BigInt(id as number);

      const allFolderIds: bigint[] = [folderId];
      const queue: bigint[] = [folderId];

      while (queue.length > 0) {
        const currentIds = queue.splice(0, queue.length);
        const children = await prisma.folder.findMany({
          where: { parent_id: { in: currentIds } },
          select: { id: true },
        });

        if (children.length > 0) {
          const childIds = children.map((f) => f.id);
          allFolderIds.push(...childIds);
          queue.push(...childIds);
        }
      }

      await prisma.folder.updateMany({ where: { id: { in: allFolderIds } }, data: { is_active: true } });
      await prisma.document.updateMany({ where: { folder_id: { in: allFolderIds } }, data: { is_active: true } });

      // Recursively ensure parent chain is active
      let currentFolderId: bigint | null = folderId;
      while (currentFolderId) {
        const folder: any = await prisma.folder.findUnique({
          where: { id: currentFolderId },
          select: { parent_id: true, line_id: true },
        });

        if (!folder) break;

        if (folder.parent_id) {
          await prisma.folder.updateMany({ where: { id: folder.parent_id }, data: { is_active: true } });
          currentFolderId = folder.parent_id;
        } else {
          if (folder.line_id) {
            await prisma.line.updateMany({ where: { id: folder.line_id }, data: { is_active: true } });
          }
          break;
        }
      }
    } else if (type === "production_report") {
      await prisma.productionReport.updateMany({ where: { id: String(id) }, data: { is_active: true } });
    } else if (type === "document") {
      const docId = String(id);
      await prisma.document.updateMany({ where: { id: docId }, data: { is_active: true } });

      const doc = await prisma.document.findUnique({
        where: { id: docId },
        select: { folder_id: true, line_id: true },
      });

      if (doc) {
        if (doc.line_id) {
          await prisma.line.updateMany({ where: { id: doc.line_id }, data: { is_active: true } });
        }
        if (doc.folder_id) {
          await prisma.folder.updateMany({ where: { id: doc.folder_id }, data: { is_active: true } });

          let currentFolderId: bigint | null = doc.folder_id;
          while (currentFolderId) {
            const folder: any = await prisma.folder.findUnique({
              where: { id: currentFolderId },
              select: { parent_id: true, line_id: true },
            });

            if (!folder) break;

            if (folder.parent_id) {
              await prisma.folder.updateMany({ where: { id: folder.parent_id }, data: { is_active: true } });
              currentFolderId = folder.parent_id;
            } else {
              if (folder.line_id) {
                await prisma.line.updateMany({ where: { id: folder.line_id }, data: { is_active: true } });
              }
              break;
            }
          }
        }
      }
    } else if (PROD_LOG_MODELS[type]) {
      const { model } = PROD_LOG_MODELS[type];
      await model.updateMany({ where: { id: String(id) }, data: { is_active: true } });
    } else {
      return NextResponse.json({ error: "Invalid type specified" }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Item berhasil dipulihkan." });
  } catch (error: any) {
    console.error("Recycle Bin restore error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}

// GET - Fetch trashed (is_active = false) production module records
export async function GET(request: Request) {
  const authResponse = await requireAdminOrLeader();
  if (authResponse) return authResponse;

  try {
    const { searchParams } = new URL(request.url);
    const group = searchParams.get("group"); // "log_produksi" | "master_data" | "andon"

    if (group === "log_produksi") {
      const tables = [
        PROD_LOG_MODELS.attendance_log,
        PROD_LOG_MODELS.productivity_ref,
        PROD_LOG_MODELS.scrap,
        PROD_LOG_MODELS.safety_log,
        PROD_LOG_MODELS.production_log,
        PROD_LOG_MODELS.downtime_log,
        PROD_LOG_MODELS.dandori_log,
        PROD_LOG_MODELS.production_planning,
      ];

      const results: any[] = [];
      for (const t of tables) {
        const data = await t.model.findMany({
          where: { is_active: false },
          orderBy: { created_at: "desc" },
          take: 200,
        });
        results.push(...data.map((r: any) => ({ ...r, _type: t.key, _label: t.label })));
      }
      return NextResponse.json(results);
    }

    if (group === "master_data") {
      const tables = [
        PROD_LOG_MODELS.part_number,
        PROD_LOG_MODELS.nonproduksi_type,
        PROD_LOG_MODELS.downtime_problem,
      ];

      const results: any[] = [];
      for (const t of tables) {
        const data = await t.model.findMany({
          where: { is_active: false },
          orderBy: { created_at: "desc" },
          take: 200,
        });
        results.push(...data.map((r: any) => ({ ...r, _type: t.key, _label: t.label })));
      }
      return NextResponse.json(results);
    }

    if (group === "andon") {
      const data = await prisma.andonLeader.findMany({
        where: { is_active: false },
        orderBy: { created_at: "desc" },
        take: 200,
      });
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: "group parameter required" }, { status: 400 });
  } catch (error: any) {
    console.error("Recycle Bin GET error:", error);
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 });
  }
}
