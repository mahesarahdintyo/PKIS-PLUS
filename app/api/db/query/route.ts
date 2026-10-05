// app/api/db/query/route.ts
// Generic database query endpoint — dipakai oleh lib/supabase/client.ts browser shim.
// POST body: { table, select, filters, inFilters, order, limit, single }

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserProfile } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { table, filters = [], inFilters = [], order, limit, single, orFilters = [] } = body;

    const model = getModel(table);
    if (!model) {
      return NextResponse.json({ error: `Table '${table}' tidak dikenali` }, { status: 400 });
    }

    const where = buildWhere(filters, inFilters, orFilters);
    const findOptions: any = { where };

    if (order) {
      findOptions.orderBy = { [order.field]: order.asc ? "asc" : "desc" };
    }
    if (limit) findOptions.take = limit;

    if (single) {
      const result = await (model as any).findFirst(findOptions);
      return NextResponse.json({ data: result });
    }

    const results = await (model as any).findMany(findOptions);
    return NextResponse.json({ data: results });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function getModel(table: string) {
  const map: Record<string, any> = {
    lines: prisma.line,
    folders: prisma.folder,
    documents: prisma.document,
    categories: prisma.category,
    display_documents: prisma.displayDocument,
    display_heartbeats: prisma.displayHeartbeat,
    production_reports: prisma.productionReport,
    part_numbers: prisma.partNumber,
    profiles: prisma.profile,
    andon_calls: prisma.andonCall,
    andon_leaders: prisma.andonLeader,
    push_subscriptions: prisma.pushSubscription,
    prod_production_log: prisma.prodProductionLog,
    prod_downtime_log: prisma.prodDowntimeLog,
    prod_part_numbers: prisma.prodPartNumber,
    prod_downtime_problems: prisma.prodDowntimeProblem,
    prod_dandori_log: prisma.prodDandoriLog,
    prod_production_planning: prisma.prodProductionPlanning,
    prod_nonproduksi_types: prisma.prodNonproduksiType,
    prod_mesin_settings: prisma.prodMesinSettings,
    prod_attendance_log: prisma.prodAttendanceLog,
    prod_safety_log: prisma.prodSafetyLog,
    prod_scrap_top_end: prisma.prodScrapTopEnd,
    productivity_daily_reference: prisma.productivityDailyReference,
    prod_line_settings: prisma.prodLineSettings,
  };
  return map[table] ?? null;
}

export function buildWhere(
  filters: [string, any][],
  inFilters: [string, any[]][],
  orFilters: string[] = []
) {
  const where: any = {};

  for (const [field, value] of filters) {
    if (field === "__or__") continue;
    if (field.startsWith("neq_")) {
      where[field.slice(4)] = { not: value };
    } else if (field.startsWith("gte_")) {
      where[field.slice(4)] = { ...where[field.slice(4)], gte: value };
    } else if (field.startsWith("lt_")) {
      where[field.slice(3)] = { ...where[field.slice(3)], lt: value };
    } else if (field.startsWith("ilike_")) {
      where[field.slice(6)] = { contains: value.replace(/%/g, ""), mode: "insensitive" };
    } else {
      where[field] = value;
    }
  }

  for (const [field, values] of inFilters) {
    where[field] = { in: values };
  }

  // OR filters from filter array
  const orString = filters.find(([f]) => f === "__or__")?.[1];
  if (orString) orFilters = [...orFilters, orString];

  if (orFilters.length > 0) {
    const orClauses: any[] = [];
    for (const orStr of orFilters) {
      const parts = orStr.split(",");
      for (const part of parts) {
        const segs = part.trim().split(".");
        if (segs.length >= 3) {
          const field = segs[0];
          const op = segs[1];
          const val = segs.slice(2).join(".");
          if (op === "eq") orClauses.push({ [field]: val === "true" ? true : val === "false" ? false : val });
          else if (op === "is" && val === "null") orClauses.push({ [field]: null });
        }
      }
    }
    if (orClauses.length > 0) where.OR = orClauses;
  }

  return where;
}
