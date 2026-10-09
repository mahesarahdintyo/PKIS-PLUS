// lib/socket.ts
// ============================================================
// Socket.io server-side helper
// Dipakai dari API routes untuk broadcast realtime events ke klien.
// ============================================================

import type { Server as SocketIOServer } from "socket.io";

declare global {
  var _socketio: SocketIOServer | null;
}

/**
 * Dapatkan URL koneksi Socket.io client.
 * Dinamis membaca window.location.origin jika di browser,
 * atau fallback ke env NEXT_PUBLIC_SOCKET_URL / 'http://0.0.0.0:3000'.
 */
export function getSocketUrl(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_SOCKET_URL || "http://0.0.0.0:3000";
}

let _clientSocket: any = null;

/**
 * Dapatkan instance Socket.io client dengan URL dinamis.
 */
export function getSocketClient() {
  if (typeof window === "undefined") return null;
  if (_clientSocket) return _clientSocket;
  try {
    const { io } = require("socket.io-client");
    _clientSocket = io(getSocketUrl(), {
      path: "/api/socket",
      transports: ["websocket", "polling"],
    });
    return _clientSocket;
  } catch {
    return null;
  }
}

/**
 * Dapatkan instance Socket.io server.
 * Harus sudah diinisialisasi oleh server.js.
 */
export function getSocketIOServer(): SocketIOServer | null {
  return global._socketio ?? null;
}

/**
 * Broadcast event perubahan database ke semua client.
 * Mengganti Supabase postgres_changes realtime.
 *
 * @param table - Nama tabel yang berubah (e.g. "andon_calls")
 * @param event - Jenis event: "INSERT" | "UPDATE" | "DELETE" | "*"
 * @param payload - Data payload (new, old, eventType)
 * @param room - Opsional: kirim hanya ke room tertentu (e.g. "line:abc123")
 */
export function broadcastDbChange(
  table: string,
  event: "INSERT" | "UPDATE" | "DELETE",
  payload: { new?: any; old?: any; eventType: string },
  room?: string
) {
  const io = getSocketIOServer();
  if (!io) return;

  const socketEvent = `db:${table}:*`;
  const specificEvent = `db:${table}:${event}`;

  if (room) {
    io.to(room).emit(socketEvent, payload);
    io.to(room).emit(specificEvent, payload);
  } else {
    io.emit(socketEvent, payload);
    io.emit(specificEvent, payload);
  }
}

/**
 * Broadcast event Andon ke semua leader yang terdaftar.
 */
export function broadcastAndonEvent(
  event: "new_call" | "acknowledged" | "escalated" | "call:created" | string,
  payload: any
) {
  const io = getSocketIOServer();
  if (!io) return;
  io.emit(`andon:${event}`, payload);
  io.emit("db:andon_calls:*", { new: payload, eventType: "INSERT" });
}

/**
 * Broadcast production log update ke room mesin/line tertentu.
 */
export function broadcastProductionUpdate(
  mesin: string,
  lineId: string | null,
  event: "INSERT" | "UPDATE" | "DELETE",
  data: any
) {
  const io = getSocketIOServer();
  if (!io) return;

  const payload = { eventType: event, new: data, mesin, lineId };
  io.to(`mesin:${mesin}`).emit(`db:prod_production_log:*`, payload);
  if (lineId) {
    io.to(`line:${lineId}`).emit(`db:prod_production_log:*`, payload);
  }
}
