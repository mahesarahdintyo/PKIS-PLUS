/**
 * machineSnapshot.ts
 *
 * Helper untuk menyimpan dan memulihkan snapshot data halaman mesin ke/dari
 * localStorage, sehingga operator tetap bisa melihat data terakhir yang
 * berhasil di-load saat offline + reload (tablet baru restart, dsb.).
 */

export const MACHINE_SNAPSHOT_PREFIX = "futaba.machine-snapshot.";
export const MACHINE_SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 jam

export interface MachineSnapshot {
  savedAt: number;
  mesinSettings: {
    gsph_target_mode: "fixed" | "per_part";
    gsph_target_fixed: number;
    target_availability: number;
  } | null;
  masterParts: any[];
  productionRows: any[];
  downtimeList: any[];
  problemList: any[];
  nonProduksiRows: any[];
  nonProduksiTypes: any[];
  planningList: any[];
}

/** Bentuk key unik per line/mesin di localStorage. */
export function getMachineSnapshotKey(lineId?: string | null, mesinKey?: string): string {
  return `${MACHINE_SNAPSHOT_PREFIX}${lineId || mesinKey || "unknown"}`;
}

/** Simpan snapshot lengkap ke localStorage. Gagal diam-diam (storage penuh). */
export function saveMachineSnapshot(
  key: string,
  data: Omit<MachineSnapshot, "savedAt">
): void {
  try {
    const snapshot: MachineSnapshot = { savedAt: Date.now(), ...data };
    window.localStorage.setItem(key, JSON.stringify(snapshot));
  } catch (err) {
    console.warn(
      "Gagal simpan snapshot data mesin (localStorage penuh/tidak tersedia):",
      err
    );
  }
}

/**
 * Baca snapshot dari localStorage.
 * Mengembalikan `null` jika tidak ada, corrupt, atau sudah kedaluwarsa (>24 jam).
 */
export function loadMachineSnapshot(key: string): MachineSnapshot | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MachineSnapshot;
    if (Date.now() - parsed.savedAt > MACHINE_SNAPSHOT_MAX_AGE_MS) {
      // Snapshot terlalu lama — jangan tampilkan data basi tanpa operator sadar.
      return null;
    }
    return parsed;
  } catch (err) {
    console.warn("Gagal baca snapshot data mesin:", err);
    return null;
  }
}
