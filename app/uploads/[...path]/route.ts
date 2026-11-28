// app/uploads/[...path]/route.ts
// Handler untuk menyajikan file upload lokal secara aman & handal

import fs from "fs";
import path from "path";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;
    const relativePath = pathSegments.join("/");
    const safePath = relativePath.replace(/\.\./g, "");

    const candidatePaths = [
      path.join(process.cwd(), "public", "uploads", safePath),
      path.join(process.cwd(), "public", safePath),
      path.join(process.cwd(), "public", "uploads", "documents", path.basename(safePath)),
      path.join(process.cwd(), "public", "uploads", path.basename(safePath)),
    ];

    const diskPath = candidatePaths.find((p) => fs.existsSync(p));

    if (!diskPath) {
      const fileName = path.basename(safePath);
      // Tampilkan halaman informasi ramah pengguna di dalam iframe jika file belum di-upload
      const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>File Dokumen Belum Tersedia</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #090d16;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      padding: 16px;
      box-sizing: border-box;
    }
    .card {
      background: rgba(30, 41, 59, 0.85);
      border: 1px solid rgba(245, 158, 11, 0.4);
      border-radius: 16px;
      padding: 36px 28px;
      max-width: 460px;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(12px);
    }
    .icon { font-size: 42px; margin-bottom: 12px; }
    h2 { font-size: 18px; font-weight: 700; color: #fbbf24; margin: 0 0 10px; }
    p { font-size: 13px; color: #cbd5e1; line-height: 1.6; margin: 0 0 16px; }
    .hint { font-size: 11px; color: #94a3b8; margin: 0; }
    code { background: rgba(0, 0, 0, 0.4); padding: 2px 6px; border-radius: 4px; font-size: 11px; color: #38bdf8; font-family: monospace; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">⚠️</div>
    <h2>File Fisik Dokumen Belum Tersedia</h2>
    <p>Dokumen <strong>${fileName}</strong> telah terpilih untuk ditampilkan, namun file fisiknya belum tersimpan di folder <code>public/uploads/</code> pada server/laptop ini.</p>
    <p class="hint">Silakan unggah file dokumen kerja melalui menu <strong>Dokumen</strong> pada halaman Operator untuk menampilkannya di layar TV ini.</p>
  </div>
</body>
</html>`;
      return new Response(html, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const ext = path.extname(diskPath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".pdf": "application/pdf",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".png": "image/png",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".svg": "image/svg+xml",
      ".mp4": "video/mp4",
      ".mov": "video/quicktime",
      ".webm": "video/webm",
    };
    const contentType = mimeTypes[ext] || "application/octet-stream";

    const fileBuffer = fs.readFileSync(diskPath);
    return new Response(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": fileBuffer.length.toString(),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err: any) {
    console.error("Error serving upload file:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
