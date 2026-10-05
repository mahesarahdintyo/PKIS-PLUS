// app/api/db/rpc/route.ts
// Handler untuk PostgreSQL Stored Functions (RPC) yang sebelumnya dipanggil via supabase.rpc()

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { fn, args } = await request.json();

    if (!fn) {
      return NextResponse.json({ error: "Missing function name" }, { status: 400 });
    }

    // Bangun pemanggilan SQL Stored Procedure/Function
    // Contoh args: { p_mesin: 'line_1', p_start: '2026-01-01', p_limit: 5 }
    const argKeys = args ? Object.keys(args) : [];
    
    if (argKeys.length === 0) {
      // Pemanggilan tanpa argumen: SELECT * FROM fn()
      const result = await prisma.$queryRawUnsafe(`SELECT * FROM ${fn}()`);
      return NextResponse.json({ data: result, error: null });
    }

    // Bangun named parameters atau positional arguments untuk Postgres function
    // Di Postgres: SELECT * FROM fn(p_mesin => 'val', p_start => 'val')
    const paramAssignments = argKeys.map((key) => {
      const val = args[key];
      if (val === null || val === undefined) {
        return `"${key}" => NULL`;
      }
      if (typeof val === "number" || typeof val === "boolean") {
        return `"${key}" => ${val}`;
      }
      if (Array.isArray(val)) {
        // Postgres array syntax, e.g. ARRAY['a', 'b']
        const elements = val.map((v) => `'${String(v).replace(/'/g, "''")}'`).join(", ");
        return `"${key}" => ARRAY[${elements}]`;
      }
      // String or date
      const escaped = String(val).replace(/'/g, "''");
      return `"${key}" => '${escaped}'`;
    });

    const query = `SELECT * FROM "${fn}"(${paramAssignments.join(", ")})`;

    try {
      const result = await prisma.$queryRawUnsafe(query);
      return NextResponse.json({ data: result, error: null });
    } catch (sqlError: any) {
      // Jika function mengembalikan scalar tunggal atau struktur lain
      try {
        const scalarQuery = `SELECT "${fn}"(${paramAssignments.join(", ")})`;
        const scalarResult = await prisma.$queryRawUnsafe(scalarQuery);
        return NextResponse.json({ data: scalarResult, error: null });
      } catch {
        console.error(`[RPC Error: ${fn}]:`, sqlError?.message || sqlError);
        return NextResponse.json(
          { data: null, error: { message: sqlError?.message || "Failed to execute RPC" } },
          { status: 500 }
        );
      }
    }
  } catch (error: any) {
    console.error("[RPC Handler Error]:", error);
    return NextResponse.json(
      { data: null, error: { message: error.message } },
      { status: 500 }
    );
  }
}
