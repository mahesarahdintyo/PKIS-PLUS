// app/api/print-file/route.ts
// Menyajikan file dokumen lokal untuk diprint/preview di browser

import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get("filePath");

    if (!filePath) {
      return NextResponse.json(
        { error: "File path is required" },
        { status: 400 }
      );
    }

    // Bersihkan path
    const safePath = filePath.replace(/^[/\\]+/, "").replace(/\.\./g, "");
    const fullPath = path.join(process.cwd(), "public", "uploads", safePath);

    try {
      const fileBuffer = await fs.readFile(fullPath);
      const fileName = path.basename(safePath) || "document";

      // Tebak content-type dari ekstensi
      let contentType = "application/octet-stream";
      if (fileName.endsWith(".pdf")) contentType = "application/pdf";
      else if (fileName.endsWith(".png")) contentType = "image/png";
      else if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg")) contentType = "image/jpeg";

      return new NextResponse(fileBuffer, {
        headers: {
          "Cache-Control": "private, max-age=300",
          "Content-Disposition": `inline; filename="${fileName}"`,
          "Content-Type": contentType,
        },
      });
    } catch {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
  } catch (error: any) {
    console.error("Print file handler error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
