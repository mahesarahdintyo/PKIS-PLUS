// lib/supabase/server.ts
// ============================================================
// COMPATIBILITY SHIM — Supabase Client → Prisma Client
// Mengemulasi pola query Supabase (.from().select().eq() dll)
// di atas Prisma + custom session auth.
// ============================================================

import { getCurrentUserProfile } from "@/lib/services/auth-server";
import { prisma } from "@/lib/prisma";

// Re-export getCurrentUserProfile agar kode yang import dari sini masih jalan
export { getCurrentUserProfile };

// Supabase-like query builder wrapper (untuk backward compat sementara)
// Gunakan ini selama migrasi bertahap.
export async function createClient() {
  return createSupabaseLikeClient();
}

function createSupabaseLikeClient() {
  return {
    auth: {
      async getUser() {
        const { user, role, lineId } = await getCurrentUserProfile();
        if (!user) return { data: { user: null }, error: null };
        return {
          data: {
            user: {
              id: user.id,
              email: user.email,
              user_metadata: { role, line_id: lineId },
              app_metadata: { role },
            },
          },
          error: null,
        };
      },
      async getSession() {
        const { user, role } = await getCurrentUserProfile();
        if (!user) return { data: { session: null }, error: null };
        return {
          data: {
            session: { user: { id: user.id, email: user.email, user_metadata: { role } } },
          },
          error: null,
        };
      },
    },
    from(table: string) {
      return new SupabaseLikeQuery(table);
    },
    rpc(fn: string, args?: Record<string, any>) {
      // RPC functions diimplementasikan sebagai raw SQL via Prisma.$queryRaw
      return {
        async then(resolve: (v: any) => any) {
          try {
            const result = await callRpc(fn, args);
            return resolve({ data: result, error: null });
          } catch (e: any) {
            return resolve({ data: null, error: { message: e.message } });
          }
        },
      };
    },
    storage: {
      from(bucket: string) {
        return {
          async getPublicUrl(path: string) {
            const baseUrl = process.env.NEXT_PUBLIC_STORAGE_URL || "/uploads";
            return { data: { publicUrl: `${baseUrl}/${bucket}/${path}` } };
          },
          async upload(path: string, file: any) {
            return { data: { path }, error: null };
          },
          async remove(paths: string[]) {
            return { data: paths, error: null };
          },
          async download(path: string) {
            try {
              const fs = await import("fs/promises");
              const p = await import("path");
              const fullPath = p.join(process.cwd(), "public", "uploads", path);
              const buffer = await fs.readFile(fullPath);
              return { data: new Blob([buffer]), error: null };
            } catch (err: any) {
              return { data: null, error: { message: err.message } };
            }
          },
          async list(folderPath?: string) {
            try {
              const fs = await import("fs/promises");
              const p = await import("path");
              const dir = p.join(process.cwd(), "public", "uploads", folderPath || "");
              const files = await fs.readdir(dir).catch(() => []);
              return { data: files.map((name: string) => ({ name })), error: null };
            } catch (err: any) {
              return { data: [], error: null };
            }
          },
        };
      },
    },
    functions: {
      async invoke(name: string, options?: any) {
        return { data: null, error: null };
      },
    },
    channel(name: string) {
      return { on: () => ({ subscribe: () => {} }) };
    },
    removeChannel() {},
  };
}

// ─── Supabase-like Query Builder ─────────────────────────────────────────────

export class SupabaseLikeQuery {
  private _table: string;
  private _select: string = "*";
  private _filters: { field: string; op: string; value: any }[] = [];
  private _orderField: string | null = null;
  private _orderAsc: boolean = true;
  private _limitNum: number | null = null;
  private _insertData: any = null;
  private _updateData: any = null;
  private _upsertData: any = null;
  private _upsertConflict: string | null = null;
  private _isDelete: boolean = false;
  private _inFilters: { field: string; values: any[] }[] = [];
  private _orFilters: string[] = [];
  private _gteFilters: { field: string; value: any }[] = [];
  private _lteFilters: { field: string; value: any }[] = [];
  private _ltFilters: { field: string; value: any }[] = [];
  private _gtFilters: { field: string; value: any }[] = [];
  private _ilikeFilters: { field: string; value: string }[] = [];
  private _neqFilters: { field: string; value: any }[] = [];
  private _isFilters: { field: string; value: any }[] = [];
  private _isSingle: boolean = false;
  private _isMaybeSingle: boolean = false;

  constructor(table: string) {
    this._table = table;
  }

  select(cols: string = "*") {
    this._select = cols;
    return this;
  }
  insert(data: any) {
    this._insertData = data;
    return this;
  }
  update(data: any) {
    this._updateData = data;
    return this;
  }
  upsert(data: any, options?: { onConflict?: string }) {
    this._upsertData = data;
    this._upsertConflict = options?.onConflict ?? null;
    return this;
  }
  delete(opts?: any) {
    this._isDelete = true;
    return this;
  }
  eq(field: string, value: any) {
    this._filters.push({ field, op: "eq", value });
    return this;
  }
  neq(field: string, value: any) {
    this._neqFilters.push({ field, value });
    return this;
  }
  in(field: string, values: any[]) {
    this._inFilters.push({ field, values });
    return this;
  }
  or(filter: string) {
    this._orFilters.push(filter);
    return this;
  }
  gte(field: string, value: any) {
    this._gteFilters.push({ field, value });
    return this;
  }
  lte(field: string, value: any) {
    this._lteFilters.push({ field, value });
    return this;
  }
  lt(field: string, value: any) {
    this._ltFilters.push({ field, value });
    return this;
  }
  gt(field: string, value: any) {
    this._gtFilters.push({ field, value });
    return this;
  }
  is(field: string, value: any) {
    this._isFilters.push({ field, value });
    return this;
  }
  not(field: string, op: string, value: any) {
    this._neqFilters.push({ field, value });
    return this;
  }
  ilike(field: string, value: string) {
    this._ilikeFilters.push({ field, value });
    return this;
  }
  order(field: string, options?: { ascending?: boolean; nullsFirst?: boolean }) {
    this._orderField = field;
    this._orderAsc = options?.ascending !== false;
    return this;
  }
  limit(n: number) {
    this._limitNum = n;
    return this;
  }
  range(from: number, to: number) {
    this._limitNum = to - from + 1;
    return this;
  }
  single() {
    this._isSingle = true;
    return this.execute();
  }
  maybeSingle() {
    this._isMaybeSingle = true;
    return this.execute();
  }

  // Allow await on the query builder directly
  then(resolve: (v: any) => any, reject?: (e: any) => any) {
    return this.execute().then(resolve, reject);
  }

  private async execute(): Promise<{ data: any; error: any; count?: number | null }> {
    try {
      const model = getModel(this._table);
      if (!model) {
        return { data: null, error: { message: `Table ${this._table} not found in Prisma` } };
      }

      // Build Prisma where clause
      const where = buildWhere(
        this._filters,
        this._inFilters,
        this._orFilters,
        this._gteFilters,
        this._lteFilters,
        this._ltFilters,
        this._gtFilters,
        this._ilikeFilters,
        this._neqFilters,
        this._isFilters,
        this._table
      );

      // DELETE
      if (this._isDelete) {
        const res = await (model as any).deleteMany({ where });
        return { data: null, count: res?.count ?? 0, error: null };
      }

      // INSERT
      if (this._insertData !== null) {
        const isArray = Array.isArray(this._insertData);
        if (isArray) {
          const result = await (model as any).createMany({ data: this._insertData, skipDuplicates: true });
          return { data: result, error: null };
        } else {
          const result = await (model as any).create({ data: this._insertData });
          return { data: result, error: null };
        }
      }

      // UPDATE
      if (this._updateData !== null) {
        if (this._isSingle || (this._filters.length > 0 && this._filters.some(f => f.field === "id"))) {
          const result = await (model as any).update({ where, data: this._updateData });
          return { data: result, error: null };
        }
        const result = await (model as any).updateMany({ where, data: this._updateData });
        return { data: result, error: null };
      }

      // UPSERT
      if (this._upsertData !== null) {
        const conflictField = this._upsertConflict?.split(",")[0]?.trim() || "id";
        const conflictValue = this._upsertData[conflictField];
        try {
          if (conflictValue !== undefined) {
            const result = await (model as any).upsert({
              where: { [conflictField]: conflictValue },
              create: this._upsertData,
              update: this._upsertData,
            });
            return { data: result, error: null };
          }
        } catch {}
        const result = await (model as any).create({ data: this._upsertData });
        return { data: result, error: null };
      }

      // SELECT
      const findOptions: any = { where };

      if (this._orderField) {
        findOptions.orderBy = { [this._orderField]: this._orderAsc ? "asc" : "desc" };
      }
      if (this._limitNum) findOptions.take = this._limitNum;

      // Handle joins (e.g. "line_id, folders ( line_id )")
      const includeRelation = parseSelectForIncludes(this._select, this._table);
      if (includeRelation) findOptions.include = includeRelation;

      if (this._isSingle || this._isMaybeSingle) {
        const result = await (model as any).findFirst(findOptions);
        return { data: result, error: null };
      }

      const results = await (model as any).findMany(findOptions);
      return { data: results, error: null };
    } catch (e: any) {
      return { data: null, error: { message: e.message || String(e) } };
    }
  }
}

// ─── Table → Prisma Model Mapping ─────────────────────────────────────────────

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
    prod_kode_counter: prisma.prodKodeCounter,
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

// ─── Where Clause Builder ─────────────────────────────────────────────────────

function buildWhere(
  filters: { field: string; op: string; value: any }[],
  inFilters: { field: string; values: any[] }[],
  orFilters: string[],
  gteFilters: { field: string; value: any }[],
  lteFilters: { field: string; value: any }[],
  ltFilters: { field: string; value: any }[],
  gtFilters: { field: string; value: any }[],
  ilikeFilters: { field: string; value: string }[],
  neqFilters: { field: string; value: any }[],
  isFilters: { field: string; value: any }[],
  table: string
) {
  const where: any = {};

  for (const f of filters) {
    if (f.value === null) {
      where[f.field] = null;
    } else if (f.value === true || f.value === false) {
      where[f.field] = f.value;
    } else {
      where[f.field] = f.value;
    }
  }

  for (const f of isFilters) {
    where[f.field] = f.value;
  }

  for (const f of inFilters) {
    where[f.field] = { in: f.values };
  }

  for (const f of gteFilters) {
    where[f.field] = { ...where[f.field], gte: f.value };
  }

  for (const f of lteFilters) {
    where[f.field] = { ...where[f.field], lte: f.value };
  }

  for (const f of ltFilters) {
    where[f.field] = { ...where[f.field], lt: f.value };
  }

  for (const f of gtFilters) {
    where[f.field] = { ...where[f.field], gt: f.value };
  }

  for (const f of ilikeFilters) {
    where[f.field] = { contains: f.value.replace(/%/g, ""), mode: "insensitive" };
  }

  for (const f of neqFilters) {
    where[f.field] = { not: f.value };
  }

  // OR filters: parse basic supabase OR syntax
  if (orFilters.length > 0) {
    const orClauses: any[] = [];
    for (const orStr of orFilters) {
      // e.g. "is_active.eq.true,is_active.is.null" or "line_id.eq.abc,mesin.eq.xyz"
      const parts = orStr.split(",");
      for (const part of parts) {
        const segs = part.trim().split(".");
        if (segs.length >= 3) {
          const field = segs[0];
          const op = segs[1];
          const val = segs.slice(2).join(".");
          if (op === "eq") orClauses.push({ [field]: val === "true" ? true : val === "false" ? false : val });
          else if (op === "is" && val === "null") orClauses.push({ [field]: null });
          else if (op === "in") {
            const vals = val.replace(/[()]/g, "").split(",");
            orClauses.push({ [field]: { in: vals } });
          }
        }
      }
    }
    if (orClauses.length > 0) where.OR = orClauses;
  }

  return where;
}

// ─── Select Parser for Relations ─────────────────────────────────────────────

function parseSelectForIncludes(select: string, table: string): any {
  if (!select.includes("(")) return null;
  // e.g. "line_id, folders ( line_id )" → include: { folder: true }
  const relationMap: Record<string, Record<string, string>> = {
    documents: { folders: "folder" },
  };
  const tableMap = relationMap[table];
  if (!tableMap) return null;

  const include: any = {};
  for (const [supaRel, prismaRel] of Object.entries(tableMap)) {
    if (select.includes(supaRel)) {
      include[prismaRel] = true;
    }
  }
  return Object.keys(include).length > 0 ? include : null;
}

// ─── RPC Functions ────────────────────────────────────────────────────────────

async function callRpc(fn: string, args?: Record<string, any>): Promise<any> {
  // RPC functions yang dipakai di production akan diimplementasikan sebagai raw SQL
  // Untuk sekarang return null sebagai fallback
  console.warn(`[Prisma Shim] RPC '${fn}' dipanggil tapi belum diimplementasikan. Pakai raw query.`);
  return null;
}
