// Tipe data khusus modul produksi (porting dari project-experiment/types/database.ts)
// Prefix prod_ dipakai di tabel Supabase, tapi interface TypeScript di sini
// tidak ikut diprefiks — bedanya ada di nama tabel saat query, bukan di tipe.

export interface ProdProfile {
  id: string;
  email?: string;
  full_name?: string;
  role?: "admin" | "leader" | "operator" | string;
}

export interface ProdAttendanceRecord {
  id?: string;
  tanggal: string;
  shift?: number;
  total_orang: number;
  hadir: number;
  cuti?: number;
  absen: number;
  overtime_jam?: number;
  catatan?: string;
  created_at?: string;
  _pending?: boolean;
  is_active?: boolean;
}

export interface ProdSafetyRecord {
  id?: string;
  tanggal: string;
  kategori: "ACCIDENT" | "NEAR_MISS" | "OTHER" | string;
  keterangan?: string;
  created_at?: string;
  _pending?: boolean;
  is_active?: boolean;
}

export interface ProdScrapRecord {
  id?: string;
  tahun: number;
  bulan: number;
  scrap_value_kidr: number;
  total_value_kidr?: number;
  target_rasio?: number;
  created_at?: string;
  _pending?: boolean;
  is_active?: boolean;
}

export interface ProdProductivityRecord {
  id?: string;
  tanggal: string;
  eh_jam: number | string;
  created_at?: string;
  is_active?: boolean;
}

export interface ProdExtraField {
  key: string;
  label: string;
  type: "text" | "number";
}

export interface ProdStationConfig {
  mode: "none" | "fixed" | "variant";
  stations?: string[];
  variants?: Record<string, string[]>;
}

export interface ProdMachineConfig {
  slug: string;
  key: string;
  label: string;
  extraFields: ProdExtraField[];
  routingMax: number;
  kategoriOptions: string[];
  stationConfig: ProdStationConfig;
}

export interface ProdMasterPart {
  id?: string;
  kode_part: string;
  nama_part?: string;
  mesin: string;
  ct_detik?: number;
  std_ct?: number;
  mp_std?: number;
  std_mp?: number;
  next_process?: string;
  harga_rp?: number;
  harga_pcs?: number;
  value?: string;
  is_active?: boolean;
}

export interface ProdProductionRecord {
  id?: string;
  tanggal: string;
  shift: number;
  mesin: string;
  part_name: string;
  waktu_mulai: string;
  waktu_selesai?: string;
  total_menit?: number;
  dandori_menit?: number;
  break_menit?: number;
  downtime_menit?: number;
  waktu_kerja_nett?: number;
  ok_qty: number;
  ng_qty: number;
  target_qty?: number;
  pencapaian_persen?: number;
  ratio_stroke_persen?: number;
  routing_no?: number;
  top_coil?: string;
  berat_coil?: number;
  next_process?: string;
  created_at?: string;
  is_active?: boolean;
}

export interface ProdProductionPlanning {
  id?: string;
  mesin: string;
  stasiun?: string | null;
  part_number: string;
  qty_rencana?: number | null;
  jam_rencana_mulai: string;
  jam_rencana_selesai: string;
  status: string;
  actual_production_id?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
  is_active?: boolean;
  _pending?: boolean;
}

export interface ProdDowntimeRecord {
  id?: string;
  produksi_id?: string;
  mesin: string;
  tanggal: string;
  shift: number;
  kategori: string;
  deskripsi: string;
  durasi_menit: number;
  station?: string;
  created_at?: string;
  _pending?: boolean;
  is_active?: boolean;
}

export interface ProdNonProduksiRecord {
  id?: string;
  tanggal: string;
  shift: number;
  mesin: string;
  kegiatan: string;
  durasi_menit: number;
  keterangan?: string;
  created_at?: string;
  is_active?: boolean;
}

export interface ProdSQCDMPRecord {
  id?: string;
  tanggal: string;
  shift: number;
  mesin: string;
  safety?: "OK" | "NG";
  quality?: "OK" | "NG";
  cost?: "OK" | "NG";
  delivery?: "OK" | "NG";
  moral?: "OK" | "NG";
  productivity?: "OK" | "NG";
  catatan?: string;
  created_at?: string;
  is_active?: boolean;
}

// Station State Machine Types
export type ProdStationPhase =
  | "idle"
  | "awaiting_gap"
  | "awaiting_next_choice"
  | "awaiting_actual_start"
  | "running"
  | "finished"
  | "nonproduksi_running"
  | "edit";

export interface ProdLineForm {
  part_number: string;
  qty: number | "";
  manpower: number | "";
  ng: number | "";
  [key: string]: any;
}

export interface ProdLineState {
  stationId?: string;
  phase: ProdStationPhase;
  currentPart?: string;
  entryStart: string | null;
  entryEnd: string | null;
  actualStartConfirmedAt: string | null;
  dandoriStart?: string | null;
  gapInfo: { gapStart: string; gapEnd: string } | null;
  gapForm: { nonproduksi_nama: string };
  afterFinishChoice: boolean;
  nonProdActiveStart: string | null;
  nonProdForm: { nama: string };
  form: ProdLineForm;
  planningId: string | null;
  routingType: "WIP" | "FG" | null;
  routingNumbers: number[];
  editingId: string | null;
  editForm: Record<string, any> | null;
  skipDandori: boolean;
  _pendingStart: string | null;
}

export interface ProdProductionLogRow {
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

export interface ProdDandoriLogRow {
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

export interface ProdNonProduksiType {
  id: string;
  mesin: string;
  nama: string;
}

export interface ProdDowntimeLogRow {
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

export interface ProdDowntimeProblem {
  id: string;
  mesin: string;
  value: string;
}

export type ProdCombinedRow =
  | (ProdProductionLogRow & { _tipe: "produksi" })
  | (ProdDandoriLogRow & { _tipe: "nonproduksi" });

