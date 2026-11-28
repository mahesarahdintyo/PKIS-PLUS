// app/api/download/route.ts
// Download handler untuk file lokal

import { NextResponse } from "next/server";

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

    // Bersihkan path dari traversal dan hindari duplikasi prefix uploads/
    const safePath = filePath.replace(/^[/\\]+/, "").replace(/\.\./g, "");
    const cleanPath = safePath.toLowerCase().startsWith("uploads/") ? safePath.slice(8) : safePath;
    const publicUrl = `/uploads/${cleanPath}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
    });
  } catch (error: any) {
    console.error("Download handler error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
