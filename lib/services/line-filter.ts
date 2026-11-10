import { prisma } from "@/lib/prisma";

export interface LineItem {
  id: string;
  name: string;
  machine_type?: string | null;
}

let cachedLines: { data: LineItem[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 30000; // 30 seconds cache

/**
 * Fetch active lines with short in-memory cache to prevent duplicate queries
 */
export async function getCachedLines(): Promise<LineItem[]> {
  const now = Date.now();
  if (cachedLines && now - cachedLines.timestamp < CACHE_TTL_MS) {
    return cachedLines.data;
  }

  try {
    const lines = await prisma.line.findMany({
      where: { OR: [{ is_active: true }, { is_active: null }] },
      select: { id: true, name: true, machine_type: true },
      orderBy: { name: "asc" },
    });
    cachedLines = { data: lines, timestamp: now };
    return lines;
  } catch (err) {
    console.error("[getCachedLines] Error:", err);
    return cachedLines?.data || [];
  }
}

/**
 * Build Prisma OR conditions for line and machine filtering.
 * Supports: line UUID, machine_type slug, or machine name text.
 * Matches rows whether they have `line_id` set, or only `mesin` populated.
 */
export function buildLineFilterConditions(
  lineIdOrMesin: string | null | undefined,
  allLines: LineItem[]
): any[] | null {
  if (!lineIdOrMesin || lineIdOrMesin === "all" || lineIdOrMesin === "undefined") {
    return null;
  }

  const raw = lineIdOrMesin.trim();
  const rawLower = raw.toLowerCase();

  // Find line by id, machine_type, or name
  const targetLine = allLines.find(
    (l) =>
      l.id === raw ||
      (l.machine_type && l.machine_type.toLowerCase() === rawLower) ||
      l.name.toLowerCase() === rawLower
  );

  const matchedLineId = targetLine?.id || (raw.length === 36 ? raw : undefined);
  const lineNameLower = (targetLine?.name || raw).toLowerCase();
  const machineTypeLower = (targetLine?.machine_type || raw).toLowerCase();

  // Check which machine category this represents
  const isTandem =
    lineNameLower.includes("tandem") ||
    machineTypeLower.includes("tandem") ||
    lineNameLower.includes("tdm") ||
    machineTypeLower.includes("tdm");

  const isBlanking =
    lineNameLower.includes("blank") || machineTypeLower.includes("blank");

  const isTr2000 =
    lineNameLower.includes("2000") ||
    machineTypeLower.includes("2000") ||
    lineNameLower === "tr2" ||
    machineTypeLower === "tr2";

  const isTr800 =
    lineNameLower.includes("800") ||
    machineTypeLower.includes("800") ||
    lineNameLower === "tr8" ||
    machineTypeLower === "tr8";

  const isPc200 =
    ((lineNameLower.includes("200") && !isTr2000) ||
      (machineTypeLower.includes("200") && !isTr2000) ||
      lineNameLower === "pc2" ||
      machineTypeLower === "pc2") &&
    !isTr2000;

  const orConditions: any[] = [];

  if (matchedLineId) {
    orConditions.push({ line_id: matchedLineId });
  }

  if (isTandem) {
    orConditions.push(
      { mesin: { contains: "tandem", mode: "insensitive" } },
      { mesin: { contains: "tdm", mode: "insensitive" } }
    );
  } else if (isBlanking) {
    orConditions.push(
      { mesin: { contains: "blank", mode: "insensitive" } },
      { mesin: { equals: "blk", mode: "insensitive" } }
    );
  } else if (isTr2000) {
    orConditions.push(
      { mesin: { contains: "2000", mode: "insensitive" } },
      { mesin: { equals: "tr2", mode: "insensitive" } }
    );
  } else if (isTr800) {
    orConditions.push(
      { mesin: { contains: "800", mode: "insensitive" } },
      { mesin: { equals: "tr8", mode: "insensitive" } }
    );
  } else if (isPc200) {
    orConditions.push(
      {
        AND: [
          { mesin: { contains: "200", mode: "insensitive" } },
          { NOT: { mesin: { contains: "2000", mode: "insensitive" } } },
        ],
      },
      { mesin: { equals: "pc2", mode: "insensitive" } }
    );
  } else {
    // Custom / generic line
    if (targetLine?.name) {
      orConditions.push({ mesin: { contains: targetLine.name, mode: "insensitive" } });
    }
    if (targetLine?.machine_type) {
      orConditions.push({ mesin: { contains: targetLine.machine_type, mode: "insensitive" } });
      const slugUnderscore = targetLine.machine_type.replace(/-/g, "_");
      const slugHyphen = targetLine.machine_type.replace(/_/g, "-");
      if (slugUnderscore !== targetLine.machine_type) {
        orConditions.push({ mesin: { contains: slugUnderscore, mode: "insensitive" } });
      }
      if (slugHyphen !== targetLine.machine_type) {
        orConditions.push({ mesin: { contains: slugHyphen, mode: "insensitive" } });
      }
    }
    // Also match the raw param itself
    orConditions.push({ mesin: { equals: raw, mode: "insensitive" } });
  }

  return orConditions;
}

/**
 * Resolve display line name and canonical line_id from a row's line_id and mesin.
 * Never returns null name or "Unknown Line" when the machine is recognizable.
 */
export function resolveLineInfo(
  row: { line_id?: string | null; mesin?: string | null },
  lines: LineItem[]
): { line_id: string | null; line_name: string } {
  // 1. Direct match by row.line_id
  if (row.line_id) {
    const matched = lines.find((l) => l.id === row.line_id);
    if (matched) {
      return { line_id: matched.id, line_name: matched.name };
    }
  }

  // 2. Fallback: Match by row.mesin text
  const mesin = (row.mesin || "").trim();
  const mesinLower = mesin.toLowerCase();

  if (mesinLower.includes("tandem") || mesinLower.includes("tdm")) {
    const matched = lines.find(
      (l) =>
        l.name.toLowerCase().includes("tandem") ||
        (l.machine_type && l.machine_type.toLowerCase().includes("tandem"))
    );
    return { line_id: matched?.id || row.line_id || null, line_name: matched?.name || "Tandem" };
  }

  if (mesinLower.includes("blank") || mesinLower === "blk") {
    const matched = lines.find(
      (l) =>
        l.name.toLowerCase().includes("blank") ||
        (l.machine_type && l.machine_type.toLowerCase().includes("blank"))
    );
    return { line_id: matched?.id || row.line_id || null, line_name: matched?.name || "Blanking" };
  }

  if (mesinLower.includes("2000") || mesinLower === "tr2") {
    const matched = lines.find(
      (l) =>
        l.name.toLowerCase().includes("2000") ||
        (l.machine_type && l.machine_type.toLowerCase().includes("2000"))
    );
    return { line_id: matched?.id || row.line_id || null, line_name: matched?.name || "Transfer 2000T" };
  }

  if (mesinLower.includes("800") || mesinLower === "tr8") {
    const matched = lines.find(
      (l) =>
        l.name.toLowerCase().includes("800") ||
        (l.machine_type && l.machine_type.toLowerCase().includes("800"))
    );
    return { line_id: matched?.id || row.line_id || null, line_name: matched?.name || "Transfer 800T" };
  }

  if (
    (mesinLower.includes("200") && !mesinLower.includes("2000")) ||
    mesinLower === "pc2"
  ) {
    const matched = lines.find(
      (l) =>
        (l.name.toLowerCase().includes("200") && !l.name.toLowerCase().includes("2000")) ||
        (l.machine_type &&
          l.machine_type.toLowerCase().includes("200") &&
          !l.machine_type.toLowerCase().includes("2000"))
    );
    return { line_id: matched?.id || row.line_id || null, line_name: matched?.name || "PC200T" };
  }

  // 3. Match any line with machine_type or name
  if (mesin) {
    const matched = lines.find(
      (l) =>
        (l.machine_type && l.machine_type.toLowerCase() === mesinLower) ||
        l.name.toLowerCase() === mesinLower
    );
    if (matched) {
      return { line_id: matched.id, line_name: matched.name };
    }
  }

  return {
    line_id: row.line_id || null,
    line_name: mesin || "Unknown Line",
  };
}

