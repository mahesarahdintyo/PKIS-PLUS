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
}

export interface ProdSafetyRecord {
  id?: string;
  tanggal: string;
  kategori: "ACCIDENT" | "NEAR_MISS" | "OTHER" | string;
  keterangan?: string;
  created_at?: string;
  _pending?: boolean;
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
}

export interface ProdProductivityRecord {
  id?: string;
  tanggal: string;
  eh_jam: number | string;
  created_at?: string;
}
