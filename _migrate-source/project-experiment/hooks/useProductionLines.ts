// =========================================================
// useProductionLines — per-stasiun state machine hook
// Port dari fungsi machinePage() di database-main/assets/machine-page.js
// Mengelola semua stasiun aktif sebagai Record<stationId, LineState>.
// =========================================================

import { useState, useCallback, useEffect } from "react";
import type {
  StationPhase,
  LineState,
  LineForm,
  ProductionLogRow,
  DandoriLogRow,
} from "@/types/station";
import type { MachineConfig, MasterPart, ProductionPlanning } from "@/types/database";

// ---------- Jadwal Shift & Break ----------
const SHIFT1_WEEKDAY: number[][] = [[9,30,9,40],[12,5,12,45],[14,30,14,40],[16,0,16,15],[18,15,18,30]];
const SHIFT1_FRIDAY:  number[][] = [[9,30,9,40],[11,40,12,50],[14,30,14,40],[16,30,16,45],[18,15,18,30]];
const SHIFT2_ALL:     number[][] = [[21,30,21,40],[23,40,0,20],[2,20,2,30],[4,30,5,0]];

function mkDate(base: Date, h: number, m: number, addDay = 0): Date {
  const x = new Date(base);
  x.setDate(x.getDate() + addDay);
  x.setHours(h, m, 0, 0);
  return x;
}

export function shiftPeriodFor(now: Date): { shift: number; start: Date; end: Date } {
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const s1start = mkDate(base, 7, 0);
  const s1end   = mkDate(base, 19, 30);
  if (now >= s1start && now < s1end) return { shift: 1, start: s1start, end: s1end };
  if (now >= s1end) {
    const s2end = mkDate(base, 7, 0, 1);
    return { shift: 2, start: s1end, end: s2end };
  }
  const prevBase   = mkDate(base, 0, 0, -1);
  const prevS2start = mkDate(prevBase, 19, 30);
  return { shift: 2, start: prevS2start, end: s1start };
}

export function breakWindowsForPeriod(period: { shift: number; start: Date }): { start: Date; end: Date }[] {
  const dateAnchor = new Date(period.start);
  dateAnchor.setHours(0, 0, 0, 0);
  const out: { start: Date; end: Date }[] = [];
  if (period.shift === 1) {
    const sched = dateAnchor.getDay() === 5 ? SHIFT1_FRIDAY : SHIFT1_WEEKDAY;
    sched.forEach(([sh, sm, eh, em]) =>
      out.push({ start: mkDate(dateAnchor, sh, sm), end: mkDate(dateAnchor, eh, em) })
    );
  } else {
    SHIFT2_ALL.forEach(([sh, sm, eh, em]) => {
      out.push({
        start: mkDate(dateAnchor, sh, sm, sh < 19 ? 1 : 0),
        end:   mkDate(dateAnchor, eh, em, eh < 19 ? 1 : 0),
      });
    });
  }
  return out;
}

/**
 * Berapa menit dari [waIso, wkIso] yang jatuh di jadwal break resmi.
 * Port dari computeBreakMinutes() di machine-page.js.
 */
export function computeBreakMinutes(waIso: string, wkIso: string): number {
  const wa = new Date(waIso);
  const wk = new Date(wkIso);
  const period = shiftPeriodFor(wa);
  const windows = breakWindowsForPeriod(period);
  let total = 0;
  windows.forEach((w) => {
    const os = Math.max(w.start.getTime(), wa.getTime());
    const oe = Math.min(w.end.getTime(), wk.getTime());
    if (oe > os) total += (oe - os) / 60000;
  });
  return Math.round(total);
}

/** Konversi ISO string ke value input datetime-local ("yyyy-MM-ddTHH:mm"). Port dari toLocalInput(). */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Cari waktu_akhir TERAKHIR (produksi ATAU non-produksi) di stasiun ini. */
export function lastEventEndFor(
  stationDbId: string | null,
  productionRows: ProductionLogRow[],
  nonProduksiRows: DandoriLogRow[]
): Date | null {
  const match = (r: { stasiun?: string | null }) => (r.stasiun || null) === stationDbId;
  const prodEnds = productionRows.filter(match).map((r) => new Date(r.waktu_akhir || 0).getTime()).filter(Boolean);
  const npEnds   = nonProduksiRows.filter(match).map((r) => new Date(r.waktu_akhir || 0).getTime()).filter(Boolean);
  const all = [...prodEnds, ...npEnds];
  if (all.length === 0) return null;
  return new Date(Math.max(...all));
}

/** Buat LineState kosong (port dari freshLine()) */
function freshLine(): LineState {
  return {
    phase: "idle",
    entryStart: null,
    entryEnd: null,
    actualStartConfirmedAt: null,
    gapInfo: null,
    gapForm: { nonproduksi_nama: "" },
    afterFinishChoice: false,
    nonProdActiveStart: null,
    nonProdForm: { nama: "" },
    form: { part_number: "", qty: "", manpower: "", ng: "" },
    planningId: null,
    routingType: null,
    routingNumbers: [],
    editingId: null,
    editForm: null,
    skipDandori: false,
    _pendingStart: null,
  };
}

/** Bangun Record<stationId, LineState> untuk stasiun yang diberikan. */
function buildInitialLines(stationIds: string[]): Record<string, LineState> {
  const out: Record<string, LineState> = {};
  stationIds.forEach((id) => { out[id] = freshLine(); });
  return out;
}

// ---------- LocalStorage ----------
function lsKey(machineKey: string) {
  return `linestate_v3_${machineKey}`;
}

export function loadFromLocalStorage(machineKey: string): { tandemVariant?: string; lines?: Record<string, Partial<LineState>> } {
  try {
    const raw = localStorage.getItem(lsKey(machineKey));
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveToLocalStorage(machineKey: string, tandemVariant: string | null, lines: Record<string, LineState>) {
  try {
    const toSave: Record<string, LineState> = {};
    Object.entries(lines).forEach(([id, l]) => {
      if (l.phase !== "idle") toSave[id] = l;
    });
    localStorage.setItem(lsKey(machineKey), JSON.stringify({ tandemVariant, lines: toSave }));
  } catch { /* storage full */ }
}

// =========================================================
// Hook Utama Options & Payload Interfaces
// =========================================================

export interface CommitPayload {
  mesin: string;
  stasiun: string | null;
  waktu_awal: string;
  waktu_akhir: string;
  part_number: string;
  qty: number | null;
  ng: number | null;
  manpower: number | null;
  dandori_menit: number;
  break_menit: number;
  extra: Record<string, any>;
  planningId: string | null;
}

export interface UpdatePayload {
  waktu_awal: string;
  waktu_akhir: string;
  part_number: string | null;
  qty: number | null;
  manpower: number | null;
  ng: number | null;
  dandori_menit: number | null;
  break_menit: number | null;
  extra: Record<string, any>;
}

export interface NonProdPayload {
  mesin: string;
  stasiun: string | null;
  waktu_awal: string;
  waktu_akhir: string;
  kategori: string;
  part_dari: null;
  part_ke: string;
  keterangan: string;
}

export interface UseProductionLinesOptions {
  config: MachineConfig;
  tandemVariant: string | null;
  /** Semua baris production_log mesin ini (untuk lastEventEnd) */
  productionRows: ProductionLogRow[];
  /** Semua baris dandori_log mesin ini (untuk lastEventEnd) */
  nonProduksiRows: DandoriLogRow[];
  /** Semua part number untuk autofillManpower */
  masterParts: MasterPart[];
  /** Handler commit produksi */
  onCommitProduction: (
    stationId: string,
    stationDbId: string | null,
    payload: CommitPayload
  ) => Promise<void>;
  /** Handler simpan non-produksi */
  onSaveNonProduksi: (
    stationId: string,
    stationDbId: string | null,
    payload: NonProdPayload
  ) => Promise<void>;
  /** Handler update (koreksi manual) baris produksi — port dari saveEditProduction() */
  onUpdateProduction: (
    stationId: string,
    stationDbId: string | null,
    id: string,
    payload: UpdatePayload
  ) => Promise<void>;
  onError: (msg: string) => void;
}

export function useProductionLines(stationIds: string[], opts: UseProductionLinesOptions) {
  const {
    config,
    tandemVariant,
    productionRows,
    nonProduksiRows,
    masterParts,
    onCommitProduction,
    onSaveNonProduksi,
    onUpdateProduction,
    onError,
  } = opts;

  const [lines, setLines] = useState<Record<string, LineState>>(() => {
    const initial = buildInitialLines(stationIds);
    const saved = loadFromLocalStorage(config.key);
    if (saved.lines) {
      Object.entries(saved.lines).forEach(([id, saved_line]) => {
        if (initial[id] && saved_line.phase && saved_line.phase !== "idle") {
          initial[id] = { ...freshLine(), ...saved_line } as LineState;
        }
      });
    }
    return initial;
  });

  // Sinkronkan jika stationIds berubah (misal tandem variant switch)
  useEffect(() => {
    setLines((prev) => {
      const next: Record<string, LineState> = {};
      stationIds.forEach((id) => {
        next[id] = prev[id] || freshLine();
      });
      return next;
    });
  }, [stationIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-persist setiap kali lines berubah
  useEffect(() => {
    saveToLocalStorage(config.key, tandemVariant, lines);
  }, [lines, tandemVariant, config.key]);

  // ---------- Helpers ----------

  const getLine = (stId: string): LineState => lines[stId] || freshLine();

  const mutateLine = useCallback(
    (stId: string, update: Partial<LineState> | ((prev: LineState) => Partial<LineState>)) => {
      setLines((prev) => {
        const current = prev[stId] || freshLine();
        const patch = typeof update === "function" ? update(current) : update;
        return { ...prev, [stId]: { ...current, ...patch } };
      });
    },
    []
  );

  const dbStasiun = (stationId: string): string | null =>
    stationId === "_single" ? null : stationId;

  function stdMpFor(partNumber: string): number | null {
    const p = masterParts.find(
      (x) => x.value === partNumber || x.kode_part === partNumber || x.nama_part === partNumber
    );
    const mp = p?.std_mp ?? (p as any)?.mp_std;
    return mp !== null && mp !== undefined && mp !== "" ? Number(mp) : null;
  }

  // ---------- Actions ----------

  /**
   * clickMulai — port dari clickMulai(stationId) di machine-page.js
   */
  const clickMulai = useCallback(
    (stId: string) => {
      const line = getLine(stId);

      if (line.phase === "nonproduksi_running") {
        if (!line.nonProdForm.nama) {
          onError("Pilih jenis non-produksi dulu sebelum lanjut.");
          return;
        }
        const now = new Date().toISOString();
        const payload: NonProdPayload = {
          mesin: config.key,
          stasiun: dbStasiun(stId),
          waktu_awal: line.nonProdActiveStart || now,
          waktu_akhir: now,
          kategori: "OTHER",
          part_dari: null,
          part_ke: line.nonProdForm.nama,
          keterangan: line.nonProdForm.nama,
        };
        // Optimistic: pindah UI ke fase berikutnya dulu, simpan ke Supabase
        // di background — supaya tidak terasa delay di jaringan lambat pabrik.
        mutateLine(stId, (prev) => ({
          ...freshLine(),
          phase: "awaiting_next_choice",
          _pendingStart: now,
        }));
        onSaveNonProduksi(stId, dbStasiun(stId), payload);
        return;
      }

      if (line.phase !== "idle") return;

      const now = new Date();
      const period = shiftPeriodFor(now);
      const last = lastEventEndFor(dbStasiun(stId), productionRows, nonProduksiRows);
      const clampedStart = last && last > period.start ? last : period.start;

      if (clampedStart < now) {
        // Ada jeda — minta klasifikasi
        mutateLine(stId, {
          phase: "awaiting_gap",
          gapInfo: { gapStart: clampedStart.toISOString(), gapEnd: now.toISOString() },
          gapForm: { nonproduksi_nama: "" },
        });
      } else {
        // Tidak ada jeda — langsung buka part selection
        mutateLine(stId, {
          phase: "awaiting_actual_start",
          entryStart: now.toISOString(),
          form: { ...freshLine().form },
          planningId: null,
          routingType: null,
          routingNumbers: [],
        });
      }
    },
    [lines, config.key, productionRows, nonProduksiRows, onSaveNonProduksi, onError, mutateLine]
  );

  /** Batal klasifikasi jeda — kembali ke idle */
  const cancelGapNonProduksi = useCallback(
    (stId: string) => {
      mutateLine(stId, { phase: "idle", gapInfo: null, gapForm: { nonproduksi_nama: "" } });
    },
    [mutateLine]
  );

  /** Konfirmasi jeda sebagai non-produksi, lanjut ke part selection */
  const confirmGapNonProduksi = useCallback(
    (stId: string) => {
      const line = getLine(stId);
      const nama = line.gapForm.nonproduksi_nama;
      if (!nama) { onError("Pilih jenis non-produksi dulu."); return; }
      const payload: NonProdPayload = {
        mesin: config.key,
        stasiun: dbStasiun(stId),
        waktu_awal: line.gapInfo!.gapStart,
        waktu_akhir: line.gapInfo!.gapEnd,
        kategori: "OTHER",
        part_dari: null,
        part_ke: nama,
        keterangan: nama,
      };
      // Optimistic: pindah state dulu, simpan di background.
      mutateLine(stId, {
        phase: "awaiting_next_choice",
        _pendingStart: payload.waktu_akhir,
        gapInfo: null,
        gapForm: { nonproduksi_nama: "" },
      });
      onSaveNonProduksi(stId, dbStasiun(stId), payload);
    },
    [lines, config.key, onSaveNonProduksi, onError, mutateLine]
  );

  /**
   * chooseAfterNonProduksi — port dari chooseAfterNonProduksi(stationId, mode) di
   * machine-page.js. Dipanggil setelah non-produksi/jeda selesai (fase
   * "awaiting_next_choice"): "setup" lanjut Dandori normal, "direct" set
   * skipDandori supaya _commitLine menghitung dandori 0 menit.
   */
  const chooseAfterNonProduksi = useCallback(
    (stId: string, mode: "setup" | "direct") => {
      const line = getLine(stId);
      const startIso = line._pendingStart || new Date().toISOString();
      mutateLine(stId, {
        phase: "awaiting_actual_start",
        entryStart: startIso,
        skipDandori: mode === "direct",
        _pendingStart: null,
        form: { ...freshLine().form },
        planningId: null,
        routingType: null,
        routingNumbers: [],
      });
    },
    [lines, mutateLine]
  );

  /** Pilih part dari daftar planning */
  const choosePlannedPart = useCallback(
    (stId: string, planItem: ProductionPlanning) => {
      const mp = stdMpFor(planItem.part_number);
      mutateLine(stId, (prev) => ({
        form: {
          ...prev.form,
          part_number: planItem.part_number,
          qty: planItem.qty_rencana ?? "",
          manpower: mp !== null ? mp : prev.form.manpower,
        },
        planningId: planItem.id || null,
      }));
    },
    [masterParts, mutateLine]
  );

  /** Update satu field di form */
  const setFormField = useCallback(
    (stId: string, key: string, value: any) => {
      mutateLine(stId, (prev) => ({ form: { ...prev.form, [key]: value } }));
      if (key === "part_number") {
        const mp = stdMpFor(value);
        if (mp !== null) {
          mutateLine(stId, (prev) => ({ form: { ...prev.form, manpower: mp } }));
        }
      }
    },
    [masterParts, mutateLine]
  );

  const setGapFormField = useCallback(
    (stId: string, key: string, value: any) => {
      mutateLine(stId, (prev) => ({ gapForm: { ...prev.gapForm, [key]: value } }));
    },
    [mutateLine]
  );

  const setNonProdFormField = useCallback(
    (stId: string, key: string, value: any) => {
      mutateLine(stId, (prev) => ({ nonProdForm: { ...prev.nonProdForm, [key]: value } }));
    },
    [mutateLine]
  );

  const toggleRoutingNumber = useCallback(
    (stId: string, n: number) => {
      mutateLine(stId, (prev) => {
        const cur = prev.routingNumbers;
        const idx = cur.indexOf(n);
        return { routingNumbers: idx === -1 ? [...cur, n] : cur.filter((x) => x !== n) };
      });
    },
    [mutateLine]
  );

  const setRoutingType = useCallback(
    (stId: string, type: "WIP" | "FG" | null) => {
      mutateLine(stId, { routingType: type, routingNumbers: [] });
    },
    [mutateLine]
  );

  /** Konfirmasi produksi mulai → hitung dandori dari entryStart sampai sekarang */
  const confirmActualStart = useCallback(
    (stId: string) => {
      const line = getLine(stId);
      if (!line.form.part_number) { onError("Pilih Part Number dulu."); return; }
      mutateLine(stId, {
        phase: "running",
        actualStartConfirmedAt: new Date().toISOString(),
      });
    },
    [lines, onError, mutateLine]
  );

  /** Hentikan produksi */
  const stopProduksi = useCallback(
    (stId: string) => {
      mutateLine(stId, {
        phase: "finished",
        entryEnd: new Date().toISOString(),
        afterFinishChoice: true,
      });
    },
    [mutateLine]
  );

  /** Batal keseluruhan (reset ke idle) */
  const cancelLine = useCallback(
    (stId: string) => {
      mutateLine(stId, freshLine());
    },
    [mutateLine]
  );

  /** Commit record produksi ke DB */
  const _commitLine = useCallback(
    async (stId: string) => {
      const line = getLine(stId);
      const dandoriMenit = line.skipDandori
        ? 0
        : (line.actualStartConfirmedAt && line.entryStart
            ? Math.round((new Date(line.actualStartConfirmedAt).getTime() - new Date(line.entryStart).getTime()) / 60000)
            : 0);
      const breakMenit = (line.entryStart && line.entryEnd)
        ? computeBreakMinutes(line.entryStart, line.entryEnd)
        : 0;

      const extra: Record<string, any> = {};
      config.extraFields.forEach((f) => { if (line.form[f.key]) extra[f.key] = line.form[f.key]; });
      if (config.routingMax > 0) {
        extra.routing_type = line.routingType;
        extra.routing_numbers = line.routingNumbers;
      }

      const payload: CommitPayload = {
        mesin: config.key,
        stasiun: dbStasiun(stId),
        waktu_awal: line.entryStart || new Date().toISOString(),
        waktu_akhir: line.entryEnd || new Date().toISOString(),
        part_number: line.form.part_number,
        qty: line.form.qty === "" ? null : Number(line.form.qty),
        ng: line.form.ng === "" ? null : Number(line.form.ng),
        manpower: line.form.manpower === "" ? null : Number(line.form.manpower),
        dandori_menit: dandoriMenit,
        break_menit: breakMenit,
        extra,
        planningId: line.planningId,
      };
      await onCommitProduction(stId, dbStasiun(stId), payload);
    },
    [lines, config, onCommitProduction]
  );

  /** Selesai → Setup (ganti part berikutnya) */
  const chooseSetupNext = useCallback(
    (stId: string) => {
      const line = getLine(stId);
      const endTime = line.entryEnd || new Date().toISOString();
      // Optimistic: commit di background, UI pindah fase dulu.
      _commitLine(stId);
      mutateLine(stId, {
        ...freshLine(),
        phase: "awaiting_actual_start",
        entryStart: endTime,
        form: { ...freshLine().form },
      });
    },
    [_commitLine, lines, mutateLine]
  );

  /** Selesai → Non-Produksi aktif */
  const chooseNonProduksiNext = useCallback(
    (stId: string) => {
      const line = getLine(stId);
      const endTime = line.entryEnd || new Date().toISOString();
      // Optimistic: commit di background, UI pindah fase dulu.
      _commitLine(stId);
      mutateLine(stId, {
        ...freshLine(),
        phase: "nonproduksi_running",
        nonProdActiveStart: endTime,
        nonProdForm: { nama: "" },
      });
    },
    [_commitLine, lines, mutateLine]
  );

  /** Tutup non-produksi dan stop */
  const endNonProduksiAndStop = useCallback(
    (stId: string) => {
      const line = getLine(stId);
      const nama = line.nonProdForm.nama;
      if (!nama) { onError("Pilih jenis non-produksi dulu."); return; }
      const now = new Date().toISOString();
      const payload: NonProdPayload = {
        mesin: config.key,
        stasiun: dbStasiun(stId),
        waktu_awal: line.nonProdActiveStart || now,
        waktu_akhir: now,
        kategori: "OTHER",
        part_dari: null,
        part_ke: nama,
        keterangan: nama,
      };
      // Optimistic: reset UI dulu, simpan di background.
      mutateLine(stId, freshLine());
      onSaveNonProduksi(stId, dbStasiun(stId), payload);
    },
    [lines, config.key, onSaveNonProduksi, onError, mutateLine]
  );

  /**
   * startEditProduction — port dari editProduction(row) di machine-page.js.
   * Mengisi editForm dari baris production_log dan memindahkan line ke fase "edit".
   */
  const startEditProduction = useCallback(
    (stId: string, row: ProductionLogRow) => {
      const editForm: Record<string, any> = {
        waktu_awal: toLocalInput(row.waktu_awal),
        waktu_akhir: toLocalInput(row.waktu_akhir),
        part_number: row.part_number || "",
        qty: row.qty ?? "",
        manpower: row.manpower ?? "",
        ng: row.ng ?? "",
        dandori_menit: row.dandori_menit ?? "",
        break_menit: row.break_menit ?? "",
      };
      config.extraFields.forEach((f) => {
        editForm[f.key] = row.extra?.[f.key] ?? "";
      });
      mutateLine(stId, {
        phase: "edit",
        editingId: row.id,
        entryStart: row.waktu_awal,
        entryEnd: row.waktu_akhir,
        editForm,
        routingType: (row.extra?.routing_type as "WIP" | "FG" | null) ?? null,
        routingNumbers: row.extra?.routing_numbers ?? [],
      });
    },
    [config, mutateLine]
  );

  /** Update satu field di editForm */
  const setEditFormField = useCallback(
    (stId: string, key: string, value: any) => {
      mutateLine(stId, (prev) => ({ editForm: { ...(prev.editForm || {}), [key]: value } }));
    },
    [mutateLine]
  );

  /** Batal koreksi manual — kembali ke idle */
  const cancelEditProduction = useCallback(
    (stId: string) => {
      mutateLine(stId, freshLine());
    },
    [mutateLine]
  );

  /**
   * saveEditProduction — port dari saveEditProduction(stationId) di machine-page.js.
   * Update baris production_log via onUpdateProduction, lalu reset line ke idle.
   */
  const saveEditProduction = useCallback(
    (stId: string) => {
      const line = getLine(stId);
      const f = line.editForm;
      if (!f || !line.editingId) return;

      const extra: Record<string, any> = {};
      config.extraFields.forEach((field) => {
        extra[field.key] = f[field.key] === "" ? null : f[field.key];
      });
      if (config.routingMax > 0) {
        extra.routing_type = line.routingType;
        extra.routing_numbers = line.routingNumbers;
      }

      const payload: UpdatePayload = {
        waktu_awal: new Date(f.waktu_awal).toISOString(),
        waktu_akhir: new Date(f.waktu_akhir).toISOString(),
        part_number: f.part_number || null,
        qty: f.qty === "" ? null : Number(f.qty),
        manpower: f.manpower === "" ? null : Number(f.manpower),
        ng: f.ng === "" ? null : Number(f.ng),
        dandori_menit: f.dandori_menit === "" ? null : Number(f.dandori_menit),
        break_menit: f.break_menit === "" ? null : Number(f.break_menit),
        extra,
      };

      const editingId = line.editingId;
      // Optimistic: keluar dari mode edit dulu, simpan di background.
      mutateLine(stId, freshLine());
      onUpdateProduction(stId, dbStasiun(stId), editingId, payload);
    },
    [lines, config, onUpdateProduction, mutateLine]
  );

  return {
    lines,
    getLine,
    // Actions
    clickMulai,
    cancelGapNonProduksi,
    confirmGapNonProduksi,
    chooseAfterNonProduksi,
    choosePlannedPart,
    setFormField,
    setGapFormField,
    setNonProdFormField,
    toggleRoutingNumber,
    setRoutingType,
    confirmActualStart,
    stopProduksi,
    cancelLine,
    chooseSetupNext,
    chooseNonProduksiNext,
    endNonProduksiAndStop,
    startEditProduction,
    setEditFormField,
    cancelEditProduction,
    saveEditProduction,
  };
}
