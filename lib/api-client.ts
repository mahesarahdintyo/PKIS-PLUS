// lib/api-client.ts
// ============================================================
// PKIS-PLUS Browser API Client
// Thin HTTP fetch wrapper untuk API routes Next.js.
// BUKAN meniru Supabase — murni helper fetch untuk client components.
// ============================================================

// ─── Socket.io ───────────────────────────────────────────────────────────────

import type { Socket } from "socket.io-client";

let _socketInstance: Socket | null = null;

export function getSocket(): Socket | null {
  if (typeof window === "undefined") return null;
  if (_socketInstance) return _socketInstance;
  try {
    const { io } = require("socket.io-client");
    const socketUrl = (typeof window !== "undefined" && window.location?.origin)
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_SOCKET_URL || "http://0.0.0.0:3000");
    _socketInstance = io(socketUrl, {
      path: "/api/socket",
      transports: ["websocket", "polling"],
    });
    return _socketInstance;
  } catch {
    return null;
  }
}

// ─── Auth Helpers ─────────────────────────────────────────────────────────────

function getStoredSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("pkis_user_session");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function storeSession(session: any) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("pkis_user_session", JSON.stringify(session));
  } catch {}
}

function clearStoredSession() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("pkis_user_session");
  } catch {}
}

type AuthChangeCallback = (event: string, session: any) => void;
const authListeners: AuthChangeCallback[] = [];

export const auth = {
  async getUser() {
    const session = getStoredSession();
    if (session?.user) return { user: session.user, error: null };
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          storeSession({ user: data.user });
          return { user: data.user, error: null };
        }
      }
    } catch {}
    return { user: null, error: null };
  },

  async getSession() {
    const session = getStoredSession();
    if (session) return { data: { session }, error: null };
    const { user } = await this.getUser();
    if (user) {
      const sess = { user };
      return { data: { session: sess }, error: null };
    }
    return { data: { session: null }, error: null };
  },

  async signIn(email: string, password: string) {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) return { user: null, error: data.error };

      const session = { user: data.user, access_token: data.token };
      storeSession(session);
      authListeners.forEach((cb) => cb("SIGNED_IN", session));
      return { user: data.user, error: null };
    } catch (e: any) {
      return { user: null, error: e.message };
    }
  },

  async signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    clearStoredSession();
    authListeners.forEach((cb) => cb("SIGNED_OUT", null));
  },

  onAuthStateChange(callback: AuthChangeCallback) {
    authListeners.push(callback);
    return {
      data: {
        subscription: {
          unsubscribe() {
            const idx = authListeners.indexOf(callback);
            if (idx > -1) authListeners.splice(idx, 1);
          },
        },
      },
      unsubscribe() {
        const idx = authListeners.indexOf(callback);
        if (idx > -1) authListeners.splice(idx, 1);
      },
    };
  },
};

// ─── RPC (Stored Procedures via /api/produksi/rpc) ──────────────────────────

export async function callRpc(
  fn: string,
  args?: Record<string, any>
): Promise<{ data: any; error: any }> {
  try {
    const res = await fetch("/api/produksi/rpc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fn, args }),
    });
    const result = await res.json();
    return { data: result.data ?? null, error: result.error ?? null };
  } catch (e: any) {
    return { data: null, error: { message: e.message } };
  }
}

// ─── Andon API ────────────────────────────────────────────────────────────────

export const andonApi = {
  async getCalls(params: {
    status?: string[];
    status_single?: string;
    mesin?: string;
    line_id?: string;
    limit?: number;
    page?: number;
    offset?: number;
  } = {}) {
    const url = new URL("/api/andon/calls", window.location.origin);
    params.status?.forEach((s) => url.searchParams.append("status", s));
    if (params.status_single) url.searchParams.set("status_single", params.status_single);
    if (params.mesin) url.searchParams.set("mesin", params.mesin);
    if (params.line_id) url.searchParams.set("line_id", params.line_id);
    if (params.limit !== undefined) url.searchParams.set("limit", String(params.limit));
    if (params.page !== undefined) url.searchParams.set("page", String(params.page));
    if (params.offset !== undefined) url.searchParams.set("offset", String(params.offset));

    const res = await fetch(url.toString());
    return res.json() as Promise<{ data: any[]; error: any }>;
  },

  async createCall(body: {
    line_id?: string | null;
    line_name?: string | null;
    mesin: string;
    stasiun?: string | null;
    alasan?: string | null;
    triggered_by?: string | null;
    status?: string;
  }) {
    const res = await fetch("/api/andon/calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json() as Promise<{ data: any; error: any }>;
  },

  async updateCall(id: string, data: Record<string, any>) {
    const res = await fetch("/api/andon/calls", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...data }),
    });
    return res.json() as Promise<{ data: any; error: any }>;
  },

  async deleteCall(id: string) {
    const res = await fetch("/api/andon/calls", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    return res.json() as Promise<{ data: any; count?: number; error: any }>;
  },

  async deleteCalls(ids: string[]) {
    const res = await fetch("/api/andon/calls", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    return res.json() as Promise<{ data: any; count?: number; error: any }>;
  },

  async getLeaders(params: { user_id?: string; is_active?: boolean } = {}) {
    const url = new URL("/api/andon/leaders", window.location.origin);
    if (params.user_id) url.searchParams.set("user_id", params.user_id);
    if (params.is_active !== undefined) url.searchParams.set("is_active", String(params.is_active));

    const res = await fetch(url.toString());
    return res.json() as Promise<{ data: any[]; error: any }>;
  },

  async upsertLeader(body: { user_id: string; mesin: string; tier: number }) {
    const res = await fetch("/api/andon/leaders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json() as Promise<{ data: any; error: any }>;
  },

  async deactivateLeader(id: string) {
    const res = await fetch("/api/andon/leaders", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_active: false }),
    });
    return res.json() as Promise<{ data: any; error: any }>;
  },

  async savePushSubscription(body: {
    user_id: string;
    endpoint: string;
    p256dh: string;
    auth_key: string;
    device_label?: string;
  }) {
    const res = await fetch("/api/andon/push-subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json() as Promise<{ data: any; error: any }>;
  },
};

// ─── Socket.io Realtime Subscription ─────────────────────────────────────────

export function subscribeToSocketEvent(
  tableName: string,
  event: "*" | "INSERT" | "UPDATE" | "DELETE",
  callback: (payload: any) => void
): () => void {
  const socket = getSocket();
  if (!socket) return () => {};

  const socketEvent = `db:${tableName}:${event}`;
  const handler = (payload: any) => callback(payload);
  socket.on(socketEvent, handler);

  return () => socket.off(socketEvent, handler);
}

// ─── Storage (local file server) ─────────────────────────────────────────────

export function getPublicFileUrl(path: string): string {
  return `/uploads/${path.replace(/^[/\\]+/, "")}`;
}

// ─── Offline Queue ────────────────────────────────────────────────────────────

const OFFLINE_QUEUE_KEY = "offline_queue_prod_v1";

export interface OfflineQueueItem {
  localId: string;
  table: string;
  payload: any;
  created_at: string;
}

export function loadOfflineQueue(): OfflineQueueItem[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveOfflineQueue(q: OfflineQueueItem[]) {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(q));
  } catch {}
}

export function enqueueOffline(table: string, payload: any) {
  const q = loadOfflineQueue();
  q.push({
    localId: "local_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
    table,
    payload,
    created_at: new Date().toISOString(),
  });
  saveOfflineQueue(q);
}

export function isNetworkError(err: any): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  return /fetch|network|failed to fetch/i.test((err && err.message) || String(err));
}

export async function trySyncOfflineQueue(): Promise<{ synced: number }> {
  const q = loadOfflineQueue();
  if (q.length === 0) return { synced: 0 };

  let synced = 0;
  const remaining: OfflineQueueItem[] = [];
  for (const item of q) {
    try {
      const res = await fetch("/api/produksi/sync-offline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table: item.table, data: item.payload }),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      synced++;
    } catch {
      remaining.push(item);
    }
  }
  saveOfflineQueue(remaining);
  return { synced };
}

// ─── Lines API ─────────────────────────────────────────────────────────────────

export const linesApi = {
  async get(params: { includeHidden?: boolean; machine_type?: string } = {}) {
    const url = new URL("/api/lines", window.location.origin);
    if (params.includeHidden) url.searchParams.set("includeHidden", "true");
    const res = await fetch(url.toString());
    const data = await res.json();
    // The route returns an array directly (not {data: []})
    return { data: Array.isArray(data) ? data : [], error: data?.error ?? null };
  },
};

// ─── RPC API (Stored Functions) ────────────────────────────────────────────────

export const rpcApi = {
  /** Call a whitelisted PostgreSQL stored function via POST /api/produksi/rpc */
  async call(fn: string, args: Record<string, any> = {}) {
    const res = await fetch("/api/produksi/rpc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fn, args }),
    });
    return res.json() as Promise<{ data: any; error: any }>;
  },
};

// ─── Production APIs ──────────────────────────────────────────────────────────

export const partNumbersApi = {
  async get(params: { line_id?: string; mesin?: string; search?: string; is_active?: boolean | string } = {}) {
    const url = new URL("/api/produksi/part-numbers", window.location.origin);
    if (params.line_id) url.searchParams.set("line_id", params.line_id);
    if (params.mesin) url.searchParams.set("mesin", params.mesin);
    if (params.search) url.searchParams.set("search", params.search);
    if (params.is_active !== undefined) url.searchParams.set("is_active", String(params.is_active));
    const res = await fetch(url.toString());
    return res.json() as Promise<{ data: any[]; error: any }>;
  },
  async create(data: any) {
    const res = await fetch("/api/produksi/part-numbers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json() as Promise<{ data: any; error: any }>;
  },
  async update(id: string, data: any) {
    const res = await fetch("/api/produksi/part-numbers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...data }),
    });
    return res.json() as Promise<{ data: any; error: any }>;
  },
  async delete(id: string) {
    const res = await fetch("/api/produksi/part-numbers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    return res.json() as Promise<{ data: any; error: any }>;
  },
};

export const masterDataApi = {
  async get(params: { type?: string; mesin?: string; line_id?: string } = {}) {
    const url = new URL("/api/produksi/master-data", window.location.origin);
    if (params.type) url.searchParams.set("type", params.type);
    if (params.mesin) url.searchParams.set("mesin", params.mesin);
    if (params.line_id) url.searchParams.set("line_id", params.line_id);
    const res = await fetch(url.toString());
    return res.json() as Promise<{ data: any; error: any }>;
  },
  async post(type: string, data: any) {
    const res = await fetch("/api/produksi/master-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, data }),
    });
    return res.json() as Promise<{ data: any; error: any }>;
  },
  async patch(type: string, id: string, data: any) {
    const res = await fetch("/api/produksi/master-data", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, id, data }),
    });
    return res.json() as Promise<{ data: any; error: any }>;
  },
  async delete(type: string, id: string) {
    const res = await fetch("/api/produksi/master-data", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, id }),
    });
    return res.json() as Promise<{ data: any; error: any }>;
  },
};

export const productionLogsApi = {
  async get(params: {
    table?: "production" | "dandori" | "both";
    mesin?: string;
    line_id?: string;
    startDate?: string;
    endDate?: string;
    pStart?: string;
    pEnd?: string;
    limit?: number;
    is_active?: boolean | string;
  } = {}) {
    const url = new URL("/api/produksi/logs", window.location.origin);
    if (params.table) url.searchParams.set("table", params.table);
    if (params.mesin) url.searchParams.set("mesin", params.mesin);
    if (params.line_id) url.searchParams.set("line_id", params.line_id);
    if (params.startDate) url.searchParams.set("startDate", params.startDate);
    if (params.endDate) url.searchParams.set("endDate", params.endDate);
    if (params.pStart) url.searchParams.set("pStart", params.pStart);
    if (params.pEnd) url.searchParams.set("pEnd", params.pEnd);
    if (params.limit) url.searchParams.set("limit", String(params.limit));
    if (params.is_active !== undefined) url.searchParams.set("is_active", String(params.is_active));
    const res = await fetch(url.toString());
    return res.json() as Promise<{ data: any; error: any }>;
  },
  async create(table: "production" | "dandori", data: any) {
    const res = await fetch("/api/produksi/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table, data }),
    });
    return res.json() as Promise<{ data: any; error: any }>;
  },
  async update(table: "production" | "dandori", id: string, data: any) {
    const res = await fetch("/api/produksi/logs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table, id, data }),
    });
    return res.json() as Promise<{ data: any; error: any }>;
  },
  async updateMany(table: "production" | "dandori", ids: string[], data: any) {
    const res = await fetch("/api/produksi/logs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table, ids, data }),
    });
    return res.json() as Promise<{ data: any; error: any }>;
  },
  async deleteMany(table: "production" | "dandori", ids: string[]) {
    const res = await fetch("/api/produksi/logs", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table, ids }),
    });
    return res.json() as Promise<{ data: any; count?: number; error: any }>;
  },
};

export const downtimeApi = {
  async get(params: {
    mesin?: string;
    kategori?: string;
    line_id?: string;
    startDate?: string;
    endDate?: string;
    pStart?: string;
    pEnd?: string;
    limit?: number;
    page?: number;
    is_active?: boolean | string;
  } = {}) {
    const url = new URL("/api/produksi/downtime", window.location.origin);
    if (params.mesin) url.searchParams.set("mesin", params.mesin);
    if (params.kategori) url.searchParams.set("kategori", params.kategori);
    if (params.line_id) url.searchParams.set("line_id", params.line_id);
    if (params.startDate) url.searchParams.set("startDate", params.startDate);
    if (params.endDate) url.searchParams.set("endDate", params.endDate);
    if (params.pStart) url.searchParams.set("pStart", params.pStart);
    if (params.pEnd) url.searchParams.set("pEnd", params.pEnd);
    if (params.limit) url.searchParams.set("limit", String(params.limit));
    if (params.page !== undefined) url.searchParams.set("page", String(params.page));
    if (params.is_active !== undefined) url.searchParams.set("is_active", String(params.is_active));
    const res = await fetch(url.toString());
    return res.json() as Promise<{ data: any[]; error: any }>;
  },
  async create(data: any) {
    const res = await fetch("/api/produksi/downtime", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json() as Promise<{ data: any; error: any }>;
  },
  async update(id: string, data: any) {
    const res = await fetch("/api/produksi/downtime", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, data }),
    });
    return res.json() as Promise<{ data: any; error: any }>;
  },
  async deleteMany(ids: string[]) {
    const res = await fetch("/api/produksi/downtime", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    return res.json() as Promise<{ data: any; count?: number; error: any }>;
  },
};

export const planningApi = {
  async get(params: { mesin?: string; line_id?: string; is_active?: boolean | string } = {}) {
    const url = new URL("/api/produksi/planning", window.location.origin);
    if (params.mesin) url.searchParams.set("mesin", params.mesin);
    if (params.line_id) url.searchParams.set("line_id", params.line_id);
    if (params.is_active !== undefined) url.searchParams.set("is_active", String(params.is_active));
    const res = await fetch(url.toString());
    return res.json() as Promise<{ data: any[]; error: any }>;
  },
  async create(data: any) {
    const res = await fetch("/api/produksi/planning", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json() as Promise<{ data: any; error: any }>;
  },
  async update(id: string, data: any) {
    const res = await fetch("/api/produksi/planning", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, data }),
    });
    return res.json() as Promise<{ data: any; error: any }>;
  },
  async delete(id: string) {
    const res = await fetch("/api/produksi/planning", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    return res.json() as Promise<{ data: any; error: any }>;
  },
  async deleteMany(ids: string[]) {
    const res = await fetch("/api/produksi/planning", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    return res.json() as Promise<{ data: any; error: any }>;
  },
};

export const safetyApi = {
  async get(params: { kategori?: string; startDate?: string; endDate?: string; page?: number; limit?: number; is_active?: boolean | string } = {}) {
    const url = new URL("/api/produksi/safety", window.location.origin);
    if (params.kategori) url.searchParams.set("kategori", params.kategori);
    if (params.startDate) url.searchParams.set("startDate", params.startDate);
    if (params.endDate) url.searchParams.set("endDate", params.endDate);
    if (params.page !== undefined) url.searchParams.set("page", String(params.page));
    if (params.limit !== undefined) url.searchParams.set("limit", String(params.limit));
    if (params.is_active !== undefined) url.searchParams.set("is_active", String(params.is_active));
    const res = await fetch(url.toString());
    return res.json() as Promise<{ data: any[]; error: any }>;
  },
  async create(data: any) {
    const res = await fetch("/api/produksi/safety", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json() as Promise<{ data: any; error: any }>;
  },
  async update(id: string, data: any) {
    const res = await fetch("/api/produksi/safety", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, data }),
    });
    return res.json() as Promise<{ data: any; error: any }>;
  },
  async deleteMany(ids: string[]) {
    const res = await fetch("/api/produksi/safety", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    return res.json() as Promise<{ data: any; count?: number; error: any }>;
  },
};

export const scrapApi = {
  async get(params: { tahun?: number; bulan?: number; page?: number; limit?: number; is_active?: boolean | string } = {}) {
    const url = new URL("/api/produksi/scrap", window.location.origin);
    if (params.tahun) url.searchParams.set("tahun", String(params.tahun));
    if (params.bulan) url.searchParams.set("bulan", String(params.bulan));
    if (params.page !== undefined) url.searchParams.set("page", String(params.page));
    if (params.limit !== undefined) url.searchParams.set("limit", String(params.limit));
    if (params.is_active !== undefined) url.searchParams.set("is_active", String(params.is_active));
    const res = await fetch(url.toString());
    return res.json() as Promise<{ data: any[]; error: any }>;
  },
  async create(data: any) {
    const res = await fetch("/api/produksi/scrap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json() as Promise<{ data: any; error: any }>;
  },
  async update(id: string, data: any) {
    const res = await fetch("/api/produksi/scrap", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, data }),
    });
    return res.json() as Promise<{ data: any; error: any }>;
  },
  async deleteMany(ids: string[]) {
    const res = await fetch("/api/produksi/scrap", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    return res.json() as Promise<{ data: any; count?: number; error: any }>;
  },
};

export const attendanceApi = {
  async get(params: { shift?: string; startDate?: string; endDate?: string; page?: number; limit?: number; is_active?: boolean | string } = {}) {
    const url = new URL("/api/produksi/attendance", window.location.origin);
    if (params.shift) url.searchParams.set("shift", params.shift);
    if (params.startDate) url.searchParams.set("startDate", params.startDate);
    if (params.endDate) url.searchParams.set("endDate", params.endDate);
    if (params.page !== undefined) url.searchParams.set("page", String(params.page));
    if (params.limit !== undefined) url.searchParams.set("limit", String(params.limit));
    if (params.is_active !== undefined) url.searchParams.set("is_active", String(params.is_active));
    const res = await fetch(url.toString());
    return res.json() as Promise<{ data: any[]; error: any }>;
  },
  async create(data: any) {
    const res = await fetch("/api/produksi/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json() as Promise<{ data: any; error: any }>;
  },
  async update(id: string, data: any) {
    const res = await fetch("/api/produksi/attendance", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, data }),
    });
    return res.json() as Promise<{ data: any; error: any }>;
  },
  async deleteMany(ids: string[]) {
    const res = await fetch("/api/produksi/attendance", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    return res.json() as Promise<{ data: any; count?: number; error: any }>;
  },
};

export const productivityApi = {
  async get(params: { startDate?: string; endDate?: string; page?: number; limit?: number; is_active?: boolean | string } = {}) {
    const url = new URL("/api/produksi/productivity", window.location.origin);
    if (params.startDate) url.searchParams.set("startDate", params.startDate);
    if (params.endDate) url.searchParams.set("endDate", params.endDate);
    if (params.page !== undefined) url.searchParams.set("page", String(params.page));
    if (params.limit !== undefined) url.searchParams.set("limit", String(params.limit));
    if (params.is_active !== undefined) url.searchParams.set("is_active", String(params.is_active));
    const res = await fetch(url.toString());
    return res.json() as Promise<{ data: any[]; error: any }>;
  },
  /** Upsert: insert or update by tanggal (unique key) */
  async upsert(data: { tanggal: string; eh_jam: number | string; is_active?: boolean }) {
    const res = await fetch("/api/produksi/productivity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, upsert: true }),
    });
    return res.json() as Promise<{ data: any; error: any }>;
  },
  async create(data: any) {
    const res = await fetch("/api/produksi/productivity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json() as Promise<{ data: any; error: any }>;
  },
  async update(id: string, data: any) {
    const res = await fetch("/api/produksi/productivity", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, data }),
    });
    return res.json() as Promise<{ data: any; error: any }>;
  },
  /** Update by tanggal string — for records that may not have a UUID yet */
  async updateByTanggal(tanggal: string, data: any) {
    const res = await fetch("/api/produksi/productivity", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tanggal, data }),
    });
    return res.json() as Promise<{ data: any; error: any }>;
  },
  async deleteMany(ids: string[]) {
    const res = await fetch("/api/produksi/productivity", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    return res.json() as Promise<{ data: any; count?: number; error: any }>;
  },
};
