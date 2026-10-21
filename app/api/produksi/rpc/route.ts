// app/api/produksi/rpc/route.ts
// Handler untuk PostgreSQL Stored Functions produksi (prod_*).
// POST body: { fn: string, args: Record<string, any> }

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Prisma $queryRawUnsafe mengembalikan kolom PostgreSQL `numeric` sebagai Prisma Decimal,
 * dan kolom `bigint` sebagai JS BigInt. Keduanya tidak bisa JSON.stringify secara langsung
 * dan menyebabkan Number() menghasilkan nilai aneh (e.g. 777,777,777,...).
 * Fungsi ini mengkonversi semua nilai ke tipe JS primitive yang aman.
 */
function serializeRpcResult(rows: any[]): any[] {
  return rows.map((row) => {
    const out: Record<string, any> = {};
    for (const key of Object.keys(row)) {
      const val = row[key];
      if (val === null || val === undefined) {
        out[key] = null;
      } else if (typeof val === "bigint") {
        out[key] = Number(val);
      } else if (
        typeof val === "object" &&
        typeof (val as any).toFixed === "function"
      ) {
        // Prisma Decimal → konversi ke number via string untuk presisi aman
        out[key] = parseFloat((val as any).toString());
      } else {
        out[key] = val;
      }
    }
    return out;
  });
}

// Whitelist fungsi yang boleh dipanggil
const ALLOWED_FUNCTIONS = new Set([
  "prod_performance_aggregate",
  "prod_downtime_top_problems",
  "prod_downtime_by_category",
  "prod_gsph_trend_bucketed",
  "prod_gsph_hourly",
  "prod_downtime_trend_bucketed",
  "prod_productivity_trend_bucketed",
  "prod_safety_summary",
  "prod_attendance_summary",
  "prod_scrap_top_end_summary",
  "prod_achievement_aggregate",
]);

export async function POST(request: Request) {
  try {
    const { fn, args } = await request.json();

    if (!fn) {
      return NextResponse.json({ error: "Missing function name" }, { status: 400 });
    }

    if (!ALLOWED_FUNCTIONS.has(fn)) {
      return NextResponse.json(
        { error: `Function '${fn}' tidak diizinkan` },
        { status: 403 }
      );
    }

    const argKeys = args ? Object.keys(args) : [];

    if (argKeys.length === 0) {
      const rawResult = await prisma.$queryRawUnsafe(`SELECT * FROM "${fn}"()`);
      const result = Array.isArray(rawResult) ? serializeRpcResult(rawResult) : rawResult;
      return NextResponse.json({ data: result, error: null });
    }

    const paramAssignments = argKeys.map((key) => {
      const val = args[key];
      if (val === null || val === undefined) {
        return `"${key}" => NULL`;
      }
      if (typeof val === "number" || typeof val === "boolean") {
        return `"${key}" => ${val}`;
      }
      if (Array.isArray(val)) {
        const elements = val.map((v) => `'${String(v).replace(/'/g, "''")}'`).join(", ");
        return `"${key}" => ARRAY[${elements}]`;
      }
      const escaped = String(val).replace(/'/g, "''");
      return `"${key}" => '${escaped}'`;
    });

    const query = `SELECT * FROM "${fn}"(${paramAssignments.join(", ")})`;

    try {
      const rawResult = await prisma.$queryRawUnsafe(query);
      const result = Array.isArray(rawResult) ? serializeRpcResult(rawResult) : rawResult;
      return NextResponse.json({ data: result, error: null });
    } catch (sqlError: any) {
      console.error(`[RPC Error: ${fn}]:`, sqlError?.message || sqlError);
      return NextResponse.json(
        { data: null, error: { message: sqlError?.message || "Failed to execute RPC" } },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("[RPC Handler Error]:", error);
    return NextResponse.json(
      { data: null, error: { message: error.message } },
      { status: 500 }
    );
  }
}
