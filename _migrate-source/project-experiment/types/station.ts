// =========================================================
// Station State Machine Types
// Port dari database-main/assets/machine-page.js (machinePage)
// Setiap stasiun punya state independen — mengelola stasiun per state.
// =========================================================

export type StationPhase =
  | "idle"
  | "awaiting_gap"
  | "awaiting_next_choice"
  | "awaiting_actual_start"
  | "running"
  | "finished"
  | "nonproduksi_running"
  | "edit";

/** Form produksi per line/stasiun */
export interface LineForm {
  part_number: string;
  qty: number | "";
  manpower: number | "";
  ng: number | "";
  [key: string]: any;
}

/** Interface untuk state 1 stasiun */
export interface LineState {
  stationId?: string;
  phase: StationPhase;
  currentPart?: string;

  /** Waktu awal record produksi */
  entryStart: string | null;
  /** Waktu akhir record produksi */
  entryEnd: string | null;
  /** Timestamp konfirmasi produksi mulai (dandoriStart / actual start) */
  actualStartConfirmedAt: string | null;
  dandoriStart?: string | null;

  /** Info jeda yang terdeteksi */
  gapInfo: { gapStart: string; gapEnd: string } | null;
  /** Form klasifikasi jeda */
  gapForm: { nonproduksi_nama: string };

  /** Pilihan setelah stopProduksi */
  afterFinishChoice: boolean;

  /** Waktu mulai non-produksi aktif */
  nonProdActiveStart: string | null;
  /** Form non-produksi aktif */
  nonProdForm: { nama: string };

  /** Form isi produksi (part, qty, manpower, extra) */
  form: LineForm;

  /** ID planning yang dipilih */
  planningId: string | null;

  /** Routing (khusus Tandem) */
  routingType: "WIP" | "FG" | null;
  routingNumbers: number[];

  /** ID baris production_log yang sedang diedit (fase "edit") */
  editingId: string | null;
  /** Form koreksi manual baris produksi (fase "edit") */
  editForm: Record<string, any> | null;

  /** Kalau true, dandori dipaksa 0 menit ("Langsung Produksi" — skip Setup/Dandori) */
  skipDandori: boolean;
  /** Waktu akhir non-produksi/gap, ditahan sementara selama fase "awaiting_next_choice" */
  _pendingStart: string | null;
}

/** Shape row dari tabel production_log (schema migration_framework_v2.sql) */
export interface ProductionLogRow {
  id: string;
  mesin: string;
  stasiun: string | null;
  waktu_awal: string;
  waktu_akhir: string | null;
  part_number: string | null;
  qty: number | null;
  ng: number | null;
  manpower: number | null;
  dandori_menit: number | null;
  downtime_menit: number | null;
  break_menit: number | null;
  extra: Record<string, any> | null;
  created_at?: string;
  _pending?: boolean;
}

/** Shape row dari tabel dandori_log / non-produksi log */
export interface DandoriLogRow {
  id: string;
  mesin: string;
  stasiun: string | null;
  waktu_awal: string;
  waktu_akhir: string | null;
  kategori: string | null;
  part_dari: string | null;
  part_ke: string | null;
  keterangan: string | null;
  created_at?: string;
  _pending?: boolean;
}

/** Shape row dari tabel nonproduksi_types */
export interface NonProduksiType {
  id: string;
  mesin: string;
  nama: string;
}

/** Shape row dari tabel downtime_log (schema migration_framework_v2.sql) */
export interface DowntimeLogRow {
  id: string;
  mesin: string;
  waktu_awal: string;
  waktu_akhir: string;
  stasiun: string | null;
  kategori: string | null;
  problem: string | null;
  penyebab: string | null;
  countermeasure: string | null;
  production_log_id?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
  _pending?: boolean;
}

/** Shape row dari tabel downtime_problems (master problem per mesin) */
export interface DowntimeProblem {
  id: string;
  mesin: string;
  value: string;
}

/** Combined row untuk display riwayat */
export type CombinedRow =
  | (ProductionLogRow & { _tipe: "produksi" })
  | (DandoriLogRow & { _tipe: "nonproduksi" });
