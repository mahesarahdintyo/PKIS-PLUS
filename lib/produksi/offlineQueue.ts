// ---------- Offline queue (localStorage) ----------
// Porting dari project-experiment/lib/offlineQueue.ts
// Import supabase sudah diganti ke pola PKIS-PLUS (@/lib/supabase/client)

import { createClient } from "@/lib/supabase/client";

const OFFLINE_QUEUE_KEY = "offline_queue_prod_v1";

export type OfflineQueueItem = {
  localId: string;
  table: string;
  payload: any;
  created_at: string;
};

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
  if (!navigator.onLine) return true;
  return /fetch|network|failed to fetch/i.test((err && err.message) || String(err));
}

export async function trySyncOfflineQueue(): Promise<{ synced: number }> {
  const supabase = createClient();
  const q = loadOfflineQueue();
  if (q.length === 0) return { synced: 0 };

  let synced = 0;
  const remaining: OfflineQueueItem[] = [];
  for (const item of q) {
    try {
      const { error } = await supabase.from(item.table as any).insert(item.payload);
      if (error) throw error;
      synced++;
    } catch {
      remaining.push(item);
    }
  }
  saveOfflineQueue(remaining);
  return { synced };
}
