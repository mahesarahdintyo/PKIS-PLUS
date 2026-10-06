import { prisma } from "@/lib/prisma";
import { getCurrentUserProfile } from "@/lib/services/auth-server";
import type { Document } from "@/lib/services/document";
import type { Folder } from "@/lib/services/folder";
import type { Line } from "@/lib/services/line";

export async function getInitialLines(): Promise<Line[]> {
  try {
    const lines = await prisma.line.findMany({
      where: {
        hidden_from_operator: false,
        OR: [{ is_active: true }, { is_active: null }],
      },
      orderBy: { name: "asc" },
    });
    return lines as any;
  } catch (error) {
    console.error("Initial lines error:", error);
    return [];
  }
}

export async function getInitialFolders(lineId: string): Promise<Folder[]> {
  const userProfile = await getCurrentUserProfile();
  const effectiveLineId =
    userProfile.role === "operator" && userProfile.lineId
      ? userProfile.lineId
      : lineId;

  try {
    const folders = await prisma.folder.findMany({
      where: {
        line_id: effectiveLineId,
        parent_id: null,
        OR: [{ is_active: true }, { is_active: null }],
      },
      orderBy: { name: "asc" },
    });
    return folders as any;
  } catch (error) {
    console.error("Initial folders error:", error);
    return [];
  }
}

export async function getInitialDocuments(lineId: string): Promise<Document[]> {
  const userProfile = await getCurrentUserProfile();
  const effectiveLineId =
    userProfile.role === "operator" && userProfile.lineId
      ? userProfile.lineId
      : lineId;

  try {
    const docs = await prisma.document.findMany({
      where: {
        folder_id: null,
        line_id: effectiveLineId,
        hidden_from_operator: false,
        OR: [{ is_active: true }, { is_active: null }],
      },
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

    return docs.map((doc: any) => ({
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
      linkedPartNumbers: Array.isArray(doc.prod_part_numbers)
        ? doc.prod_part_numbers.map((p: any) => ({
            id: p.id,
            value: p.value || "-",
          }))
        : [],
    }));
  } catch (error) {
    console.error("Initial documents error:", error);
    return [];
  }
}
