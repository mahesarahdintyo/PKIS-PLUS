import { useCallback, useEffect, useRef, useState } from "react";
import { loadOfflineQueue, trySyncOfflineQueue } from "@/lib/produksi/offlineQueue";

export interface UseOfflineSyncOptions {
  /** Dipanggil setelah sync sukses dengan synced > 0 (misal refetch data produksi/downtime/non-produksi). */
  onSynced?: (synced: number) => void;
}

export function useOfflineSync(opts: UseOfflineSyncOptions = {}) {
  const { onSynced } = opts;
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);
  const onSyncedRef = useRef(onSynced);
  onSyncedRef.current = onSynced;

  const refreshPendingCount = useCallback(() => {
    setPendingCount(loadOfflineQueue().length);
  }, []);

  const syncNow = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;
    syncingRef.current = true;
    setSyncing(true);
    const { synced } = await trySyncOfflineQueue();
    syncingRef.current = false;
    setSyncing(false);
    refreshPendingCount();
    if (synced > 0) {
      onSyncedRef.current?.(synced);
    }
  }, [refreshPendingCount]);

  useEffect(() => {
    refreshPendingCount();
    syncNow();

    const handleOnline = () => syncNow();
    window.addEventListener("online", handleOnline);
    const interval = setInterval(() => syncNow(), 20000);

    return () => {
      window.removeEventListener("online", handleOnline);
      clearInterval(interval);
    };
  }, [syncNow, refreshPendingCount]);

  return { pendingCount, syncing, syncNow, refreshPendingCount };
}
