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

    // Bersihkan path dari traversal
    const safePath = filePath.replace(/^[/\\]+/, "").replace(/\.\./g, "");
    const publicUrl = `/uploads/${safePath}`;

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
