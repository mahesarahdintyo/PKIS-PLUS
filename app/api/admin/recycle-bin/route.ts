import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// DELETE - Delete single item permanently or empty the whole Recycle Bin
export async function DELETE(request: Request) {
  try {
    const supabase = createAdminClient();

    let type: string | null = null;
    let id: string | number | null = null;

    try {
      const body = await request.json();
      type = body?.type ?? null;
      id = body?.id ?? null;
    } catch {
      // JSON body was empty or not sent
    }

    if (!type || !id) {
      const { searchParams } = new URL(request.url);
      type = searchParams.get("type");
      id = searchParams.get("id");
    }

    // -------------------------------------------------------------
    // Single Item Permanent Hard Delete
    // -------------------------------------------------------------
    if (type && id) {
      if (type === "land") {
        const { data: folders } = await supabase
          .from("folders")
          .select("id")
          .eq("land_id", id);
        const folderIds = (folders ?? []).map((f) => f.id);

        const { data: docsInLand } = await supabase
          .from("documents")
          .select("id, file_path")
          .eq("land_id", id);

        let docsInFolders: { id: number | string; file_path: string | null }[] = [];
        if (folderIds.length > 0) {
          const { data: df } = await supabase
            .from("documents")
            .select("id, file_path")
            .in("folder_id", folderIds);
          docsInFolders = df ?? [];
        }

        const allDocs = [...(docsInLand ?? []), ...docsInFolders];
        const uniqueDocsMap = new Map();
        allDocs.forEach((d) => uniqueDocsMap.set(d.id, d));
        const docs = Array.from(uniqueDocsMap.values());

        const filePaths = docs
          .map((d) => d.file_path)
          .filter((p): p is string => typeof p === "string" && p.length > 0);

        if (filePaths.length > 0) {
          await supabase.storage.from("documents").remove(filePaths);
        }

        const docIds = docs.map((d) => d.id);
        if (docIds.length > 0) {
          await supabase.from("display_documents").delete().in("document_id", docIds);
          for (const dId of docIds) {
            await supabase.from("display_documents").delete().eq("document->>id", dId);
          }
          await supabase.from("documents").delete().in("id", docIds);
        }

        if (folderIds.length > 0) {
          await supabase.from("folders").delete().in("id", folderIds);
        }

        await supabase.from("production_reports").delete().eq("land_id", id);
        await supabase.from("display_heartbeats").delete().eq("land_id", id);

        const { error } = await supabase.from("lands").delete().eq("id", id);
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          message: "Card berhasil dihapus secara permanen.",
        });
      } else if (type === "folder") {
        const folderId = typeof id === "string" ? parseInt(id) : id;

        const allFolderIds: number[] = [folderId];
        const queue: number[] = [folderId];

        while (queue.length > 0) {
          const currentIds = queue.splice(0, queue.length);
          const { data: children } = await supabase
            .from("folders")
            .select("id")
            .in("parent_id", currentIds);

          if (children && children.length > 0) {
            const childIds = children.map((f) => f.id as number);
            allFolderIds.push(...childIds);
            queue.push(...childIds);
          }
        }

        const { data: docs } = await supabase
          .from("documents")
          .select("id, file_path")
          .in("folder_id", allFolderIds);

        if (docs && docs.length > 0) {
          const filePaths = docs
            .map((d) => d.file_path)
            .filter((p): p is string => typeof p === "string" && p.length > 0);

          if (filePaths.length > 0) {
            await supabase.storage.from("documents").remove(filePaths);
          }

          const docIds = docs.map((d) => d.id);
          await supabase.from("display_documents").delete().in("document_id", docIds);
          for (const dId of docIds) {
            await supabase.from("display_documents").delete().eq("document->>id", dId);
          }
          await supabase.from("documents").delete().in("id", docIds);
        }

        const { error } = await supabase.from("folders").delete().in("id", allFolderIds);
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          message: "Folder berhasil dihapus secara permanen.",
        });
      } else if (type === "document") {
        const { data: doc } = await supabase
          .from("documents")
          .select("id, file_path")
          .eq("id", id)
          .single();

        if (doc?.file_path) {
          await supabase.storage.from("documents").remove([doc.file_path]);
        }

        await supabase.from("display_documents").delete().eq("document_id", id);
        await supabase.from("display_documents").delete().eq("document->>id", id);

        const { error } = await supabase.from("documents").delete().eq("id", id);
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          message: "Dokumen berhasil dihapus secara permanen.",
        });
      } else if (type === "production_report") {
        const { error } = await supabase.from("production_reports").delete().eq("id", id);
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          message: "Laporan produksi berhasil dihapus secara permanen.",
        });
      } else {
        return NextResponse.json({ error: "Invalid type specified" }, { status: 400 });
      }
    }

    // -------------------------------------------------------------
    // Empty Entire Recycle Bin (All is_active = false records)
    // -------------------------------------------------------------

    // 1. Fetch all inactive records first so deletes can be scoped by explicit IDs.
    const { data: documents, error: docsFetchError } = await supabase
      .from("documents")
      .select("id, file_path")
      .eq("is_active", false);

    if (docsFetchError) {
      return NextResponse.json({ error: docsFetchError.message }, { status: 500 });
    }

    const { data: folders, error: foldersFetchError } = await supabase
      .from("folders")
      .select("id")
      .eq("is_active", false);

    if (foldersFetchError) {
      return NextResponse.json({ error: foldersFetchError.message }, { status: 500 });
    }

    const { data: reports, error: reportsFetchError } = await supabase
      .from("production_reports")
      .select("id")
      .eq("is_active", false);

    if (reportsFetchError) {
      return NextResponse.json({ error: reportsFetchError.message }, { status: 500 });
    }

    const { data: lands, error: landsFetchError } = await supabase
      .from("lands")
      .select("id")
      .eq("is_active", false);

    if (landsFetchError) {
      return NextResponse.json({ error: landsFetchError.message }, { status: 500 });
    }

    const docIds = (documents ?? []).map((document) => document.id);
    const folderIds = (folders ?? []).map((folder) => folder.id);
    const landIds = (lands ?? []).map((land) => land.id);
    const reportIds = (reports ?? []).map((report) => report.id);

    // 2. Delete physical files from Supabase Storage. Missing files should not block DB cleanup.
    if ((documents ?? []).length > 0) {
      const filePaths = (documents ?? [])
        .map((d) => d.file_path)
        .filter((path): path is string => typeof path === "string" && path.length > 0);

      if (filePaths.length > 0) {
        const { error: storageError } = await supabase.storage
          .from("documents")
          .remove(filePaths);

        if (storageError) {
          console.error("Supabase Storage hard delete error during empty trash:", storageError);
          // We continue to clean the database even if storage removal failed (e.g. missing files)
        }
      }

      // Clear references in display_documents for these documents
      await supabase.from("display_documents").delete().in("document_id", docIds);
      for (const docId of docIds) {
        await supabase.from("display_documents").delete().eq("document->>id", docId);
      }
    }

    // 3. Database DELETE inactive documents
    let deletedDocuments = 0;
    if (docIds.length > 0) {
      const { count, error: docDeleteError } = await supabase
        .from("documents")
        .delete({ count: "exact" })
        .in("id", docIds);

      if (docDeleteError) {
        return NextResponse.json({ error: docDeleteError.message }, { status: 500 });
      }

      deletedDocuments = count ?? 0;
    }

    // 4. Delete inactive folders.
    let deletedFolders = 0;
    if (folderIds.length > 0) {
      const { count, error: folderDeleteError } = await supabase
        .from("folders")
        .delete({ count: "exact" })
        .in("id", folderIds);

      if (folderDeleteError) {
        return NextResponse.json({ error: folderDeleteError.message }, { status: 500 });
      }

      deletedFolders = count ?? 0;
    }

    // 5. Delete inactive production reports.
    let deletedProductionReports = 0;
    if (reportIds.length > 0) {
      const { count, error: reportDeleteError } = await supabase
        .from("production_reports")
        .delete({ count: "exact" })
        .in("id", reportIds);

      if (reportDeleteError) {
        return NextResponse.json({ error: reportDeleteError.message }, { status: 500 });
      }

      deletedProductionReports = count ?? 0;
    }

    // 6. Delete inactive lands and related heartbeat rows.
    let deletedLands = 0;
    if (landIds.length > 0) {
      await supabase.from("display_heartbeats").delete().in("land_id", landIds);

      const { count, error: landDeleteError } = await supabase
        .from("lands")
        .delete({ count: "exact" })
        .in("id", landIds);

      if (landDeleteError) {
        return NextResponse.json({ error: landDeleteError.message }, { status: 500 });
      }

      deletedLands = count ?? 0;
    }

    return NextResponse.json({
      success: true,
      message: "Tempat sampah berhasil dikosongkan secara permanen.",
      deleted: {
        lands: deletedLands,
        folders: deletedFolders,
        documents: deletedDocuments,
        productionReports: deletedProductionReports,
      },
    });
  } catch (error) {
    console.error("Recycle Bin empty error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
// POST - Restore a single item (set is_active = true, and recursively activate its dependencies)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, id } = body;

    if (!type || !id) {
      return NextResponse.json(
        { error: "Type ('land' | 'folder' | 'document' | 'production_report') and ID are required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    if (type === "land") {
      // 1. Restore the land itself
      await supabase.from("lands").update({ is_active: true }).eq("id", id);

      // 2. Restore all folders of this land
      const { data: folders } = await supabase
        .from("folders")
        .select("id")
        .eq("land_id", id);

      const folderIds = (folders ?? []).map((f) => f.id);

      if (folderIds.length > 0) {
        await supabase.from("folders").update({ is_active: true }).in("id", folderIds);
        // Restore documents inside the land's folders
        await supabase.from("documents").update({ is_active: true }).in("folder_id", folderIds);
      }

      // 3. Restore all documents directly in the land
      await supabase.from("documents").update({ is_active: true }).eq("land_id", id);

    } else if (type === "folder") {
      const folderId = typeof id === "string" ? parseInt(id) : id;

      // 1. Restore folder and all its child folders/documents recursively
      const allFolderIds: number[] = [folderId];
      const queue: number[] = [folderId];

      while (queue.length > 0) {
        const currentIds = queue.splice(0, queue.length);

        const { data: children } = await supabase
          .from("folders")
          .select("id")
          .in("parent_id", currentIds);

        if (children && children.length > 0) {
          const childIds = children.map((f) => f.id as number);
          allFolderIds.push(...childIds);
          queue.push(...childIds);
        }
      }

      // Restore all folders in the hierarchy
      await supabase.from("folders").update({ is_active: true }).in("id", allFolderIds);

      // Restore all documents in these folders
      await supabase.from("documents").update({ is_active: true }).in("folder_id", allFolderIds);

      // 2. Recursively ensure parent chain (parent folders and parent land) is active
      let currentFolderId: number | null = folderId;
      while (currentFolderId) {
        const { data: folder } = await supabase
          .from("folders")
          .select("parent_id, land_id")
          .eq("id", currentFolderId)
          .single();

        if (!folder) break;

        if (folder.parent_id) {
          await supabase.from("folders").update({ is_active: true }).eq("id", folder.parent_id);
          currentFolderId = folder.parent_id;
        } else {
          if (folder.land_id) {
            await supabase.from("lands").update({ is_active: true }).eq("id", folder.land_id);
          }
          break;
        }
      }

    } else if (type === "production_report") {
      await supabase.from("production_reports").update({ is_active: true }).eq("id", id);

    } else if (type === "document") {
      // 1. Restore the document itself
      await supabase.from("documents").update({ is_active: true }).eq("id", id);

      // 2. Ensure its parent folder or parent land is active
      const { data: doc } = await supabase
        .from("documents")
        .select("folder_id, land_id")
        .eq("id", id)
        .single();

      if (doc) {
        if (doc.land_id) {
          await supabase.from("lands").update({ is_active: true }).eq("id", doc.land_id);
        }
        if (doc.folder_id) {
          await supabase.from("folders").update({ is_active: true }).eq("id", doc.folder_id);

          // Recursively restore parent folders
          let currentFolderId: number | null = doc.folder_id;
          while (currentFolderId) {
            const { data: folder } = await supabase
              .from("folders")
              .select("parent_id, land_id")
              .eq("id", currentFolderId)
              .single();

            if (!folder) break;

            if (folder.parent_id) {
              await supabase.from("folders").update({ is_active: true }).eq("id", folder.parent_id);
              currentFolderId = folder.parent_id;
            } else {
              if (folder.land_id) {
                await supabase.from("lands").update({ is_active: true }).eq("id", folder.land_id);
              }
              break;
            }
          }
        }
      }
    } else {
      return NextResponse.json({ error: "Invalid type specified" }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Item berhasil dipulihkan." });
  } catch (error) {
    console.error("Recycle Bin restore error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
