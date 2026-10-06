// app/api/produksi/rpc/route.ts
// Handler untuk PostgreSQL Stored Functions produksi (prod_*).
// POST body: { fn: string, args: Record<string, any> }

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
      const result = await prisma.$queryRawUnsafe(`SELECT * FROM "${fn}"()`);
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
      const result = await prisma.$queryRawUnsafe(query);
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
