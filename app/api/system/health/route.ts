import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

const DISPLAY_ONLINE_THRESHOLD_MS = 20_000;
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "v1.0.0";

interface LineRow {
  id: string;
  name: string;
}

interface HeartbeatRow {
  line_id: string;
  last_seen_at: string;
}

declare global {
  // eslint-disable-next-line no-var
  var futabaDisplayHeartbeatsByLine: Record<string, string> | undefined;
}

function isOnline(lastSeenAt?: string) {
  if (!lastSeenAt) return false;

  const lastSeenTime = new Date(lastSeenAt).getTime();
  if (Number.isNaN(lastSeenTime)) return false;

  return Date.now() - lastSeenTime <= DISPLAY_ONLINE_THRESHOLD_MS;
}

export async function GET() {
  const checkedAt = new Date().toISOString();
  let databaseConnected = false;
  let dbErrorMsg: string | null = null;
  let storageConnected = false;
  let storageErrorMsg: string | null = null;
  let lines: LineRow[] = [];
  let heartbeats: HeartbeatRow[] = [];

  // Check Database
  try {
    const lineData = await prisma.line.findMany({
      where: { is_active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    databaseConnected = true;
    lines = lineData;
  } catch (err: any) {
    dbErrorMsg = err?.message || "Failed to query database";
  }

  // Check Storage
  try {
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.access(uploadDir);
    storageConnected = true;
  } catch (err: any) {
    storageErrorMsg = err?.message || "Failed to access storage directory";
  }

  if (databaseConnected) {
    try {
      const hbData = await prisma.displayHeartbeat.findMany({
        select: { line_id: true, last_seen: true },
      });
      heartbeats = hbData.map((h) => ({
        line_id: h.line_id,
        last_seen_at: h.last_seen.toISOString(),
      }));
    } catch (err) {
      console.error("System health heartbeat error:", err);
    }
  }

  const memoryHeartbeats = globalThis.futabaDisplayHeartbeatsByLine ?? {};
  const heartbeatByLine = new Map<string, string>();

  for (const heartbeat of heartbeats) {
    heartbeatByLine.set(heartbeat.line_id, heartbeat.last_seen_at);
  }

  for (const [lineId, lastSeenAt] of Object.entries(memoryHeartbeats)) {
    if (!heartbeatByLine.has(lineId)) {
      heartbeatByLine.set(lineId, lastSeenAt);
    }
  }

  const displays = lines.map((line) => {
    const lastSeenAt = heartbeatByLine.get(line.id);

    return {
      id: line.id,
      name: line.name,
      online: isOnline(lastSeenAt),
      lastSeenAt: lastSeenAt ?? null,
    };
  });

  return NextResponse.json({
    checkedAt,
    version: APP_VERSION,
    database: {
      connected: databaseConnected,
      error: dbErrorMsg,
    },
    storage: {
      connected: storageConnected,
      error: storageErrorMsg,
    },
    displays,
  });
}
