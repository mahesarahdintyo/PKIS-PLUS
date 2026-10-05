// app/api/upload/route.ts
// Upload handler menggunakan Local Storage (public/uploads) + Prisma

import { prisma } from "@/lib/prisma";
import { getCurrentUserProfile } from "@/lib/services/auth-server";
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const ALLOWED_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const ALLOWED_FILE_EXTENSIONS = ["pdf", "jpg", "jpeg", "png"];
const ALLOWED_FILE_FORMAT_LABEL = "PDF, JPG, JPEG, atau PNG";

function isAllowedFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const hasAllowedExtension = ALLOWED_FILE_EXTENSIONS.includes(extension);
  const hasAllowedType = file.type ? ALLOWED_FILE_TYPES.includes(file.type) : true;
  return hasAllowedExtension && hasAllowedType;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;
    const folderId = formData.get("folderId") as string;
    const reqLineId = (formData.get("lineId") ?? formData.get("landId")) as string;
    const targetTime = formData.get("targetTime") as string | null;

    const userProfile = await getCurrentUserProfile();
    if (!userProfile.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const lineId =
      userProfile.role === "operator" && userProfile.lineId
        ? userProfile.lineId
        : reqLineId;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!isAllowedFile(file)) {
      return NextResponse.json(
        {
          error: `Format file tidak diperbolehkan. Upload hanya menerima file ${ALLOWED_FILE_FORMAT_LABEL}.`,
        },
        { status: 400 }
      );
    }

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // Buat direktori upload lokal: public/uploads/documents
    const uploadDir = path.join(process.cwd(), "public", "uploads", "documents");
    await fs.mkdir(uploadDir, { recursive: true });

    // Sanitize file name
    const rawName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const fileName = `${Date.now()}-${rawName}`;
    const destinationPath = path.join(uploadDir, fileName);

    // Tulis buffer file ke disk
    const fileBytes = await file.arrayBuffer();
    await fs.writeFile(destinationPath, Buffer.from(fileBytes));

    const relativePath = `documents/${fileName}`;

    // Simpan metadata dokumen ke database via Prisma
    const doc = await prisma.document.create({
      data: {
        title,
        description: description || null,
        folder_id: folderId ? parseInt(folderId, 10) : null,
        line_id: lineId || null,
        file_name: file.name,
        file_path: relativePath,
        file_size: file.size,
        file_type: file.type || "application/octet-stream",
        target_time: targetTime || null,
      },
    });

    const partNumberId = formData.get("partNumberId") as string | null;
    const newPartNumberValue = formData.get("newPartNumberValue") as string | null;

    if (doc?.id) {
      if (partNumberId) {
        await prisma.prodPartNumber
          .update({
            where: { id: partNumberId },
            data: { document_id: doc.id },
          })
          .catch((err) =>
            console.error("Gagal menghubungkan dokumen ke part number:", err)
          );
      } else if (newPartNumberValue && newPartNumberValue.trim()) {
        let mesin = "";
        if (lineId) {
          const lineRow = await prisma.line.findUnique({
            where: { id: lineId },
            select: { name: true, machine_type: true },
          });

          if (lineRow) {
            const rawType = (lineRow.machine_type || lineRow.name || "").trim();
            const slug = rawType.toLowerCase();

            const KNOWN_CONFIG_KEYS: Record<string, string> = {
              blanking: "blanking",
              pc200t: "pc200t",
              tandem: "tandem",
              "transfer-2000t": "transfer_2000t",
              "transfer-800t": "transfer_800t",
              transfer_2000t: "transfer_2000t",
              transfer_800t: "transfer_800t",
            };

            if (KNOWN_CONFIG_KEYS[slug]) {
              mesin = KNOWN_CONFIG_KEYS[slug];
            } else {
              const dashed = slug.replace(/_/g, "-");
              mesin = KNOWN_CONFIG_KEYS[dashed] || slug.replace(/-/g, "_");
            }
          }
        }

        await prisma.prodPartNumber
          .create({
            data: {
              line_id: lineId || null,
              mesin: mesin || "default",
              value: newPartNumberValue.trim(),
              document_id: doc.id,
              is_active: true,
            },
          })
          .catch((err) =>
            console.error("Gagal membuat part number baru untuk dokumen:", err)
          );
      }
    }

    return NextResponse.json(
      {
        success: true,
        document: doc,
        message: "Document uploaded successfully",
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Upload handler error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
