// lib/supabase/client.ts
// ============================================================
// COMPATIBILITY SHIM — Supabase Browser Client → API Routes + Socket.io
//
// Mengganti @supabase/supabase-js di browser dengan thin wrapper
// yang melakukan fetch ke API routes internal (untuk data ops)
// dan socket.io (untuk realtime).
//
// Ini mempertahankan interface yang sama sehingga komponen
// frontend tidak perlu diubah banyak.
// ============================================================

import type { Socket } from "socket.io-client";

// Lazy load socket.io-client agar tidak crash di SSR
let _socketInstance: Socket | null = null;

function getSocket(): Socket | null {
  if (typeof window === "undefined") return null;
  if (_socketInstance) return _socketInstance;
  try {
    const { io } = require("socket.io-client");
    _socketInstance = io(window.location.origin, {
      path: "/api/socket",
      transports: ["websocket", "polling"],
    });
    return _socketInstance;
  } catch {
    return null;
  }
}

// ─── Session cookie helper ─────────────────────────────────────────────────────

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

// ─── Auth state change listeners ──────────────────────────────────────────────

type AuthChangeCallback = (event: string, session: any) => void;
const authListeners: AuthChangeCallback[] = [];

// ─── Main createClient factory ────────────────────────────────────────────────

export function createClient() {
  return {
    auth: {
      async getUser() {
        let session = getStoredSession();
        if (session?.user) {
          return { data: { user: session.user }, error: null };
        }
        try {
          const res = await fetch("/api/auth/me");
          if (res.ok) {
            const data = await res.json();
            if (data.user) {
              storeSession({ user: data.user });
              return { data: { user: data.user }, error: null };
            }
          }
        } catch {}
        return { data: { user: null }, error: null };
      },

      async getSession() {
        const session = getStoredSession();
        if (!session) return { data: { session: null }, error: null };
        return { data: { session }, error: null };
      },

      async signInWithPassword({ email, password }: { email: string; password: string }) {
        try {
          const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });
          const data = await res.json();
          if (!res.ok) return { data: { user: null, session: null }, error: { message: data.error } };

          const session = { user: data.user, access_token: data.token };
          storeSession(session);
          authListeners.forEach((cb) => cb("SIGNED_IN", session));
          return { data: { user: data.user, session }, error: null };
        } catch (e: any) {
          return { data: { user: null, session: null }, error: { message: e.message } };
        }
      },

      async signOut() {
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
        clearStoredSession();
        authListeners.forEach((cb) => cb("SIGNED_OUT", null));
      },

      onAuthStateChange(callback: AuthChangeCallback) {
        authListeners.push(callback);
        const subscription = {
          unsubscribe() {
            const idx = authListeners.indexOf(callback);
            if (idx > -1) authListeners.splice(idx, 1);
          },
        };
        return { data: { subscription } };
      },
    },

    from(table: string) {
      return new ClientQueryBuilder(table);
    },

    rpc(fn: string, args?: any) {
      return new RpcBuilder(fn, args);
    },

    // Socket.io realtime — mengganti supabase.channel()
    channel(name: string) {
      return new ChannelBuilder(name);
    },

    removeChannel(channel: any) {
      if (channel && typeof channel.unsubscribe === "function") {
        channel.unsubscribe();
      }
    },

    storage: {
      from(bucket: string) {
        return {
          getPublicUrl(path: string) {
            const baseUrl = "/api/storage";
            return { data: { publicUrl: `${baseUrl}/${bucket}/${path}` } };
          },
        };
      },
    },

    functions: {
      async invoke(name: string, options?: { body?: any }) {
        // Edge functions → internal API routes
        const routeMap: Record<string, string> = {
          "send-andon-push": "/api/push/send-andon",
        };
        const url = routeMap[name] || `/api/functions/${name}`;
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: options?.body ? JSON.stringify(options.body) : undefined,
          });
          return { data: await res.json().catch(() => null), error: null };
        } catch (e: any) {
          return { data: null, error: { message: e.message } };
        }
      },
    },
  };
}

// ─── Client-side Query Builder (fetch → API routes) ───────────────────────────

class ClientQueryBuilder {
  private _table: string;
  private _select = "*";
  private _filters: [string, any][] = [];
  private _inFilters: [string, any[]][] = [];
  private _order: { field: string; asc: boolean } | null = null;
  private _limit: number | null = null;
  private _insert: any = null;
  private _update: any = null;
  private _upsert: any = null;
  private _upsertConflict: string | null = null;
  private _isDelete = false;
  private _isSingle = false;
  private _isMaybe = false;

  constructor(table: string) {
    this._table = table;
  }

  select(s: string = "*") { this._select = s; return this; }
  insert(d: any) { this._insert = d; return this; }
  update(d: any) { this._update = d; return this; }
  upsert(d: any, opts?: any) { this._upsert = d; this._upsertConflict = opts?.onConflict ?? null; return this; }
  delete(opts?: any) { this._isDelete = true; return this; }
  eq(f: string, v: any) { this._filters.push([f, v]); return this; }
  neq(f: string, v: any) { this._filters.push([`neq_${f}`, v]); return this; }
  in(f: string, vs: any[]) { this._inFilters.push([f, vs]); return this; }
  or(s: string) { this._filters.push(["__or__", s]); return this; }
  gte(f: string, v: any) { this._filters.push([`gte_${f}`, v]); return this; }
  lte(f: string, v: any) { this._filters.push([`lte_${f}`, v]); return this; }
  lt(f: string, v: any) { this._filters.push([`lt_${f}`, v]); return this; }
  gt(f: string, v: any) { this._filters.push([`gt_${f}`, v]); return this; }
  is(f: string, v: any) { this._filters.push([`is_${f}`, v]); return this; }
  not(f: string, op: string, v: any) { this._filters.push([`not_${f}`, { op, v }]); return this; }
  ilike(f: string, v: string) { this._filters.push([`ilike_${f}`, v]); return this; }
  order(f: string, opts?: any) { this._order = { field: f, asc: opts?.ascending !== false }; return this; }
  limit(n: number) { this._limit = n; return this; }
  range(from: number, to: number) { this._limit = to - from + 1; return this; }
  single() { this._isSingle = true; return this._execute(); }
  maybeSingle() { this._isMaybe = true; return this._execute(); }
  then(r: (v: any) => any, j?: (e: any) => any) { return this._execute().then(r, j); }

  private async _execute(): Promise<{ data: any; error: any }> {
    try {
      const body: any = {
        table: this._table,
        select: this._select,
        filters: this._filters,
        inFilters: this._inFilters,
        order: this._order,
        limit: this._limit,
        single: this._isSingle || this._isMaybe,
      };

      let method = "POST";
      let endpoint = "/api/db/query";

      if (this._isDelete) {
        endpoint = "/api/db/delete";
      } else if (this._insert) {
        endpoint = "/api/db/insert";
        body.data = this._insert;
      } else if (this._update) {
        endpoint = "/api/db/update";
        body.data = this._update;
      } else if (this._upsert) {
        endpoint = "/api/db/upsert";
        body.data = this._upsert;
        body.onConflict = this._upsertConflict;
      }

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      return { data: result.data ?? null, error: result.error ?? null };
    } catch (e: any) {
      return { data: null, error: { message: e.message } };
    }
  }
}

// ─── RPC Builder ──────────────────────────────────────────────────────────────

class RpcBuilder {
  private fn: string;
  private args: any;

  constructor(fn: string, args?: any) {
    this.fn = fn;
    this.args = args;
  }

  then(r: (v: any) => any, j?: (e: any) => any) {
    return this._execute().then(r, j);
  }

  catch(j: (e: any) => any) {
    return this._execute().catch(j);
  }

  private async _execute(): Promise<{ data: any; error: any }> {
    try {
      const res = await fetch("/api/db/rpc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fn: this.fn, args: this.args }),
      });
      const result = await res.json();
      return { data: result.data ?? null, error: result.error ?? null };
    } catch (e: any) {
      return { data: null, error: { message: e.message } };
    }
  }
}

// ─── Channel Builder (Socket.io-based realtime) ───────────────────────────────

class ChannelBuilder {
  private name: string;
  private _handlers: Array<{ event: string; config: any; callback: Function }> = [];
  private _socket: Socket | null = null;
  private _socketHandlers: Array<() => void> = [];

  constructor(name: string) {
    this.name = name;
  }

  on(
    event: string,
    config: { event: string; schema: string; table: string },
    callback: Function
  ) {
    this._handlers.push({ event, config, callback });
    return this;
  }

  subscribe() {
    if (typeof window === "undefined") return this;

    this._socket = getSocket();
    if (!this._socket) return this;

    for (const h of this._handlers) {
      const socketEvent = `db:${h.config.table}:${h.config.event}`;
      const handler = (payload: any) => h.callback(payload);
      this._socket.on(socketEvent, handler);
      this._socketHandlers.push(() => this._socket?.off(socketEvent, handler));
    }

    return this;
  }

  unsubscribe() {
    for (const cleanup of this._socketHandlers) cleanup();
    this._socketHandlers = [];
  }
}
