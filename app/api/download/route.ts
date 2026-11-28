// app/api/download/route.ts
// Download handler untuk file dokumen lokal & remote

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { filePath } = body;

    if (!filePath) {
      return NextResponse.json(
        { error: "File path is required" },
        { status: 400 }
      );
    }

    // Jika filePath berupa URL remote (http/https)
    if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
      return NextResponse.json({
        success: true,
        url: filePath,
        exists: true,
      });
    }

    // Bersihkan path dari traversal dan hindari duplikasi prefix uploads/
    const safePath = filePath.replace(/^[/\\]+/, "").replace(/\.\./g, "");
    const cleanPath = safePath.toLowerCase().startsWith("uploads/") ? safePath.slice(8) : safePath;

    // Lokasi pencarian file fisik di server lokal
    const candidatePaths = [
      path.join(process.cwd(), "public", "uploads", cleanPath),
      path.join(process.cwd(), "public", cleanPath),
      path.join(process.cwd(), "public", "uploads", "documents", path.basename(cleanPath)),
      path.join(process.cwd(), "public", "uploads", path.basename(cleanPath)),
    ];

    const foundPath = candidatePaths.find((p) => fs.existsSync(p));

    if (!foundPath) {
      const fileName = path.basename(filePath);
      console.warn(`[Download] File fisik "${fileName}" tidak ditemukan di folder public/uploads/. Path: ${filePath}`);
      return NextResponse.json(
        {
          error: `File fisik "${fileName}" belum tersedia di folder server lokal (public/uploads/). Silakan unggah file dokumen kembali melalui halaman Operator.`,
          missingFile: true,
          fileName,
          suggestedUrl: `/uploads/${cleanPath}`,
        },
        { status: 404 }
      );
    }

    const publicUrl = `/uploads/${cleanPath}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
      exists: true,
    });
  } catch (error: any) {
    console.error("Download handler error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
