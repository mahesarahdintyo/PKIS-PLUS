import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

declare global {
  // eslint-disable-next-line no-var
  var futabaDisplayHeartbeatsByLine: Record<string, string> | undefined;
}

function setMemoryHeartbeat(lineId: string, lastSeenAt: string) {
  globalThis.futabaDisplayHeartbeatsByLine = {
    ...(globalThis.futabaDisplayHeartbeatsByLine ?? {}),
    [lineId]: lastSeenAt,
  };
}

function clearMemoryHeartbeat(lineId: string) {
  const currentHeartbeats = { ...(globalThis.futabaDisplayHeartbeatsByLine ?? {}) };
  delete currentHeartbeats[lineId];
  globalThis.futabaDisplayHeartbeatsByLine = currentHeartbeats;
}

function getLineId(value: unknown) {
  if (!value || typeof value !== "object") return "";

  const body = value as { lineId?: unknown; landId?: unknown };
  const val = body.lineId ?? body.landId;
  return typeof val === "string" ? val.trim() : "";
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const lineId = getLineId(body);

    if (!lineId) {
      return NextResponse.json(
        { error: "Line ID is required" },
        { status: 400 }
      );
    }

    const lastSeen = new Date();

    try {
      const existing = await prisma.displayHeartbeat.findFirst({ where: { line_id: lineId } });
      if (existing) {
        await prisma.displayHeartbeat.update({
          where: { id: existing.id },
          data: { last_seen: lastSeen },
        });
      } else {
        await prisma.displayHeartbeat.create({
          data: { line_id: lineId, last_seen: lastSeen },
        });
      }
      setMemoryHeartbeat(lineId, lastSeen.toISOString());
      return NextResponse.json({ success: true, hasDatabase: true });
    } catch (dbErr) {
      setMemoryHeartbeat(lineId, lastSeen.toISOString());
      return NextResponse.json({ success: true, hasDatabase: false });
    }
  } catch (error) {
    console.error("Display heartbeat POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lineId = (searchParams.get("lineId") ?? searchParams.get("landId"))?.trim();

    if (!lineId) {
      return NextResponse.json(
        { error: "Line ID is required" },
        { status: 400 }
      );
    }

    try {
      await prisma.displayHeartbeat.deleteMany({
        where: { line_id: lineId },
      });
    } catch (err) {
      console.warn("Display heartbeat DELETE DB warn:", err);
    }

    clearMemoryHeartbeat(lineId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Display heartbeat DELETE error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
