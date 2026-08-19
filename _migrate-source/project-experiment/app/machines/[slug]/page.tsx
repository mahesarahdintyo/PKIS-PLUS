"use client";

import React, { useState, useEffect, useCallback, use, useRef } from "react";
import Chart from "chart.js/auto";
import HeaderNav from "@/components/HeaderNav";
import { useThemeListener } from "@/hooks/useThemeListener";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabaseClient";
import {
  MachineConfig,
  MasterPart,
  Profile,
  ProductionPlanning,
} from "@/types/database";
import {
  ProductionLogRow,
  DandoriLogRow,
  NonProduksiType,
  DowntimeLogRow,
  DowntimeProblem,
} from "@/types/station";
import {
  useProductionLines,
  CommitPayload,
  NonProdPayload,
  UpdatePayload,
  toLocalInput,
  loadFromLocalStorage,
} from "@/hooks/useProductionLines";
import { enqueueOffline, isNetworkError } from "@/lib/offlineQueue";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useFlash } from "@/hooks/useFlash";
import { usePanggilLeader } from "@/hooks/useAndon";
import {
  Bell,
  Sun,
  Moon,
  Play,
  Square,
  CheckCircle,
  Wrench,
  Timer,
  Pencil,
  X,
  FilterX,
} from "lucide-react";

const MACHINE_CONFIGS: Record<string, MachineConfig> = {
  blanking: {
    slug: "blanking",
    key: "blanking",
    label: "Blanking",
    extraFields: [
      { key: "top_coil", label: "Top Coil", type: "text" },
      { key: "berat_coil", label: "Berat Coil (kg)", type: "number" },
    ],
    routingMax: 0,
    kategoriOptions: ["MESIN", "DIES", "OTHER"],
    stationConfig: { mode: "none" },
  },
  pc200t: {
    slug: "pc200t",
    key: "pc200t",
    label: "PC200t",
    extraFields: [],
    routingMax: 0,
    kategoriOptions: ["MESIN", "DIES", "OTHER"],
    stationConfig: { mode: "fixed", stations: ["PC-1", "PC-2"] },
  },
  tandem: {
    slug: "tandem",
    key: "tandem",
    label: "Tandem",
    extraFields: [],
    routingMax: 8,
    kategoriOptions: ["MESIN", "DIES", "OTHER"],
    stationConfig: {
      mode: "variant",
      variants: {
        lama: ["PA-1", "PA-2", "PA-3", "PA-4", "PA-5"],
        baru: ["PA-6", "PA-7", "PA-8", "PA-9", "PA-10"],
      },
    },
  },
  "transfer-2000t": {
    slug: "transfer-2000t",
    key: "transfer_2000t",
    label: "Transfer 2000t",
    extraFields: [],
    routingMax: 0,
    kategoriOptions: ["MESIN", "DIES", "FINGER", "OTHER"],
    stationConfig: { mode: "none" },
  },
  "transfer-800t": {
    slug: "transfer-800t",
    key: "transfer_800t",
    label: "Transfer 800t",
    extraFields: [],
    routingMax: 0,
    kategoriOptions: ["MESIN", "DIES", "FINGER", "OTHER"],
    stationConfig: { mode: "none" },
  },
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Combobox autocomplete untuk field Problem — port dari Alpine.data("comboBox", ...)
// di machine-page.js. Controlled dari luar lewat value/onChange, query lokal dipakai
// untuk filter daftar opsi sambil tetap bisa ketik value bebas (bukan cuma dari list).
function ProblemCombobox({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = (() => {
    const q = (value || "").toLowerCase();
    if (!q) return options.slice(0, 50);
    return options.filter((o) => o.toLowerCase().includes(q)).slice(0, 50);
  })();

  return (
    <div className="combo" ref={wrapRef}>
      <Input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Ketik atau pilih..."
      />
      {open && filtered.length > 0 && (
        <div className="combo-list">
          {filtered.map((opt) => (
            <div
              key={opt}
              className="combo-item"
              onMouseDown={(e) => { e.preventDefault(); onChange(opt); setOpen(false); }}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Modal global (fixed overlay) — dipakai untuk Edit Produksi & Edit Non-Produksi
// supaya bisa dibuka dari scroll/tab manapun, bukan cuma inline di dalam kartu stasiun.
function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent onClose={onClose} maxWidth="max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

// Chip selector 1-5 untuk "Jumlah MP" (menggantikan input number di modal edit)
function ManpowerChips({
  value,
  onChange,
}: {
  value: number | "";
  onChange: (n: number) => void;
}) {
  return (
    <div className="chip-row">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`chip chip-num ${Number(value) === n ? "chip-active" : ""}`}
          onClick={() => onChange(n)}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export default function MachineDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug || "tandem";

  const config = MACHINE_CONFIGS[slug] || MACHINE_CONFIGS["tandem"];

  const [activeTab, setActiveTab] = useState<"produksi" | "riwayat" | "performance" | "downtime" | "master_data">("produksi");
  const [loading, setLoading] = useState(true);

  const theme = useThemeListener();

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    localStorage.setItem("theme_v1", nextTheme);
    if (nextTheme === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    document.documentElement.setAttribute("data-theme", nextTheme);
    window.dispatchEvent(new Event("themeChange"));
  };

  // Flash message (pengganti alert() blocking) — port dari flash() di machine-page.js
  const { successMsg, errorMsg, flash } = useFlash();

  // Tandem Line Variant State ('lama' | 'baru' | null) — persist ke localStorage
  // (key `linestate_v3_${mesin}`, sama dengan yang dipakai useProductionLines untuk
  // menyimpan state per-stasiun) supaya tidak hilang saat reload/pindah tab.
  const [tandemVariant, setTandemVariant] = useState<"lama" | "baru" | null>(() => {
    if (config.stationConfig.mode !== "variant") return null;
    const saved = loadFromLocalStorage(config.key).tandemVariant;
    return saved === "lama" || saved === "baru" ? saved : null;
  });

  // Profile & Role State
  const [profile, setProfile] = useState<Profile | null>(null);
  const isLeaderOrAdmin = profile && ["admin", "leader"].includes(profile.role || "");

  // Andon — panggil leader
  const { andonCalling, panggilLeader } = usePanggilLeader({
    mesin: config.key,
    triggeredBy: profile?.id || null,
    onDone: (msg, isError) => flash(msg, isError),
  });

  // Target GSPH & Availability / Mesin Settings State
  const [mesinSettings, setMesinSettings] = useState<{
    gsph_target_mode: "fixed" | "per_part";
    gsph_target_fixed: number;
    target_availability: number;
  }>({
    gsph_target_mode: "fixed",
    gsph_target_fixed: 0,
    target_availability: 0,
  });

  const [mesinSettingsDraft, setMesinSettingsDraft] = useState<{
    gsph_target_mode: "fixed" | "per_part";
    gsph_target_fixed: number | "";
    target_availability: number | "";
  }>({
    gsph_target_mode: "fixed",
    gsph_target_fixed: 0,
    target_availability: 0,
  });

  // Master Data CRUD Part Number State
  const [newPartKode, setNewPartKode] = useState("");
  const [newPartNama, setNewPartNama] = useState("");
  const [newPartStdCt, setNewPartStdCt] = useState<number | "">("");
  const [newPartNextProcess, setNewPartNextProcess] = useState("");
  const [newPartHarga, setNewPartHarga] = useState<number | "">("");

  const [editingPartId, setEditingPartId] = useState<string | null>(null);
  const [editPartForm, setEditPartForm] = useState<{
    kode_part: string;
    nama_part: string;
    std_ct: number | "";
    next_process: string;
    harga_rp: number | "";
  }>({
    kode_part: "",
    nama_part: "",
    std_ct: "",
    next_process: "",
    harga_rp: "",
  });

  // Master Data CRUD Jenis Non-Produksi State
  const [newNonProduksiTypeValue, setNewNonProduksiTypeValue] = useState("");

  // Master Data CRUD Daftar Problem Downtime State
  const [newProblemValue, setNewProblemValue] = useState("");
  const [editingProblemId, setEditingProblemId] = useState<string | null>(null);
  const [editProblemValue, setEditProblemValue] = useState("");

  // Filter Riwayat
  const [riwayatTanggalDari, setRiwayatTanggalDari] = useState("");
  const [riwayatTanggalSampai, setRiwayatTanggalSampai] = useState("");
  const [riwayatPartNumber, setRiwayatPartNumber] = useState("");
  const [riwayatGabungan, setRiwayatGabungan] = useState<any[]>([]);
  const [riwayatHariIni, setRiwayatHariIni] = useState<any[]>([]);
  const [downtimeFilterProductionId, setDowntimeFilterProductionId] = useState<string | null>(null);
  const [downtimeFilterLabel, setDowntimeFilterLabel] = useState("");
  const [riwayatDeleteTarget, setRiwayatDeleteTarget] = useState<any | null>(null);
  const [isDeletingRiwayat, setIsDeletingRiwayat] = useState(false);
  const [editingNonProduksiId, setEditingNonProduksiId] = useState<string | null>(null);
  const [nonProduksiEditForm, setNonProduksiEditForm] = useState<{
    waktu_awal: string;
    waktu_akhir: string;
    nama: string;
  }>({ waktu_awal: "", waktu_akhir: "", nama: "" });
  // Planning Form State per Station
  const [newPlanningForm, setNewPlanningForm] = useState<Record<string, {
    part_number: string;
    qty_rencana: number | "";
    jam_mulai: string;
    jam_selesai: string;
  }>>({});

  // Catat Downtime — timer & form state (port dari dtState/dtForm di machine-page.js)
  const [dtState, setDtState] = useState<"idle" | "running" | "stopped">("idle");
  const [dtStart, setDtStart] = useState<string | null>(null);
  const [dtEnd, setDtEnd] = useState<string | null>(null);
  const [editingDowntimeId, setEditingDowntimeId] = useState<string | null>(null);
  const [dtForm, setDtForm] = useState<{
    stasiun: string;
    kategori: string;
    problem: string;
    penyebab: string;
    countermeasure: string;
  }>({ stasiun: "", kategori: "", problem: "", penyebab: "", countermeasure: "" });
  const [problemList, setProblemList] = useState<DowntimeProblem[]>([]);

  // Data lists
  const [masterParts, setMasterParts] = useState<MasterPart[]>([]);
  const [downtimeList, setDowntimeList] = useState<DowntimeLogRow[]>([]);
  const [planningList, setPlanningList] = useState<ProductionPlanning[]>([]);

  // Framework v2 production_log and dandori_log states (for useProductionLines hook)
  const [productionRows, setProductionRows] = useState<ProductionLogRow[]>([]);
  const [nonProduksiRows, setNonProduksiRows] = useState<DandoriLogRow[]>([]);
  const [nonProduksiTypes, setNonProduksiTypes] = useState<NonProduksiType[]>([]);

  // Performance Tab State
  const [activePerfSection, setActivePerfSection] = useState<"tahunan" | "bulanan" | "harian">("tahunan");
  const [perfYear, setPerfYear] = useState<number>(new Date().getFullYear());
  const [perfMonth, setPerfMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [perfDate, setPerfDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [perfLoading, setPerfLoading] = useState<boolean>(false);

  const [perfData, setPerfData] = useState<{
    data: {
      stroke: number;
      ng: number;
      downtimeMenit: number;
      dandoriMenit: number;
      breakMenit: number;
      whJam: number;
      gsph: number;
      targetGsph: number;
      availability: number;
      performanceFactor: number;
      quality: number;
      oee: number;
    } | null;
    trend: { label: string; gsph: number | null; targetGsph: number | null; separator?: boolean; kindYear?: boolean }[];
    top5: { kategori: string; problem: string; menit: number }[];
    byCategory: { kategori: string; menit: number }[];
  }>({
    data: null,
    trend: [],
    top5: [],
    byCategory: [],
  });

  const [perfDayRows, setPerfDayRows] = useState<any[]>([]);

  // Chart Canvas Refs for Performance Tab
  const perfChartRef = useRef<HTMLCanvasElement | null>(null);
  const perfPieRef = useRef<HTMLCanvasElement | null>(null);
  const perfChartInstancesRef = useRef<Record<string, Chart>>({});

  // Helper Station List & DB Stasiun mapper
  const stationList = useCallback(() => {
    const cfg = config.stationConfig;
    if (cfg.mode === "fixed") return cfg.stations?.map((id) => ({ id, label: id })) || [];
    if (cfg.mode === "variant") {
      if (!tandemVariant) return [];
      return cfg.variants?.[tandemVariant]?.map((id) => ({ id, label: id })) || [];
    }
    return [{ id: "_single", label: null }];
  }, [config.stationConfig, tandemVariant]);

  const dbStasiun = (stationId: string) => (stationId === "_single" ? null : stationId);

  // Fetch Profile on Mount
  useEffect(() => {
    async function fetchProfile() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .maybeSingle();
        if (data) setProfile(data as Profile);
      }
    }
    fetchProfile();
  }, []);

  // Data Loading
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Mesin Settings
      const { data: settingsData } = await supabase
        .from("mesin_settings")
        .select("*")
        .eq("mesin", config.key)
        .maybeSingle();

      if (settingsData) {
        setMesinSettings({
          gsph_target_mode: settingsData.gsph_target_mode || "fixed",
          gsph_target_fixed: Number(settingsData.gsph_target_fixed) || 0,
          target_availability: Number(settingsData.target_availability) || 0,
        });
        setMesinSettingsDraft({
          gsph_target_mode: settingsData.gsph_target_mode || "fixed",
          gsph_target_fixed: settingsData.gsph_target_fixed ?? 0,
          target_availability: settingsData.target_availability ?? 0,
        });
      }

      // 2. Fetch Master Parts (check part_numbers first, fallback to master_part)
      const { data: pNumData, error: pNumErr } = await supabase
        .from("part_numbers")
        .select("*")
        .eq("mesin", config.key)
        .order("value");

      if (!pNumErr && pNumData && pNumData.length > 0) {
        const mappedParts: MasterPart[] = pNumData.map((p: any) => ({
          id: p.id,
          kode_part: p.value || p.kode_part || "",
          nama_part: p.nama_part || p.value || "",
          mesin: p.mesin,
          std_ct: p.std_ct ?? (p.ct_detik ? p.ct_detik / 60 : undefined),
          ct_detik: p.ct_detik ?? (p.std_ct ? p.std_ct * 60 : undefined),
          std_mp: p.std_mp ?? p.mp_std,
          mp_std: p.mp_std ?? p.std_mp,
          next_process: p.next_process || (Array.isArray(p.next_processes) ? p.next_processes.map((np: any) => `${np.line}:${np.part_number}`).join(", ") : undefined),
          harga_rp: p.harga_pcs ?? p.harga_rp,
          harga_pcs: p.harga_pcs ?? p.harga_rp,
          value: p.value || p.kode_part,
        }));
        setMasterParts(mappedParts);
      } else {
        const { data: parts } = await supabase
          .from("master_part")
          .select("*")
          .eq("mesin", config.key);
        if (parts) setMasterParts(parts as MasterPart[]);
      }

      // 3. Fetch Production Log
      const { data: pRows } = await supabase
        .from("production_log")
        .select("*")
        .eq("mesin", config.key)
        .order("waktu_awal", { ascending: false })
        .limit(500);
      if (pRows) setProductionRows(pRows as ProductionLogRow[]);

      // 4. Fetch Downtime Log
      const { data: dt } = await supabase
        .from("downtime_log")
        .select("*")
        .eq("mesin", config.key)
        .order("waktu_awal", { ascending: false })
        .limit(500);
      if (dt) setDowntimeList(dt as DowntimeLogRow[]);

      // Fetch Downtime Problems (master data combobox Problem)
      const { data: probs } = await supabase
        .from("downtime_problems")
        .select("*")
        .eq("mesin", config.key)
        .order("value", { ascending: true });
      if (probs) setProblemList(probs as DowntimeProblem[]);

      // 5. Fetch Non-Produksi / Dandori Log
      const { data: dRows } = await supabase
        .from("dandori_log")
        .select("*")
        .eq("mesin", config.key)
        .order("waktu_awal", { ascending: false })
        .limit(500);
      if (dRows) setNonProduksiRows(dRows as DandoriLogRow[]);

      // Fetch nonproduksi_types for gap classification
      const { data: npTypes } = await supabase
        .from("nonproduksi_types")
        .select("*")
        .eq("mesin", config.key)
        .order("nama", { ascending: true });
      if (npTypes) setNonProduksiTypes(npTypes as NonProduksiType[]);

      // 6. Fetch Production Planning
      const { data: planData } = await supabase
        .from("production_planning")
        .select("*")
        .eq("mesin", config.key)
        .order("jam_rencana_mulai", { ascending: true });
      if (planData) setPlanningList(planData as ProductionPlanning[]);
    } catch (err: any) {
      console.error("Machine load error:", err?.message || err?.details || JSON.stringify(err) || err);
    } finally {
      setLoading(false);
    }
  }, [config.key]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetRiwayatFilter = () => {
    setRiwayatTanggalDari("");
    setRiwayatTanggalSampai("");
    setRiwayatPartNumber("");
  };
  // Fetch inti gabungan produksi + non-produksi untuk rentang tanggal tertentu.
  // Downtime bukan baris tersendiri di sini — itu atribut (downtime_menit) pada
  // baris produksi yang sama, persis seperti web reference; riwayat detail per
  // kategori downtime ada di tab Downtime.
  // Dipakai baik oleh tab Riwayat Produksi (dengan filter dari UI) maupun panel
  // "Riwayat Hari Ini" di tab Produksi (dipanggil dengan rentang = hari ini saja).
  const fetchGabunganRange = useCallback(
    async (waktuDari: string | null, waktuSampai: string | null, partNumberFilter: string) => {
      let productionQuery = supabase.from("production_log").select("*").eq("mesin", config.key);
      if (waktuDari) productionQuery = productionQuery.gte("waktu_awal", waktuDari);
      if (waktuSampai) productionQuery = productionQuery.lte("waktu_awal", waktuSampai);
      if (partNumberFilter) productionQuery = productionQuery.eq("part_number", partNumberFilter);

      let nonProduksiQuery = supabase.from("dandori_log").select("*").eq("mesin", config.key);
      if (waktuDari) nonProduksiQuery = nonProduksiQuery.gte("waktu_awal", waktuDari);
      if (waktuSampai) nonProduksiQuery = nonProduksiQuery.lte("waktu_awal", waktuSampai);
      if (partNumberFilter) nonProduksiQuery = nonProduksiQuery.or(`part_dari.eq.${partNumberFilter},part_ke.eq.${partNumberFilter}`);

      const [{ data: produksi, error: produksiError }, { data: nonProduksi, error: nonProduksiError }] = await Promise.all([productionQuery, nonProduksiQuery]);
      if (produksiError) throw produksiError;
      if (nonProduksiError) throw nonProduksiError;

      const gabungan = [
        ...(produksi || []).map((row: any) => ({ jenis: "produksi", waktu_awal: row.waktu_awal, waktu_akhir: row.waktu_akhir, part_number: row.part_number, data: row })),
        ...(nonProduksi || []).map((row: any) => ({ jenis: "non_produksi", waktu_awal: row.waktu_awal, waktu_akhir: row.waktu_akhir, part_number: row.part_ke || row.part_dari || null, data: row })),
      ].sort((a, b) => new Date(b.waktu_awal).getTime() - new Date(a.waktu_awal).getTime());

      return gabungan;
    },
    [config.key]
  );

  const fetchRiwayatGabungan = useCallback(async () => {
    const waktuDari = riwayatTanggalDari ? `${riwayatTanggalDari}T00:00:00.000Z` : null;
    const waktuSampai = riwayatTanggalSampai ? `${riwayatTanggalSampai}T23:59:59.999Z` : null;
    const gabungan = await fetchGabunganRange(waktuDari, waktuSampai, riwayatPartNumber);
    setRiwayatGabungan(gabungan);
  }, [fetchGabunganRange, riwayatPartNumber, riwayatTanggalDari, riwayatTanggalSampai]);

  // Riwayat Hari Ini — cuma buat tab Input Produksi, tanpa filter apa pun.
  const fetchRiwayatHariIniData = useCallback(async () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const waktuDari = `${todayStr}T00:00:00.000Z`;
    const waktuSampai = `${todayStr}T23:59:59.999Z`;
    const gabungan = await fetchGabunganRange(waktuDari, waktuSampai, "");
    setRiwayatHariIni(gabungan);
  }, [fetchGabunganRange]);

  // Helper: cek siapa yang boleh hapus baris riwayat
  const canDeleteRow = (row: any): boolean => {
    if (!profile) return false;
    // Admin/leader selalu boleh hapus
    if (isLeaderOrAdmin) return true;
    // Operator: hanya boleh hapus baris miliknya sendiri di hari yang sama
    const todayStr = new Date().toISOString().slice(0, 10);
    const rowDate = row.waktu_awal ? String(row.waktu_awal).slice(0, 10) : null;
    return (
      profile.id != null &&
      row.data?.created_by === profile.id &&
      rowDate === todayStr
    );
  };

  // Edit baris produksi dari tab Riwayat — port dari editProduction(row) di machine-page.js
  const handleEditProductionRow = (data: any) => {
    const stationId = data.stasiun || "_single";
    if (config.stationConfig.mode === "variant" && data.stasiun) {
      if (config.stationConfig.variants?.lama.includes(data.stasiun)) setTandemVariant("lama");
      else if (config.stationConfig.variants?.baru.includes(data.stasiun)) setTandemVariant("baru");
    }
    linesHook.startEditProduction(stationId, data as ProductionLogRow);
  };

  // Edit baris non-produksi — port dari editNonProduksiRow(row) di machine-page.js.
  // Panel edit-nya ada di tab Riwayat, jadi dipindah ke sana biar bisa dipicu juga
  // dari panel "Riwayat Hari Ini" di tab Produksi.
  const handleEditNonProduksiRow = (data: any) => {
    setNonProduksiEditForm({
      waktu_awal: toLocalInput(data.waktu_awal),
      waktu_akhir: toLocalInput(data.waktu_akhir),
      nama: data.part_ke || data.keterangan || "",
    });
    setEditingNonProduksiId(data.id);
  };

  // Diklik dari angka Downtime di tabel Riwayat Hari Ini — loncat ke tab Downtime,
  // difilter cuma nampilin downtime yang nempel di baris produksi itu.
  const handleViewDowntimeForProduction = (row: any) => {
    setDowntimeFilterProductionId(row.id);
    setDowntimeFilterLabel(`${row.part_number || "-"} (${new Date(row.waktu_awal).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })})`);
    setActiveTab("downtime");
  };

  const clearDowntimeFilter = () => {
    setDowntimeFilterProductionId(null);
    setDowntimeFilterLabel("");
  };

  // Batal — port dari cancelEditNonProduksi()
  const handleCancelEditNonProduksi = () => {
    setEditingNonProduksiId(null);
    setNonProduksiEditForm({ waktu_awal: "", waktu_akhir: "", nama: "" });
  };

  // Simpan — port dari saveNonProduksiEdit() di machine-page.js
  const handleSaveNonProduksiEdit = async () => {
    const f = nonProduksiEditForm;
    const payload = {
      waktu_awal: new Date(f.waktu_awal).toISOString(),
      waktu_akhir: new Date(f.waktu_akhir).toISOString(),
      part_ke: f.nama,
      keterangan: f.nama,
    };
    try {
      const { error } = await supabase.from("dandori_log").update(payload).eq("id", editingNonProduksiId);
      if (error) throw error;
      handleCancelEditNonProduksi();
      await fetchRiwayatGabungan();
      await fetchRiwayatHariIniData();
    } catch (err: any) {
      flash("Gagal menyimpan data non-produksi: " + (err?.message || JSON.stringify(err)), true);
    }
  };

  useEffect(() => {
    console.log(editingNonProduksiId);
  }, [editingNonProduksiId]);

  const handleDeleteRiwayat = async () => {
    const row = riwayatDeleteTarget;
    if (!row) return;
    if (!canDeleteRow(row)) {
      flash("Anda tidak memiliki izin untuk menghapus baris ini.", true);
      setRiwayatDeleteTarget(null);
      return;
    }

    const table =
      row.jenis === "produksi"
        ? "production_log"
        : row.jenis === "downtime"
        ? "downtime_log"
        : "dandori_log";

    try {
      setIsDeletingRiwayat(true);
      const { error } = await supabase.from(table).delete().eq("id", row.data.id);
      if (error) throw error;
      setRiwayatDeleteTarget(null);
      await fetchRiwayatGabungan();
      await fetchRiwayatHariIniData();
    } catch (err: any) {
      flash("Gagal menghapus riwayat: " + (err?.message || JSON.stringify(err)), true);
    } finally {
      setIsDeletingRiwayat(false);
    }
  };
  useEffect(() => {
    if (activeTab !== "riwayat") return;
    fetchRiwayatGabungan().catch((error) => {
      console.error("Gagal memuat riwayat gabungan:", error);
      setRiwayatGabungan([]);
    });
  }, [activeTab, fetchRiwayatGabungan]);

  useEffect(() => {
    if (activeTab !== "produksi") return;
    fetchRiwayatHariIniData().catch((error) => {
      console.error("Gagal memuat riwayat hari ini:", error);
      setRiwayatHariIni([]);
    });
  }, [activeTab, fetchRiwayatHariIniData]);
  // Active Station IDs for state machine hook
  const activeStationIds = React.useMemo(() => {
    return stationList().map((st) => st.id);
  }, [stationList]);

  // Offline queue sync — begitu koneksi kembali / tiap 20 detik / saat mount,
  // coba kirim ulang baris yang tersimpan offline lalu refresh data terkait.
  const { pendingCount, refreshPendingCount } = useOfflineSync({
    onSynced: (synced) => {
      flash(`${synced} data offline berhasil disinkron.`);
      loadData();
      fetchRiwayatHariIniData();
      if (activeTab === "riwayat") fetchRiwayatGabungan();
    },
  });

  // Production log commit handler for useProductionLines
  const handleCommitProduction = useCallback(
    async (stId: string, stationDbId: string | null, payload: CommitPayload) => {
      const row = {
        mesin: payload.mesin,
        stasiun: stationDbId,
        waktu_awal: payload.waktu_awal,
        waktu_akhir: payload.waktu_akhir,
        part_number: payload.part_number,
        qty: payload.qty,
        ng: payload.ng,
        manpower: payload.manpower,
        dandori_menit: payload.dandori_menit,
        break_menit: payload.break_menit,
        downtime_menit: 0,
        extra: payload.extra,
      };

      try {
        const { error } = await supabase.from("production_log").insert(row);

        if (error) throw error;

        if (payload.planningId) {
          await supabase
            .from("production_planning")
            .update({ status: "selesai" })
            .eq("id", payload.planningId);
        }

        flash("Data produksi tersimpan.");
        loadData();
        fetchRiwayatHariIniData();
      } catch (err: any) {
        if (isNetworkError(err)) {
          enqueueOffline("production_log", row);
          refreshPendingCount();
          setProductionRows((prev) => [
            { ...row, id: "pending_" + Date.now(), _pending: true } as ProductionLogRow,
            ...prev,
          ]);
        } else {
          flash("Gagal menyimpan produksi: " + (err?.message || JSON.stringify(err)), true);
        }
      }
    },
    [loadData, fetchRiwayatHariIniData, refreshPendingCount]
  );

  // Production log update handler for useProductionLines (koreksi manual / edit riwayat)
  const handleUpdateProduction = useCallback(
    async (stId: string, stationDbId: string | null, id: string, payload: UpdatePayload) => {
      try {
        const { error } = await supabase.from("production_log").update(payload).eq("id", id);
        if (error) throw error;
        flash("Data produksi diperbarui.");
        loadData();
        fetchRiwayatHariIniData();
      } catch (err: any) {
        flash("Gagal memperbarui produksi: " + (err?.message || JSON.stringify(err)), true);
      }
    },
    [loadData, fetchRiwayatHariIniData]
  );

  // Non-produksi commit handler for useProductionLines
  const handleSaveNonProduksiRow = useCallback(
    async (stId: string, stationDbId: string | null, payload: NonProdPayload) => {
      const row = {
        mesin: payload.mesin,
        stasiun: stationDbId,
        waktu_awal: payload.waktu_awal,
        waktu_akhir: payload.waktu_akhir,
        kategori: payload.kategori,
        part_ke: payload.part_ke,
        keterangan: payload.keterangan,
      };

      try {
        const { error } = await supabase.from("dandori_log").insert(row);

        if (error) throw error;
        loadData();
        fetchRiwayatHariIniData();
      } catch (err: any) {
        if (isNetworkError(err)) {
          enqueueOffline("dandori_log", row);
          refreshPendingCount();
          setNonProduksiRows((prev) => [
            { ...row, id: "pending_" + Date.now(), _pending: true } as DandoriLogRow,
            ...prev,
          ]);
        } else {
          flash("Gagal menyimpan non-produksi: " + (err?.message || JSON.stringify(err)), true);
        }
      }
    },
    [loadData, fetchRiwayatHariIniData, refreshPendingCount]
  );

  // Station State Machine Hook (terpasang & mengelola state per stasiun)
  const linesHook = useProductionLines(activeStationIds, {
    config,
    tandemVariant,
    productionRows,
    nonProduksiRows,
    masterParts,
    onCommitProduction: handleCommitProduction,
    onSaveNonProduksi: handleSaveNonProduksiRow,
    onUpdateProduction: handleUpdateProduction,
    onError: (msg: string) => flash(msg, true),
  });

  // Stasiun mana pun yang sedang di fase "edit" — dipakai untuk modal global
  // Edit Produksi (cuma 1 yang bisa aktif dalam satu waktu).
  const editingStationEntry = Object.entries(linesHook.lines).find(
    ([, l]) => l.phase === "edit"
  );

  // Production Planning Handlers
  const handleAddPlanning = async (stId: string) => {
    const form = newPlanningForm[stId];
    if (!form || !form.part_number || !form.jam_mulai || !form.jam_selesai) {
      flash("Mohon lengkapi Part Number, Jam Rencana Mulai, dan Selesai.", true);
      return;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const payload = {
        mesin: config.key,
        stasiun: dbStasiun(stId),
        part_number: form.part_number,
        qty_rencana: form.qty_rencana === "" ? null : Number(form.qty_rencana),
        jam_rencana_mulai: new Date(form.jam_mulai).toISOString(),
        jam_rencana_selesai: new Date(form.jam_selesai).toISOString(),
        status: "pending",
        created_by: session?.user?.id || profile?.id,
      };

      const { error } = await supabase.from("production_planning").insert([payload]);
      if (error) throw error;

      flash("Rencana produksi berhasil ditambahkan!");
      setNewPlanningForm((prev) => ({
        ...prev,
        [stId]: { part_number: "", qty_rencana: "", jam_mulai: "", jam_selesai: "" },
      }));
      loadData();
    } catch (err: any) {
      flash("Gagal menambah rencana produksi: " + (err?.message || JSON.stringify(err)), true);
    }
  };

  const handleDeletePlanning = async (id: string) => {
    if (!confirm("Hapus rencana produksi ini?")) return;
    try {
      const { error } = await supabase.from("production_planning").delete().eq("id", id);
      if (error) throw error;
      flash("Rencana produksi dihapus.");
      loadData();
    } catch (err: any) {
      flash("Gagal menghapus rencana produksi: " + (err?.message || JSON.stringify(err)), true);
    }
  };

  // Save Target GSPH & Availability (Mesin Settings)
  const handleSaveMesinSettings = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const payload = {
        mesin: config.key,
        gsph_target_mode: mesinSettingsDraft.gsph_target_mode,
        gsph_target_fixed: Number(mesinSettingsDraft.gsph_target_fixed) || 0,
        target_availability: Number(mesinSettingsDraft.target_availability) || 0,
        updated_by: session?.user?.id || profile?.id,
      };
      const { error } = await supabase
        .from("mesin_settings")
        .upsert(payload, { onConflict: "mesin" });

      if (error) throw error;
      setMesinSettings({
        gsph_target_mode: payload.gsph_target_mode,
        gsph_target_fixed: payload.gsph_target_fixed,
        target_availability: payload.target_availability,
      });
      flash("Target GSPH & Availability berhasil disimpan!");
      loadData();
    } catch (err: any) {
      flash("Gagal menyimpan target: " + (err?.message || JSON.stringify(err)), true);
    }
  };

  // CRUD Part Number Handlers
  const handleAddPartNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartKode.trim()) return;

    try {
      const payloadFull = {
        mesin: config.key,
        value: newPartKode.trim(),
        kode_part: newPartKode.trim(),
        nama_part: newPartNama.trim() || newPartKode.trim(),
        std_ct: newPartStdCt === "" ? null : Number(newPartStdCt),
        next_process: newPartNextProcess.trim() || null,
        harga_pcs: newPartHarga === "" ? null : Number(newPartHarga),
        harga_rp: newPartHarga === "" ? null : Number(newPartHarga),
      };

      let res = await supabase.from("part_numbers").insert([payloadFull]);
      if (res.error) {
        res = await supabase.from("part_numbers").insert([
          {
            mesin: config.key,
            value: newPartKode.trim(),
            std_ct: newPartStdCt === "" ? null : Number(newPartStdCt),
            harga_pcs: newPartHarga === "" ? null : Number(newPartHarga),
          },
        ]);
      }
      if (res.error) {
        res = await supabase.from("master_part").insert([
          {
            mesin: config.key,
            kode_part: newPartKode.trim(),
            nama_part: newPartNama.trim() || newPartKode.trim(),
            std_ct: newPartStdCt === "" ? null : Number(newPartStdCt),
            ct_detik: newPartStdCt !== "" ? Number(newPartStdCt) * 60 : null,
            next_process: newPartNextProcess.trim() || null,
            harga_rp: newPartHarga === "" ? null : Number(newPartHarga),
          },
        ]);
      }

      if (res.error) throw res.error;

      flash("Part Number berhasil ditambahkan!");
      setNewPartKode("");
      setNewPartNama("");
      setNewPartStdCt("");
      setNewPartNextProcess("");
      setNewPartHarga("");
      loadData();
    } catch (err: any) {
      flash("Gagal menambah Part Number: " + (err?.message || JSON.stringify(err)), true);
    }
  };

  const handleStartEditPartNumber = (part: MasterPart) => {
    setEditingPartId(part.id || null);
    setEditPartForm({
      kode_part: part.kode_part || part.value || "",
      nama_part: part.nama_part || part.kode_part || part.value || "",
      std_ct: part.std_ct ?? (part.ct_detik ? part.ct_detik / 60 : ""),
      next_process: part.next_process || "",
      harga_rp: part.harga_rp ?? part.harga_pcs ?? "",
    });
  };

  const handleSaveEditPartNumber = async (id: string) => {
    if (!editPartForm.kode_part.trim()) return;
    try {
      const payloadFull = {
        value: editPartForm.kode_part.trim(),
        kode_part: editPartForm.kode_part.trim(),
        nama_part: editPartForm.nama_part.trim() || editPartForm.kode_part.trim(),
        std_ct: editPartForm.std_ct === "" ? null : Number(editPartForm.std_ct),
        next_process: editPartForm.next_process.trim() || null,
        harga_pcs: editPartForm.harga_rp === "" ? null : Number(editPartForm.harga_rp),
        harga_rp: editPartForm.harga_rp === "" ? null : Number(editPartForm.harga_rp),
      };

      let res = await supabase.from("part_numbers").update(payloadFull).eq("id", id);
      if (res.error) {
        res = await supabase
          .from("part_numbers")
          .update({
            value: editPartForm.kode_part.trim(),
            std_ct: editPartForm.std_ct === "" ? null : Number(editPartForm.std_ct),
            harga_pcs: editPartForm.harga_rp === "" ? null : Number(editPartForm.harga_rp),
          })
          .eq("id", id);
      }
      if (res.error) {
        res = await supabase
          .from("master_part")
          .update({
            kode_part: editPartForm.kode_part.trim(),
            nama_part: editPartForm.nama_part.trim() || editPartForm.kode_part.trim(),
            std_ct: editPartForm.std_ct === "" ? null : Number(editPartForm.std_ct),
            ct_detik: editPartForm.std_ct !== "" ? Number(editPartForm.std_ct) * 60 : null,
            next_process: editPartForm.next_process.trim() || null,
            harga_rp: editPartForm.harga_rp === "" ? null : Number(editPartForm.harga_rp),
          })
          .eq("id", id);
      }

      if (res.error) throw res.error;

      flash("Part Number berhasil diperbarui!");
      setEditingPartId(null);
      loadData();
    } catch (err: any) {
      flash("Gagal memperbarui Part Number: " + (err?.message || JSON.stringify(err)), true);
    }
  };

  const handleDeletePartNumber = async (id: string) => {
    if (!confirm("Hapus part number ini?")) return;
    try {
      let res = await supabase.from("part_numbers").delete().eq("id", id);
      if (res.error) {
        res = await supabase.from("master_part").delete().eq("id", id);
      }
      if (res.error) throw res.error;
      flash("Part Number berhasil dihapus!");
      loadData();
    } catch (err: any) {
      flash("Gagal menghapus Part Number: " + (err?.message || JSON.stringify(err)), true);
    }
  };

  // CRUD Jenis Non-Produksi — port dari addMasterNonProduksiType()/deleteMasterNonProduksiType()
  // di database-main/assets/machine-page.js
  const handleAddNonProduksiType = async () => {
    const v = newNonProduksiTypeValue.trim();
    if (!v) return;
    try {
      const { error } = await supabase.from("nonproduksi_types").insert({ mesin: config.key, nama: v });
      if (error) throw error;
      setNewNonProduksiTypeValue("");
      loadData();
    } catch (err: any) {
      flash("Gagal tambah jenis non-produksi: " + (err?.message || JSON.stringify(err)), true);
    }
  };

  const handleDeleteNonProduksiType = async (id: string) => {
    if (!confirm("Hapus jenis ini?")) return;
    try {
      const { error } = await supabase.from("nonproduksi_types").delete().eq("id", id);
      if (error) throw error;
      loadData();
    } catch (err: any) {
      flash("Gagal hapus jenis non-produksi: " + (err?.message || JSON.stringify(err)), true);
    }
  };

  // Master Data CRUD Daftar Problem Downtime — port dari addMasterProblem/
  // startEditProblem/saveMasterProblem/deleteMasterProblem di machine-page.js.
  const handleAddProblem = async () => {
    const v = newProblemValue.trim();
    if (!v) return;
    try {
      const { data, error } = await supabase
        .from("downtime_problems")
        .insert({ mesin: config.key, value: v })
        .select()
        .single();
      if (error) throw error;
      setProblemList((prev) => [...prev, data as DowntimeProblem].sort((a, b) => a.value.localeCompare(b.value)));
      setNewProblemValue("");
    } catch (err: any) {
      flash("Gagal tambah problem: " + (err?.message || JSON.stringify(err)), true);
    }
  };

  const handleStartEditProblem = (item: DowntimeProblem) => {
    setEditingProblemId(item.id);
    setEditProblemValue(item.value);
  };

  const handleCancelEditProblem = () => {
    setEditingProblemId(null);
    setEditProblemValue("");
  };

  const handleSaveEditProblem = async (id: string) => {
    const v = editProblemValue.trim();
    if (!v) {
      flash("Tidak boleh kosong.", true);
      return;
    }
    try {
      const { data, error } = await supabase.from("downtime_problems").update({ value: v }).eq("id", id).select();
      if (error) throw error;
      if (!data || data.length === 0) {
        flash("Gagal simpan — cek izin akses.", true);
        return;
      }
      setProblemList((prev) => prev.map((p) => (p.id === id ? { ...p, value: v } : p)));
      handleCancelEditProblem();
    } catch (err: any) {
      flash("Gagal simpan problem: " + (err?.message || JSON.stringify(err)), true);
    }
  };

  const handleDeleteProblem = async (id: string) => {
    if (!confirm("Hapus problem ini?")) return;
    try {
      const { error } = await supabase.from("downtime_problems").delete().eq("id", id);
      if (error) throw error;
      setProblemList((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      flash("Gagal hapus problem: " + (err?.message || JSON.stringify(err)), true);
    }
  };

  // Performance Tab Data Fetcher
  const fetchPerformanceData = useCallback(async () => {
    if (activeTab !== "performance") return;
    setPerfLoading(true);

    try {
      let anchorStr = `${perfYear}-01-01`;
      if (activePerfSection === "bulanan") anchorStr = `${perfMonth}-01`;
      else if (activePerfSection === "harian") anchorStr = perfDate;

      const d = new Date(anchorStr + "T00:00:00");
      const targetFixed = Number(mesinSettings.gsph_target_fixed) || 0;

      const periods: { start: Date; end: Date; label: string; separator?: boolean; kindYear?: boolean }[] = [];

      if (activePerfSection === "tahunan") {
        const y = d.getFullYear();
        for (let i = 2; i >= 0; i--) {
          const yy = y - i;
          periods.push({
            start: new Date(yy, 0, 1),
            end: new Date(yy + 1, 0, 1),
            label: String(yy),
            kindYear: true,
          });
        }
        periods.push({ separator: true, start: new Date(), end: new Date(), label: "" });
        const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
        for (let m = 0; m < 12; m++) {
          periods.push({
            start: new Date(y, m, 1),
            end: new Date(y, m + 1, 1),
            label: MONTH_NAMES[m],
          });
        }
      } else if (activePerfSection === "bulanan") {
        const y = d.getFullYear(), m = d.getMonth();
        const totalDays = new Date(y, m + 1, 0).getDate();
        for (let day = 1; day <= totalDays; day++) {
          periods.push({
            start: new Date(y, m, day),
            end: new Date(y, m, day + 1),
            label: String(day),
          });
        }
      } else {
        periods.push({
          start: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
          end: new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1),
          label: d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }),
        });
      }

      let currentStart: Date, currentEnd: Date;
      if (activePerfSection === "tahunan") {
        currentStart = new Date(d.getFullYear(), 0, 1);
        currentEnd = new Date(d.getFullYear() + 1, 0, 1);
      } else if (activePerfSection === "bulanan") {
        currentStart = new Date(d.getFullYear(), d.getMonth(), 1);
        currentEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      } else {
        currentStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        currentEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      }

      const stasiunList = (config.stationConfig.mode === "variant" && tandemVariant)
        ? config.stationConfig.variants?.[tandemVariant] || null
        : null;

      const stIso = currentStart.toISOString(), endIso = currentEnd.toISOString();
      const [top5Rpc, catRpc] = await Promise.all([
        Promise.resolve(supabase.rpc("downtime_top_problems", { p_mesin: config.key, p_stasiun_list: stasiunList, p_start: stIso, p_end: endIso, p_limit: 5 })).catch(() => ({ data: null })),
        Promise.resolve(supabase.rpc("downtime_by_category", { p_mesin: config.key, p_stasiun_list: stasiunList, p_start: stIso, p_end: endIso })).catch(() => ({ data: null })),
      ]);


      const trendResults = await Promise.all(
        periods.map(async (p) => {
          if (p.separator) return { label: "", gsph: null, targetGsph: null, separator: true };
          const pStartIso = p.start.toISOString(), pEndIso = p.end.toISOString();

          let aggRpc: any = null;
          try {
            aggRpc = await supabase.rpc("performance_aggregate", {
              p_mesin: config.key, p_stasiun_list: stasiunList, p_start: pStartIso, p_end: pEndIso,
            });
          } catch { }

          let stroke = 0, ng = 0, ngValue = 0, downtimeMenit = 0, dandoriMenit = 0, breakMenit = 0, whJam = 0, targetStdMenit = 0;

          if (aggRpc && !aggRpc.error && aggRpc.data && aggRpc.data[0]) {
            const row = aggRpc.data[0];
            stroke = Number(row.stroke) || 0;
            ng = Number(row.ng) || 0;
            ngValue = Number(row.ng_value) || 0;
            downtimeMenit = Math.round(Number(row.downtime_menit) || 0);
            dandoriMenit = Math.round(Number(row.dandori_menit) || 0);
            breakMenit = Math.round(Number(row.break_menit) || 0);
            whJam = (Number(row.wh_menit) || 0) / 60;
            targetStdMenit = Number(row.target_std_menit) || 0;
          } else {
            let pq = supabase.from("production_log").select("*").eq("mesin", config.key).gte("waktu_awal", pStartIso).lt("waktu_awal", pEndIso);
            if (stasiunList && stasiunList.length > 0) pq = pq.in("stasiun", stasiunList);
            const pr = await pq;
            const prods = pr.data || [];
            prods.forEach((r: any) => {
              const okQty = r.qty || r.ok_qty || 0;
              const ngQty = r.ng || r.ng_qty || 0;
              stroke += okQty + ngQty;
              ng += ngQty;
              dandoriMenit += r.dandori_menit || 0;
              breakMenit += r.break_menit || 0;
              const part = masterParts.find((mp) => mp.nama_part === r.part_number || mp.kode_part === r.part_number || mp.value === r.part_number);
              const ct = part?.std_ct ?? (part?.ct_detik ? part.ct_detik / 60 : 0);
              if (ct) targetStdMenit += okQty * ct;
            });

            let dq = supabase.from("downtime_log").select("*").eq("mesin", config.key).gte("waktu_awal", pStartIso).lt("waktu_awal", pEndIso);
            if (stasiunList && stasiunList.length > 0) dq = dq.in("stasiun", stasiunList);
            const dr = await dq;
            (dr.data || []).forEach((r: any) => {
              let mnt = r.durasi_menit || r.durasi || 0;
              if (!mnt && r.waktu_awal && r.waktu_akhir)
                mnt = Math.round((new Date(r.waktu_akhir).getTime() - new Date(r.waktu_awal).getTime()) / 60000);
              downtimeMenit += mnt;
            });

            whJam = Math.max(0, 480 - downtimeMenit) / 60;
          }

          let tgtGsph = targetFixed;
          if (mesinSettings.gsph_target_mode === "per_part" && targetStdMenit > 0) {
            tgtGsph = stroke / (targetStdMenit / 60);
          }
          const calcGsph = whJam > 0 ? stroke / whJam : 0;
          const avail = whJam > 0 ? Math.max(0, (whJam * 60 - downtimeMenit) / (whJam * 60)) * 100 : 0;
          const perfFact = tgtGsph > 0 ? Math.min(100, (calcGsph / tgtGsph) * 100) : 0;
          const qual = stroke > 0 ? Math.max(0, ((stroke - ng) / stroke) * 100) : 100;
          const calcOee = (avail / 100) * (perfFact / 100) * (qual / 100) * 100;

          return {
            label: p.label,
            kindYear: p.kindYear,
            stroke, ng, ngValue, downtimeMenit, dandoriMenit, breakMenit, whJam,
            gsph: calcGsph,
            targetGsph: tgtGsph,
            availability: avail,
            performanceFactor: perfFact,
            quality: qual,
            oee: calcOee,
          };
        })
      );

      let dataSummary: any = null;
      if (activePerfSection === "tahunan") {
        dataSummary = trendResults[2] || trendResults[0] || null;
      } else if (activePerfSection === "bulanan") {
        const valid = trendResults.filter((t) => !t.separator);
        const sum = valid.reduce((a, t) => ({
          stroke: a.stroke + (t.stroke || 0),
          ng: a.ng + (t.ng || 0),
          downtimeMenit: a.downtimeMenit + (t.downtimeMenit || 0),
          dandoriMenit: a.dandoriMenit + (t.dandoriMenit || 0),
          breakMenit: a.breakMenit + (t.breakMenit || 0),
          whJam: a.whJam + (t.whJam || 0),
        }), { stroke: 0, ng: 0, downtimeMenit: 0, dandoriMenit: 0, breakMenit: 0, whJam: 0 });

        const gsph = sum.whJam > 0 ? sum.stroke / sum.whJam : 0;
        const tg = (valid.find((t) => (t.targetGsph || 0) > 0) || {}).targetGsph || 0;
        const availability = sum.whJam > 0 ? Math.max(0, (sum.whJam * 60 - sum.downtimeMenit) / (sum.whJam * 60)) * 100 : 0;
        const performanceFactor = tg > 0 ? Math.min(100, (gsph / tg) * 100) : 0;
        const quality = sum.stroke > 0 ? Math.max(0, ((sum.stroke - sum.ng) / sum.stroke) * 100) : 100;
        const calcOee = (availability / 100) * (performanceFactor / 100) * (quality / 100) * 100;

        dataSummary = {
          ...sum,
          gsph,
          targetGsph: tg,
          availability,
          performanceFactor,
          quality,
          oee: calcOee,
        };
      } else {
        dataSummary = trendResults[trendResults.length - 1] || null;
      }

      let top5: any[] = [];
      if (top5Rpc.data && Array.isArray(top5Rpc.data)) {
        top5 = top5Rpc.data.map((r: any) => ({ kategori: r.kategori, problem: r.problem, menit: Math.round(Number(r.total_menit) || 0) }));
      } else {
        const pDateStr = currentStart.toISOString().split("T")[0];
        const dtFiltered = downtimeList.filter((d: any) => d.tanggal === pDateStr || (d.waktu_awal && d.waktu_awal.startsWith(pDateStr)));
        const probMap: Record<string, { kategori: string; problem: string; menit: number }> = {};
        dtFiltered.forEach((d: any) => {
          const k = d.kategori || "MESIN";
          const p = d.deskripsi || d.problem || "-";
          const key = `${k}_${p}`;
          const m = d.durasi_menit || 0;
          if (!probMap[key]) probMap[key] = { kategori: k, problem: p, menit: 0 };
          probMap[key].menit += m;
        });
        top5 = Object.values(probMap).sort((a, b) => b.menit - a.menit).slice(0, 5);
      }

      let byCategory: any[] = [];
      if (catRpc.data && Array.isArray(catRpc.data)) {
        byCategory = catRpc.data.map((r: any) => ({ kategori: r.kategori, menit: Math.round(Number(r.total_menit) || 0) }));
      } else {
        const catMap: Record<string, number> = {};
        const pDateStr = currentStart.toISOString().split("T")[0];
        const dtFiltered = downtimeList.filter((d: any) => d.tanggal === pDateStr || (d.waktu_awal && d.waktu_awal.startsWith(pDateStr)));
        dtFiltered.forEach((d: any) => {
          const k = d.kategori || "MESIN";
          catMap[k] = (catMap[k] || 0) + (d.durasi_menit || 0);
        });
        byCategory = Object.entries(catMap).map(([kategori, menit]) => ({ kategori, menit }));
      }

      setPerfData({
        data: dataSummary,
        trend: trendResults,
        top5,
        byCategory,
      });

      if (activePerfSection === "harian") {
        const { data: rows } = await supabase
          .from("production_log")
          .select("*")
          .eq("mesin", config.key)
          .eq("tanggal", perfDate);
        setPerfDayRows(rows || []);
      } else {
        setPerfDayRows([]);
      }
    } catch (err) {
      console.warn("fetchPerformanceData error:", err);
    } finally {
      setPerfLoading(false);
    }
  }, [activeTab, activePerfSection, perfYear, perfMonth, perfDate, config.key, slug, tandemVariant, mesinSettings, masterParts, downtimeList]);

  useEffect(() => {
    fetchPerformanceData();
  }, [fetchPerformanceData]);

  // Chart Rendering for Performance Tab
  useEffect(() => {
    if (activeTab !== "performance" || perfLoading || !perfData.data) return;

    const getCssVar = (v: string) => {
      try { return getComputedStyle(document.documentElement).getPropertyValue(v).trim() || ""; }
      catch { return ""; }
    };

    // ── GSPH Aktual vs Target Chart ────────────────────────────
    if (perfChartRef.current) {
      if (perfChartInstancesRef.current.chart) perfChartInstancesRef.current.chart.destroy();

      if (activePerfSection === "harian") {
        const d = perfData.data || {};
        perfChartInstancesRef.current.chart = new Chart(perfChartRef.current, {
          type: "bar",
          data: {
            labels: ["GSPH"],
            datasets: [
              { label: "Target", data: [Number((d.targetGsph || 0).toFixed(1))], backgroundColor: getCssVar("--chart-2") || "#38bdf8", borderRadius: 6, barPercentage: 0.5, categoryPercentage: 0.6 },
              { label: "Aktual", data: [Number((d.gsph || 0).toFixed(1))], backgroundColor: getCssVar("--chart-1") || "#34d399", borderRadius: 6, barPercentage: 0.5, categoryPercentage: 0.6 },
            ],
          },
          options: {
            responsive: true, maintainAspectRatio: false, indexAxis: "y",
            plugins: {
              legend: { display: true, position: "top", align: "end", labels: { color: getCssVar("--muted") || "#94a3b8", boxWidth: 8, boxHeight: 8, usePointStyle: true, font: { size: 10 } } },
              tooltip: { backgroundColor: getCssVar("--panel") || "#1e293b", titleColor: getCssVar("--text") || "#f1f5f9", bodyColor: getCssVar("--text") || "#f1f5f9", borderColor: getCssVar("--border") || "#334155", borderWidth: 1, padding: 10 },
            },
            scales: {
              x: { ticks: { color: getCssVar("--chart-tick") || "#64748b", font: { size: 10 } }, grid: { color: getCssVar("--chart-grid") || "#334155" }, border: { display: false }, beginAtZero: true },
              y: { ticks: { color: getCssVar("--chart-tick") || "#64748b", font: { size: 10 } }, grid: { display: false }, border: { display: false } },
            },
          },
        });
      } else {
        const barColors = perfData.trend.map((t) => (t.kindYear ? getCssVar("--chart-3") || "#a78bfa" : getCssVar("--chart-1") || "#34d399"));
        perfChartInstancesRef.current.chart = new Chart(perfChartRef.current, {
          data: {
            labels: perfData.trend.map((t) => t.label),
            datasets: [
              {
                type: "bar", label: "GSPH (Aktual)",
                data: perfData.trend.map((t) => (t.separator ? null : Number((t.gsph || 0).toFixed(1)))),
                backgroundColor: barColors, borderRadius: 4, barPercentage: 0.7, categoryPercentage: 0.8, order: 2,
              },
              {
                type: "line", label: "GSPH (Target)",
                data: perfData.trend.map((t) => (t.separator ? null : Number((t.targetGsph || 0).toFixed(1)))),
                borderColor: getCssVar("--chart-5") || "#fb7185", borderWidth: 2, pointRadius: 0, tension: 0, spanGaps: true, order: 1,
              },
            ],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            layout: { padding: { top: 28, right: 8 } },
            plugins: {
              legend: { display: true, position: "top", align: "end", labels: { color: getCssVar("--muted") || "#94a3b8", boxWidth: 8, boxHeight: 8, usePointStyle: true, font: { size: 10 } } },
              tooltip: { backgroundColor: getCssVar("--panel") || "#1e293b", titleColor: getCssVar("--text") || "#f1f5f9", bodyColor: getCssVar("--text") || "#f1f5f9", borderColor: getCssVar("--border") || "#334155", borderWidth: 1, padding: 10 },
            },
            scales: {
              x: { ticks: { color: getCssVar("--chart-tick") || "#64748b", font: { size: 10 } }, grid: { display: false }, border: { display: false } },
              y: {
                ticks: { color: getCssVar("--chart-tick") || "#64748b", font: { size: 10 }, maxTicksLimit: 5 },
                grid: { color: getCssVar("--chart-grid") || "#334155" }, border: { display: false }, beginAtZero: true,
                suggestedMax: (() => {
                  const vals = perfData.trend.map((t) => t.gsph || 0).filter(Boolean);
                  const tgts = perfData.trend.map((t) => t.targetGsph || 0).filter(Boolean);
                  const mx = Math.max(...vals, ...tgts, 1);
                  return Math.ceil(mx * 1.15);
                })(),
              },
            },
          },
        });
      }
    }

    // ── Downtime per Kategori Pie — use config.kategoriOptions ──
    if (perfPieRef.current) {
      if (perfChartInstancesRef.current.pie) perfChartInstancesRef.current.pie.destroy();
      const data = perfData.byCategory || [];
      const catColors: Record<string, string> = {
        MESIN: getCssVar("--chart-2") || "#38bdf8",
        DIES: getCssVar("--chart-5") || "#fb7185",
        FINGER: getCssVar("--chart-1") || "#34d399",
        OTHER: getCssVar("--chart-4") || "#fbbf24",
      };
      if (data.length > 0) {
        perfChartInstancesRef.current.pie = new Chart(perfPieRef.current, {
          type: "doughnut",
          data: {
            labels: data.map((d) => d.kategori),
            datasets: [{
              data: data.map((d) => d.menit),
              backgroundColor: data.map((d) => catColors[d.kategori] || "#94a3b8"),
              borderWidth: 0,
            }],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            ...(({ cutout: "62%" } as any)),
            plugins: {
              legend: {
                position: "right",
                labels: {
                  color: getCssVar("--muted") || "#94a3b8",
                  boxWidth: 8,
                  boxHeight: 8,
                  usePointStyle: true,
                  font: { size: 10 },
                  generateLabels: (chart: any) => {
                    const dataset = chart.data.datasets[0];
                    const total = (dataset.data as number[]).reduce((a: number, b: number) => a + b, 0);
                    const legendTextColor = getCssVar("--muted") || "#94a3b8";
                    return (chart.data.labels as string[]).map((label: string, i: number) => {
                      const val = (dataset.data as number[])[i] || 0;
                      const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                      return {
                        text: `${label}  ${pct}%`,
                        fontColor: legendTextColor,
                        fillStyle: (dataset.backgroundColor as string[])[i],
                        strokeStyle: "transparent",
                        lineWidth: 0,
                        hidden: false,
                        index: i,
                      };
                    });
                  },
                },
              },
              tooltip: {
                backgroundColor: getCssVar("--panel") || "#1e293b",
                titleColor: getCssVar("--text") || "#f1f5f9",
                bodyColor: getCssVar("--text") || "#f1f5f9",
                borderColor: getCssVar("--border") || "#334155",
                borderWidth: 1,
                padding: 10,
                displayColors: false,
                callbacks: {
                  title: () => "",
                  label: (ctx: any) => {
                    const total = data.reduce((a, b) => a + b.menit, 0);
                    const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : "0";
                    return `${ctx.label}: ${Number(ctx.parsed).toLocaleString()} mnt (${pct}%)`;
                  },
                },
              },
            },
          },
        });
      }
    }

    return () => {
      Object.values(perfChartInstancesRef.current).forEach((c) => { try { (c as any).destroy?.(); } catch { } });
      perfChartInstancesRef.current = {};
    };
  }, [activeTab, activePerfSection, perfLoading, perfData, theme]);

  const downtimeKesimpulan = () => {
    const data = perfData.byCategory || [];
    const total = data.reduce((a, b) => a + b.menit, 0);
    if (total === 0) return "Tidak ada downtime tercatat.";
    const topCat = [...data].sort((a, b) => b.menit - a.menit)[0];
    const pct = ((topCat.menit / total) * 100).toFixed(0);
    return `Total downtime ${fmtNum(total)} mnt didominasi oleh ${topCat.kategori} (${pct}%).`;
  };

  // ---- Catat Downtime — timer & CRUD (port dari startDowntime/stopDowntime/
  // submitDowntime/editDowntime/deleteDowntime/learnProblem di machine-page.js) ----
  const startDowntime = () => {
    setDtState("running");
    setDtStart(new Date().toISOString());
  };

  const cancelDowntime = () => {
    setDtState("idle");
    setDtStart(null);
    setDtEnd(null);
    setEditingDowntimeId(null);
    setDtForm({ stasiun: "", kategori: "", problem: "", penyebab: "", countermeasure: "" });
  };

  const stopDowntime = () => {
    setDtState("stopped");
    setDtEnd(new Date().toISOString());
    setDtForm({ kategori: "", problem: "", penyebab: "", countermeasure: "", stasiun: "" });
  };

  const learnProblem = async (value: string) => {
    if (!value || problemList.some((r) => r.value.toLowerCase() === value.toLowerCase())) return;
    const { data, error } = await supabase
      .from("downtime_problems")
      .insert({ mesin: config.key, value })
      .select()
      .single();
    if (!error && data) setProblemList((prev) => [...prev, data as DowntimeProblem]);
  };

  const submitDowntime = async (e: React.FormEvent) => {
    e.preventDefault();
    const f = dtForm;
    const payload = {
      mesin: config.key,
      waktu_awal: dtStart,
      waktu_akhir: dtEnd,
      stasiun: f.stasiun || null,
      kategori: f.kategori || null,
      problem: f.problem || null,
      penyebab: f.penyebab || null,
      countermeasure: f.countermeasure || null,
    };

    try {
      if (f.problem) await learnProblem(f.problem);

      if (editingDowntimeId) {
        const { error } = await supabase.from("downtime_log").update(payload).eq("id", editingDowntimeId);
        if (error) throw error;
      } else {
        const { data: { session } } = await supabase.auth.getSession();
        const { error } = await supabase.from("downtime_log").insert({ ...payload, created_by: session?.user?.id });
        if (error) throw error;
      }

      cancelDowntime();
      await loadData();
    } catch (err: any) {
      flash("Gagal menyimpan downtime: " + (err?.message || JSON.stringify(err)), true);
    }
  };

  const editDowntime = (row: DowntimeLogRow) => {
    setEditingDowntimeId(row.id);
    setDtState("stopped");
    setDtStart(row.waktu_awal);
    setDtEnd(row.waktu_akhir);
    setDtForm({
      kategori: row.kategori || "",
      problem: row.problem || "",
      penyebab: row.penyebab || "",
      countermeasure: row.countermeasure || "",
      stasiun: row.stasiun || "",
    });
    setActiveTab("downtime");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteDowntime = async (id: string) => {
    if (!confirm("Hapus data downtime ini?")) return;
    try {
      const { error } = await supabase.from("downtime_log").delete().eq("id", id);
      if (error) throw error;
      await loadData();
    } catch (err: any) {
      flash("Gagal menghapus downtime: " + (err?.message || JSON.stringify(err)), true);
    }
  };

  const durasiMenit = (waktuAwal?: string | null, waktuAkhir?: string | null) => {
    if (!waktuAwal || !waktuAkhir) return "-";
    const menit = Math.round((new Date(waktuAkhir).getTime() - new Date(waktuAwal).getTime()) / 60000);
    return `${fmtNum(menit)} mnt`;
  };

  const downtimeRowsFiltered = () =>
    downtimeList.filter((d) => !downtimeFilterProductionId || d.production_log_id === downtimeFilterProductionId);

  const fmtNum = (n: number | null | undefined) => {
    if (n === null || n === undefined || isNaN(n)) return "0";
    return Number(n).toLocaleString("en-US", { maximumFractionDigits: 1 });
  };

  const fmtClock = (iso?: string | null) => {
    if (!iso) return "-";
    return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  };

  const fmt = (iso?: string | null) => {
    if (!iso) return "-";
    return new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  // ---- Earned / Operation / Availability per baris (port dari machine-page.js) ----
  const stdCtFor = (partNumber: string | null | undefined): number | null => {
    const p = masterParts.find(
      (x) => x.value === partNumber || x.kode_part === partNumber || x.nama_part === partNumber
    );
    const ct = p?.std_ct ?? (p?.ct_detik ? p.ct_detik / 60 : null);
    return ct ? Number(ct) : null;
  };

  const earnedMenit = (row: any): number | null => {
    if (row.jenis !== "produksi" || !row.data?.qty) return null;
    const ct = stdCtFor(row.data.part_number);
    return ct ? row.data.qty * ct : null;
  };

  const operationMenit = (row: any): number | null => {
    if (!row.waktu_awal || !row.waktu_akhir) return null;
    const d = (new Date(row.waktu_akhir).getTime() - new Date(row.waktu_awal).getTime()) / 60000;
    return d >= 0 ? d : null;
  };

  const rowAvailability = (row: any): number | null => {
    const earned = earnedMenit(row);
    const operation = operationMenit(row);
    if (!earned || !operation) return null;
    return (earned / operation) * 100;
  };

  // Kenapa kolom Availability kosong? — dipakai sbg title/tooltip + fallback
  // text saat rowAvailability() mengembalikan null.
  const availabilityHint = (row: any): string => {
    if (row.jenis !== "produksi") return "-";
    if (!row.data?.qty) return "Qty kosong";
    if (!stdCtFor(row.data.part_number)) return "Std CT belum diisi di Master Data";
    return "-";
  };

  return (
    <HeaderNav>
      {/* Modal global — Edit Data Produksi (bisa dibuka dari tab/scroll manapun) */}
      {editingStationEntry && editingStationEntry[1].editForm && (
        <ModalShell
          title="Edit Data Produksi"
          onClose={() => linesHook.cancelEditProduction(editingStationEntry[0])}
        >
          {(() => {
            const stId = editingStationEntry[0];
            const line = editingStationEntry[1];
            const editForm = line.editForm!;
            return (
              <>
                <div className="modal-field-grid">
                  <div className="field">
                    <label>Waktu Awal</label>
                    <Input
                      type="datetime-local"
                      value={editForm.waktu_awal}
                      onChange={(e) => linesHook.setEditFormField(stId, "waktu_awal", e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>Waktu Akhir</label>
                    <Input
                      type="datetime-local"
                      value={editForm.waktu_akhir}
                      onChange={(e) => linesHook.setEditFormField(stId, "waktu_akhir", e.target.value)}
                    />
                  </div>
                  <div className="field" style={{ gridColumn: "1 / -1" }}>
                    <label>Part Number</label>
                                        <Select
                      value={editForm.part_number}
                      onChange={(e) => linesHook.setEditFormField(stId, "part_number", e.target.value)}
                    >
                      <option value="">- Pilih Part Number -</option>
                      {masterParts.map((part) => {
                        const partNumber = part.kode_part || part.value || part.nama_part;
                        return (
                          <option key={part.id || partNumber} value={partNumber}>
                            {partNumber}
                          </option>
                        );
                      })}
                    </Select>
                  </div>
                  <div className="field">
                    <label>Qty</label>
                    <Input
                      type="number"
                      value={editForm.qty}
                      onChange={(e) => linesHook.setEditFormField(stId, "qty", e.target.value === "" ? "" : Number(e.target.value))}
                    />
                  </div>
                  <div className="field">
                    <label>Jumlah MP</label>
                    <ManpowerChips
                      value={editForm.manpower}
                      onChange={(n) => linesHook.setEditFormField(stId, "manpower", n)}
                    />
                  </div>
                  <div className="field">
                    <label>NG</label>
                    <Input
                      type="number"
                      value={editForm.ng}
                      onChange={(e) => linesHook.setEditFormField(stId, "ng", e.target.value === "" ? "" : Number(e.target.value))}
                    />
                  </div>
                  <div className="field">
                    <label>Dandori (menit)</label>
                    <Input
                      type="number"
                      value={editForm.dandori_menit}
                      onChange={(e) => linesHook.setEditFormField(stId, "dandori_menit", e.target.value === "" ? "" : Number(e.target.value))}
                    />
                  </div>
                  <div className="field">
                    <label>Break (menit)</label>
                    <Input
                      type="number"
                      value={editForm.break_menit}
                      onChange={(e) => linesHook.setEditFormField(stId, "break_menit", e.target.value === "" ? "" : Number(e.target.value))}
                    />
                  </div>
                  {config.extraFields.map((f) => (
                    <div className="field" key={f.key}>
                      <label>{f.label}</label>
                      <Input
                        type={f.type}
                        value={editForm[f.key] ?? ""}
                        onChange={(e) =>
                          linesHook.setEditFormField(
                            stId,
                            f.key,
                            f.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value
                          )
                        }
                      />
                    </div>
                  ))}
                </div>
                <div className="form-actions flex gap-2 justify-end">
                  <Button type="button" variant="secondary" onClick={() => linesHook.cancelEditProduction(stId)}>
                    Batal
                  </Button>
                  <Button type="button" onClick={() => linesHook.saveEditProduction(stId)}>
                    Simpan
                  </Button>
                </div>
              </>
            );
          })()}
        </ModalShell>
      )}

      {/* Modal global — Edit Data Non-Produksi */}
      {editingNonProduksiId && (
        <ModalShell title="Edit Data Non-Produksi" onClose={handleCancelEditNonProduksi}>
          <div className="modal-field-grid">
            <div className="field">
              <label>Waktu Awal</label>
              <Input
                type="datetime-local"
                value={nonProduksiEditForm.waktu_awal}
                onChange={(e) => setNonProduksiEditForm((prev) => ({ ...prev, waktu_awal: e.target.value }))}
              />
            </div>
            <div className="field">
              <label>Waktu Akhir</label>
              <Input
                type="datetime-local"
                value={nonProduksiEditForm.waktu_akhir}
                onChange={(e) => setNonProduksiEditForm((prev) => ({ ...prev, waktu_akhir: e.target.value }))}
              />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>Jenis Non-Produksi</label>
              <Input
                type="text"
                list="nonProduksiTypeList"
                value={nonProduksiEditForm.nama}
                onChange={(e) => setNonProduksiEditForm((prev) => ({ ...prev, nama: e.target.value }))}
              />
              <datalist id="nonProduksiTypeList">
                {nonProduksiTypes.map((t) => (
                  <option key={t.id} value={t.nama} />
                ))}
              </datalist>
            </div>
          </div>
          <div className="form-actions flex gap-2 justify-end">
            <Button type="button" variant="ghost" onClick={handleCancelEditNonProduksi}>
              Batal
            </Button>
            <Button type="button" onClick={handleSaveNonProduksiEdit}>
              Simpan
            </Button>
          </div>
        </ModalShell>
      )}

      {/* Header Halaman Mesin (1:1 dengan tandem.html) */}
      <div className="page-header flex flex-wrap justify-between items-center mb-6 gap-4">
        <div>
          <h1 className="page-title text-2xl font-bold font-display">
            <span className="eyebrow block text-xs font-semibold text-blue-400 uppercase tracking-wider mb-0.5">Mesin</span>
            {config.label}
          </h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant={activeTab === "produksi" ? "default" : "secondary"}
            size="sm"
            onClick={() => setActiveTab("produksi")}
          >
            Input Produksi
          </Button>
          <Button
            type="button"
            variant={activeTab === "riwayat" ? "default" : "secondary"}
            size="sm"
            onClick={() => setActiveTab("riwayat")}
          >
            Riwayat
          </Button>
          <Button
            type="button"
            variant={activeTab === "performance" ? "default" : "secondary"}
            size="sm"
            onClick={() => setActiveTab("performance")}
          >
            Performance
          </Button>
          <Button
            type="button"
            variant={activeTab === "downtime" ? "default" : "secondary"}
            size="sm"
            onClick={() => setActiveTab("downtime")}
          >
            Downtime
          </Button>
          {isLeaderOrAdmin && (
            <Button
              type="button"
              variant={activeTab === "master_data" ? "default" : "secondary"}
              size="sm"
              onClick={() => setActiveTab("master_data")}
            >
              Master Data
            </Button>
          )}

          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => {
              const alasan = prompt("Alasan panggilan (opsional):");
              if (alasan === null) return; // user tekan Cancel, jangan panggil leader
              panggilLeader(alasan);
            }}
            disabled={andonCalling}
          >
            <Bell size={15} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} /> Panggil Leader
          </Button>
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            title={theme === "dark" ? "Ke mode terang" : "Ke mode gelap"}
          >
            <span>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</span>
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      {loading ? (
        <p className="empty-state">Memuat data mesin...</p>
      ) : (
        <>
          {/* ================= TAB 1: INPUT PRODUKSI (PER STASIUN) ================= */}
          {activeTab === "produksi" && (
            <div>
              {/* Pemilihan Line untuk Tandem */}
              {config.stationConfig.mode === "variant" && (
                <div className="mb-4">
                  {!tandemVariant ? (
                    <Card className="dash-panel card-glow-info mb-4 p-4">
                      <p className="dash-panel-title font-bold text-base mb-3">Pilih Line Tandem</p>
                      <div className="chip-row flex gap-3">
                        <Button type="button" onClick={() => setTandemVariant("lama")}>
                          TDM Lama (PA-1 s/d PA-5)
                        </Button>
                        <Button type="button" onClick={() => setTandemVariant("baru")}>
                          TDM Baru (PA-6 s/d PA-10)
                        </Button>
                      </div>
                    </Card>
                  ) : (
                    <p className="hint text-xs text-[var(--muted)] mb-4">
                      Line aktif: <b>{tandemVariant === "lama" ? "TDM Lama (PA-1 s/d PA-5)" : "TDM Baru (PA-6 s/d PA-10)"}</b>
                      {" — "}
                      <a
                        href="#"
                        className="underline text-blue-400"
                        onClick={(e) => {
                          e.preventDefault();
                          setTandemVariant(null);
                        }}
                      >
                        ganti line
                      </a>
                    </p>
                  )}
                </div>
              )}

              {/* Cards per Stasiun */}
              <div className="space-y-6">
                {stationList().map((st) => {
                  const line = linesHook.getLine(st.id);
                  const targetSt = dbStasiun(st.id);
                  const stPlanning = planningList.filter(
                    (p) => (p.stasiun || null) === targetSt
                  );
                  const todayStr = new Date().toISOString().slice(0, 10);
                  const stActualToday = productionRows.filter(
                    (p) => (p.stasiun || null) === targetSt && String(p.waktu_awal).slice(0, 10) === todayStr
                  );

                  const form = newPlanningForm[st.id] || { part_number: "", qty_rencana: "", jam_mulai: "", jam_selesai: "" };
                  const stationGlow = line.phase === "running" ? "card-glow-good"
                    : (line.phase === "awaiting_gap" || line.phase === "awaiting_actual_start" || line.phase === "awaiting_next_choice" || line.phase === "nonproduksi_running") ? "card-glow-warn"
                    : "card-glow-info";

                  return (
                    <Card key={st.id} className={`dash-panel station-card ${stationGlow}`}>
                      <div className="flex justify-between items-center mb-4">
                        {st.label && (
                          <p className="dash-panel-title font-bold text-base mb-0">{st.label}</p>
                        )}
                        <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-teal-900/40 text-teal-300 border border-teal-700/50">
                          {line.phase}
                        </span>
                      </div>

                      {/* Aksi sesuai fase state machine */}
                      <div className="mb-5">
                        {line.phase === "idle" && (
                          <Button
                            type="button"
                            className="btn-pulse"
                            onClick={() => linesHook.clickMulai(st.id)}
                          >
                            <Play size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} /> Mulai Produksi
                          </Button>
                        )}
                        {line.phase === "awaiting_gap" && (
                          <div className="space-y-2 p-2.5 rounded bg-amber-950/20 border border-amber-500/40">
                            <p className="font-bold text-xs text-amber-400 flex items-center gap-1">
                              <span><Timer size={13} style={{ display: "inline", verticalAlign: "middle" }} /></span> Ada jeda sebelum ini — jenis non-produksi apa?
                            </p>
                            {line.gapInfo && (
                              <p className="text-[11px] font-mono text-[var(--muted)]">
                                Jeda: {fmtClock(line.gapInfo.gapStart)} → {fmtClock(line.gapInfo.gapEnd)}
                              </p>
                            )}
                            <div className="field">
                              <label className="text-[11px] block text-[var(--muted)] mb-1">Jenis Non-Produksi</label>
                                                            <Select
                                className="text-xs h-8"
                                value={line.gapForm.nonproduksi_nama}
                                onChange={(e) => linesHook.setGapFormField(st.id, "nonproduksi_nama", e.target.value)}
                              >
                                <option value="">- pilih -</option>
                                {nonProduksiTypes.map((t) => (
                                  <option key={t.id} value={t.nama}>
                                    {t.nama}
                                  </option>
                                ))}
                              </Select>
                            </div>
                            <div className="flex gap-2 pt-1">
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="flex-1 text-xs"
                                onClick={() => linesHook.cancelGapNonProduksi(st.id)}
                              >
                                Batal
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                className="flex-1 text-xs"
                                onClick={() => linesHook.confirmGapNonProduksi(st.id)}
                              >
                                Konfirmasi
                              </Button>
                            </div>
                          </div>
                        )}
                        {line.phase === "awaiting_next_choice" && (
                          <div className="space-y-2 p-2.5 rounded bg-amber-950/20 border border-amber-500/40">
                            <p className="font-bold text-xs text-amber-400 flex items-center gap-1">
                              <span><Timer size={13} style={{ display: "inline", verticalAlign: "middle" }} /></span> Non-produksi selesai — lanjut apa?
                            </p>
                            <div className="flex gap-2 pt-1">
                              <Button
                                type="button"
                                size="sm"
                                className="flex-1 text-xs"
                                onClick={() => linesHook.chooseAfterNonProduksi(st.id, "setup")}
                              >
                                <Wrench size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} /> Setup (Dandori)
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="flex-1 text-xs"
                                onClick={() => linesHook.chooseAfterNonProduksi(st.id, "direct")}
                              >
                                <Play size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} /> Langsung Produksi
                              </Button>
                            </div>
                          </div>
                        )}
                        {line.phase === "awaiting_actual_start" && (
                          <div className="space-y-2">
                            <p className="text-xs text-amber-300 font-semibold flex items-center justify-between gap-2">
                              <span>
                                {line.skipDandori
                                  ? "Langsung produksi (tanpa dandori)"
                                  : `Dandori sejak ${fmtClock(line.entryStart)}`}
                              </span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => linesHook.cancelLine(st.id)}
                              >
                                Batal
                              </Button>
                            </p>
                            {stPlanning.length > 0 && (
                              <div className="space-y-1.5">
                                <p className="text-[11px] text-[var(--muted)]">Rencana produksi:</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {stPlanning.map((plan) => (
                                    <button
                                      key={plan.id || `${plan.part_number}-${plan.jam_rencana_mulai}`}
                                      type="button"
                                      className={`chip text-xs ${line.planningId === plan.id ? "chip-active" : ""}`}
                                      onClick={() => linesHook.choosePlannedPart(st.id, plan)}
                                    >
                                      {plan.part_number}
                                      {plan.qty_rencana ? ` (${fmtNum(plan.qty_rencana)})` : ""}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                            <p className="text-[11px] text-[var(--muted)]">
                              Pilih dari Planning kalau ada, atau pilih Part Number lain di bawah.
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="field col-span-2">
                                <label className="text-[11px] block text-[var(--muted)] mb-1">Part Number</label>
                                                                <Select
                                  className="text-xs h-8"
                                  value={line.form.part_number}
                                  onChange={(e) => linesHook.setFormField(st.id, "part_number", e.target.value)}
                                >
                                  <option value="">- Pilih Part Number -</option>
                                  {masterParts.map((part) => {
                                    const partNumber = part.kode_part || part.value || part.nama_part;
                                    return (
                                      <option key={part.id || partNumber} value={partNumber}>
                                        {partNumber}{part.nama_part && part.nama_part !== partNumber ? ` - ${part.nama_part}` : ""}
                                      </option>
                                    );
                                  })}
                                </Select>
                              </div>
                              <div className="field">
                                <label className="text-[11px] block text-[var(--muted)] mb-1">Qty</label>
                                <Input
                                  type="number"
                                  className="h-8 text-xs"
                                  value={line.form.qty}
                                  onChange={(e) => linesHook.setFormField(st.id, "qty", e.target.value === "" ? "" : Number(e.target.value))}
                                />
                              </div>
                              <div className="field">
                                <label className="text-[11px] block text-[var(--muted)] mb-1">Jumlah MP</label>
                                <Input
                                  type="number"
                                  className="h-8 text-xs"
                                  value={line.form.manpower}
                                  onChange={(e) => linesHook.setFormField(st.id, "manpower", e.target.value === "" ? "" : Number(e.target.value))}
                                />
                              </div>
                              {config.extraFields.map((f) => (
                                <div className="field" key={f.key}>
                                  <label className="text-[11px] block text-[var(--muted)] mb-1">{f.label}</label>
                                  <Input
                                    type={f.type}
                                    className="h-8 text-xs"
                                    value={line.form[f.key] ?? ""}
                                    onChange={(e) =>
                                      linesHook.setFormField(
                                        st.id,
                                        f.key,
                                        f.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value
                                      )
                                    }
                                  />
                                </div>
                              ))}
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              className="w-full text-xs"
                              onClick={() => linesHook.confirmActualStart(st.id)}
                            >
                              <CheckCircle size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} /> Konfirmasi Produksi Mulai
                            </Button>
                          </div>
                        )}
                        {line.phase === "running" && (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-[var(--text)]">
                              Produksi <b>{line.form.part_number}</b> — mulai aktual <b>{fmtClock(line.actualStartConfirmedAt)}</b>
                            </span>
                            <Button
                              type="button"
                              variant="destructive"
                              className="btn-pulse-danger flex items-center justify-center gap-1"
                              onClick={() => linesHook.stopProduksi(st.id)}
                            >
                              <Square size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} /> Selesai Produksi
                            </Button>
                          </div>
                        )}
                        {line.phase === "finished" && (
                          <div className="space-y-2 p-2.5 rounded bg-teal-950/20 border border-teal-500/40">
                            <p className="font-bold text-xs text-teal-300">
                              Selesai jam {fmtClock(line.entryEnd)} — lanjut apa?
                            </p>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                className="flex-1 text-xs"
                                onClick={() => linesHook.chooseSetupNext(st.id)}
                              >
                                <Wrench size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} /> Setup (ganti part)
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="flex-1 text-xs"
                                onClick={() => linesHook.chooseNonProduksiNext(st.id)}
                              >
                                Non-Produksi
                              </Button>
                            </div>
                          </div>
                        )}
                        {line.phase === "nonproduksi_running" && (
                          <div className="space-y-2 p-2.5 rounded bg-amber-950/20 border border-amber-500/40">
                            <p className="font-bold text-xs text-amber-400 flex items-center gap-1">
                              <span><Timer size={13} style={{ display: "inline", verticalAlign: "middle" }} /></span> Non-Produksi sejak {fmtClock(line.nonProdActiveStart)}
                            </p>
                            <div className="field">
                              <label className="text-[11px] block text-[var(--muted)] mb-1">Jenis</label>
                                                            <Select
                                className="text-xs h-8"
                                value={line.nonProdForm.nama}
                                onChange={(e) => linesHook.setNonProdFormField(st.id, "nama", e.target.value)}
                              >
                                <option value="">- pilih -</option>
                                {nonProduksiTypes.map((t) => (
                                  <option key={t.id} value={t.nama}>
                                    {t.nama}
                                  </option>
                                ))}
                              </Select>
                            </div>
                            <p className="text-[11px] text-[var(--muted)]">
                              &quot;Mulai Produksi&quot; kalau part berikutnya mau dikerjakan sekarang (otomatis menutup non-produksi ini). &quot;Selesai (Tutup Shift)&quot; kalau mesin memang berhenti beroperasi sampai shift berikutnya.
                            </p>
                            <div className="flex gap-2 pt-1">
                              <Button
                                type="button"
                                size="sm"
                                className="btn-pulse flex-1 text-xs"
                                onClick={() => linesHook.clickMulai(st.id)}
                              >
                                <Play size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} /> Mulai Produksi
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="flex-1 text-xs"
                                onClick={() => linesHook.endNonProduksiAndStop(st.id)}
                              >
                                <Square size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} /> Selesai (Tutup Shift)
                              </Button>
                            </div>
                          </div>
                        )}
                        {/* Edit Data Produksi sekarang pakai modal global (lihat ModalShell di bawah HeaderNav) */}
                      </div>

                      {/* Planning vs Aktual Grid */}
                      <div className="planning-actual-grid">
                        {/* Kolom Kiri: PLANNING PRODUKSI */}
                        <div className="planning-col">
                          <p className="panel-subtitle">PLANNING PRODUKSI</p>
                          {isLeaderOrAdmin && (
                            <div className="planning-add-row flex flex-wrap gap-2 mb-3 items-center">
                                            <Select
                                className="text-xs h-8"
                                style={{ minWidth: "140px", flex: 1 }}
                                value={form.part_number}
                                onChange={(e) =>
                                  setNewPlanningForm((prev) => ({
                                    ...prev,
                                    [st.id]: { ...form, part_number: e.target.value },
                                  }))
                                }
                              >
                                <option value="">Part Number</option>
                                {masterParts.map((p) => {
                                  const val = p.kode_part || p.value || "";
                                  return (
                                    <option key={p.id || val} value={val}>
                                      {val}
                                    </option>
                                  );
                                })}
                              </Select>

                              <Input
                                type="number"
                                placeholder="Qty"
                                className="h-8 w-20 text-xs"
                                value={form.qty_rencana}
                                onChange={(e) =>
                                  setNewPlanningForm((prev) => ({
                                    ...prev,
                                    [st.id]: {
                                      ...form,
                                      qty_rencana: e.target.value === "" ? "" : Number(e.target.value),
                                    },
                                  }))
                                }
                              />

                              <Input
                                type="datetime-local"
                                title="Jam rencana mulai"
                                className="h-8 text-xs font-mono"
                                value={form.jam_mulai}
                                onChange={(e) =>
                                  setNewPlanningForm((prev) => ({
                                    ...prev,
                                    [st.id]: { ...form, jam_mulai: e.target.value },
                                  }))
                                }
                              />

                              <Input
                                type="datetime-local"
                                title="Jam rencana selesai"
                                className="h-8 text-xs font-mono"
                                value={form.jam_selesai}
                                onChange={(e) =>
                                  setNewPlanningForm((prev) => ({
                                    ...prev,
                                    [st.id]: { ...form, jam_selesai: e.target.value },
                                  }))
                                }
                              />

                              <Button
                                type="button"
                                size="sm"
                                className="px-3 py-1.5 text-xs"
                                onClick={() => handleAddPlanning(st.id)}
                              >
                                + Add
                              </Button>
                            </div>
                          )}

                          <div className="planning-list">
                            {stPlanning.map((p) => (
                              <div
                                key={p.id}
                                className={`planning-item ${p.status === "selesai" ? "planning-done" : ""}`}
                              >
                                <span className="font-semibold">{p.part_number}</span>
                                <span className="hint text-xs text-[var(--muted)]">
                                  {p.qty_rencana ? `${p.qty_rencana}pcs` : "-"} · {fmtClock(p.jam_rencana_mulai)}-{fmtClock(p.jam_rencana_selesai)}
                                </span>
                                {isLeaderOrAdmin && p.id && (
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    className="px-1.5 py-0.5 text-xs ml-2"
                                    onClick={() => handleDeletePlanning(p.id!)}
                                  >
                                    ✕
                                  </Button>
                                )}
                              </div>
                            ))}
                            {stPlanning.length === 0 && (
                              <p className="empty-state text-xs text-[var(--muted)] py-4 text-center">
                                Belum ada rencana.
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Kolom Kanan: AKTUAL PRODUKSI (HARI INI) */}
                        <div className="planning-col">
                          <p className="panel-subtitle">AKTUAL PRODUKSI (HARI INI)</p>
                          <div className="planning-list">
                            {["awaiting_actual_start", "running"].includes(line.phase) && line.form.part_number && (
                              <div className="planning-item planning-current">
                                <span className="timer-dot timer-dot-live" />
                                <span className="font-semibold">{line.form.part_number}</span>
                                <span className="hint text-xs text-emerald-400">
                                  {line.phase === "running" ? "sedang produksi" : "sedang dandori"} · mulai {fmtClock(line.entryStart)}
                                </span>
                              </div>
                            )}

                            {stActualToday.map((r, idx) => (
                              <div key={r.id || idx} className="planning-item">
                                <span className="font-semibold">{r.part_number}</span>
                                <span className="hint text-xs text-[var(--muted)]">
                                  {r.qty ?? "-"}pcs · {fmtClock(r.waktu_awal)}-{fmtClock(r.waktu_akhir)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* Riwayat Hari Ini — port dari database-main/machines/tandem.html (~baris 293-345) */}
              <Card className="dash-panel card-glow-info mt-6">
                <p className="dash-panel-title font-bold text-base mb-1">
                  Riwayat Hari Ini <span className="count">{riwayatHariIni.length} baris</span>
                </p>
                <p className="hint text-xs text-[var(--muted)] mb-3">
                  Riwayat lengkap semua tanggal ada di tab "Riwayat Produksi".
                </p>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th className="col-hide-mobile">Kode</th>
                        {config.stationConfig.mode !== "none" && <th className="col-hide-mobile">Stasiun</th>}
                        <th className="col-hide-mobile">Waktu Awal</th>
                        <th className="col-hide-mobile">Waktu Akhir</th>
                        <th>Part Number</th>
                        <th>Qty</th>
                        <th>MP</th>
                        <th className="col-hide-mobile">Earned</th>
                        <th className="col-hide-mobile">Operation</th>
                        <th>Availability</th>
                        <th>Dandori</th>
                        <th>Downtime</th>
                        <th>Break</th>
                        {config.routingMax > 0 && <th className="col-hide-mobile">Routing</th>}
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {riwayatHariIni.map((row: any, idx) => {
                        const data = row.data;
                        const earned = earnedMenit(row);
                        const operation = operationMenit(row);
                        const availability = rowAvailability(row);
                        const routing = data.extra?.routing_type
                          ? `${data.extra.routing_type}${data.extra.routing_numbers ? ` ${data.extra.routing_numbers.join(",")}` : ""}`
                          : "-";
                        const canEditRow = canDeleteRow(row) && (row.jenis === "produksi" || row.jenis === "non_produksi");
                        const rowClick = canEditRow
                          ? () => (row.jenis === "produksi" ? handleEditProductionRow(data) : handleEditNonProduksiRow(data))
                          : undefined;

                        return (
                          <tr
                            key={`hari-ini-${row.jenis}-${data.id || idx}`}
                            className={canEditRow ? "row-clickable" : ""}
                            onClick={rowClick}
                          >
                            <td className="mono col-hide-mobile">{row.jenis === "produksi" ? (data.kode || "-") : "-"}</td>
                            {config.stationConfig.mode !== "none" && <td className="mono col-hide-mobile">{data.stasiun || "-"}</td>}
                            <td className="mono col-hide-mobile">{fmt(row.waktu_awal)}</td>
                            <td className="mono col-hide-mobile">{fmt(row.waktu_akhir)}</td>
                            <td title={row.part_number || "-"}>{row.part_number || "-"}</td>
                            <td className="mono">{row.jenis === "produksi" ? fmtNum(data.qty) : "-"}</td>
                            <td className="mono">{row.jenis === "produksi" ? fmtNum(data.manpower) : "-"}</td>
                            <td className="mono col-hide-mobile">{earned !== null ? `${fmtNum(earned)} mnt` : "-"}</td>
                            <td className="mono col-hide-mobile">{operation !== null ? `${fmtNum(operation)} mnt` : "-"}</td>
                            <td className="mono" title={availability === null ? availabilityHint(row) : undefined}>
                              {availability !== null ? `${fmtNum(availability)}%` : availabilityHint(row)}
                            </td>
                            <td className="mono">{row.jenis === "produksi" ? `${fmtNum(data.dandori_menit ?? 0)} mnt` : "-"}</td>
                            <td className="mono">
                              {row.jenis === "produksi" && (data.downtime_menit ?? 0) > 0 ? (
                                <span
                                  className="underline text-amber-400 cursor-pointer"
                                  onClick={(e) => { e.stopPropagation(); handleViewDowntimeForProduction(data); }}
                                >
                                  {fmtNum(data.downtime_menit)} mnt
                                </span>
                              ) : (
                                <span>{row.jenis === "produksi" ? `${fmtNum(data.downtime_menit ?? 0)} mnt` : "-"}</span>
                              )}
                            </td>
                            <td className="mono">{row.jenis === "produksi" ? `${fmtNum(data.break_menit ?? 0)} mnt` : "-"}</td>
                            {config.routingMax > 0 && <td className="col-hide-mobile">{row.jenis === "produksi" ? routing : "-"}</td>}
                            <td>
                              <div className="flex gap-1.5">
                              {row.jenis === "produksi" && canDeleteRow(row) && (
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    title="Edit baris produksi ini"
                                    onClick={(e) => { e.stopPropagation(); handleEditProductionRow(data); }}
                                  >
                                    <Pencil size={13} />
                                  </Button>
                                )}
                                {row.jenis === "non_produksi" && canDeleteRow(row) && (
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    title="Edit baris non-produksi ini"
                                    onClick={(e) => { e.stopPropagation(); handleEditNonProduksiRow(data); }}
                                  >
                                    <Pencil size={13} />
                                  </Button>
                                )}
                                {canDeleteRow(row) && (
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    title="Hapus baris ini"
                                    onClick={(e) => { e.stopPropagation(); setRiwayatDeleteTarget(row); }}
                                  >
                                    <X size={13} />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {riwayatHariIni.length === 0 && (
                        <tr>
                          <td
                            colSpan={
                              (config.stationConfig.mode !== "none" ? 14 : 13) + (config.routingMax > 0 ? 1 : 0)
                            }
                            className="empty-state text-center py-6"
                          >
                            Belum ada data untuk hari ini.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* ================= TAB 2: RIWAYAT ================= */}
          {activeTab === "riwayat" && (
            <>
              {/* Edit Data Non-Produksi sekarang pakai modal global (lihat ModalShell di bawah HeaderNav) */}
              <Card className="dash-panel card-glow-info">
              <div className="flex flex-wrap justify-between gap-3 mb-4">
                <h3 className="dash-panel-title font-bold text-base">Riwayat Produksi</h3>
                <Button type="button" variant="secondary" size="sm" onClick={resetRiwayatFilter}>
                  Reset Filter
                </Button>
              </div>
              <div className="form-grid mb-4">
                <div className="field">
                  <label>Dari Tanggal</label>
                  <Input type="date" value={riwayatTanggalDari} onChange={(e) => setRiwayatTanggalDari(e.target.value)} />
                </div>
                <div className="field">
                  <label>Sampai Tanggal</label>
                  <Input type="date" value={riwayatTanggalSampai} onChange={(e) => setRiwayatTanggalSampai(e.target.value)} />
                </div>
                <div className="field">
                  <label>Part Number</label>
                                    <Select value={riwayatPartNumber} onChange={(e) => setRiwayatPartNumber(e.target.value)}>
                    <option value="">Semua</option>
                    {masterParts.map((part) => {
                      const partNumber = part.kode_part || part.value || part.nama_part;
                      return <option key={part.id || partNumber} value={partNumber}>{partNumber}</option>;
                    })}
                  </Select>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th className="col-hide-mobile">Kode</th>
                      {config.stationConfig.mode !== "none" && <th className="col-hide-mobile">Stasiun</th>}
                      <th className="col-hide-mobile">Waktu Awal</th>
                      <th className="col-hide-mobile">Waktu Akhir</th>
                      <th>Part Number</th>
                      <th>Qty</th>
                      <th>MP</th>
                      <th>Dandori</th>
                      <th>DT</th>
                      <th>Break</th>
                      {config.routingMax > 0 && <th className="col-hide-mobile">Routing</th>}
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {riwayatGabungan.map((row: any, idx) => {
                      const data = row.data;
                      const routing = data.extra?.routing_type
                        ? `${data.extra.routing_type}${data.extra.routing_numbers ? ` ${data.extra.routing_numbers.join(",")}` : ""}`
                        : "-";
                      const canEditRow = canDeleteRow(row) && (row.jenis === "produksi" || row.jenis === "non_produksi");
                      const rowClick = canEditRow
                        ? () => (row.jenis === "produksi" ? handleEditProductionRow(data) : handleEditNonProduksiRow(data))
                        : undefined;

                      return (
                        <tr
                          key={`${row.jenis}-${data.id || idx}`}
                          className={canEditRow ? "row-clickable" : ""}
                          onClick={rowClick}
                        >
                          <td className="mono col-hide-mobile">{row.jenis === "produksi" ? (data.kode || "-") : "-"}</td>
                          {config.stationConfig.mode !== "none" && <td className="mono col-hide-mobile">{data.stasiun || "-"}</td>}
                          <td className="mono col-hide-mobile">{fmt(row.waktu_awal)}</td>
                          <td className="mono col-hide-mobile">{fmt(row.waktu_akhir)}</td>
                          <td>{row.part_number || "-"}</td>
                          <td className="mono">{row.jenis === "produksi" ? fmtNum(data.qty) : "-"}</td>
                          <td className="mono">{row.jenis === "produksi" ? fmtNum(data.manpower) : "-"}</td>
                          <td className="mono">{row.jenis === "produksi" ? `${fmtNum(data.dandori_menit ?? 0)} mnt` : "-"}</td>
                          <td className="mono">
                            {row.jenis === "produksi" && (data.downtime_menit ?? 0) > 0 ? (
                              <span
                                className="underline text-amber-400 cursor-pointer"
                                onClick={(e) => { e.stopPropagation(); handleViewDowntimeForProduction(data); }}
                              >
                                {fmtNum(data.downtime_menit)} mnt
                              </span>
                            ) : (
                              <span>{row.jenis === "produksi" ? `${fmtNum(data.downtime_menit ?? 0)} mnt` : "-"}</span>
                            )}
                          </td>
                          <td className="mono">{row.jenis === "produksi" ? `${fmtNum(data.break_menit ?? 0)} mnt` : "-"}</td>
                          {config.routingMax > 0 && <td className="col-hide-mobile">{row.jenis === "produksi" ? routing : "-"}</td>}
                          <td>
                            <div className="flex gap-1.5">
                              {row.jenis === "produksi" && canDeleteRow(row) && (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  title="Edit baris produksi ini"
                                  onClick={(e) => { e.stopPropagation(); handleEditProductionRow(data); }}
                                >
                                  <Pencil size={13} />
                                </Button>
                              )}
                              {row.jenis === "non_produksi" && canDeleteRow(row) && (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  title="Edit baris non-produksi ini"
                                  onClick={(e) => { e.stopPropagation(); handleEditNonProduksiRow(data); }}
                                >
                                  <Pencil size={13} />
                                </Button>
                              )}
                              {canDeleteRow(row) && (
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  title="Hapus baris ini"
                                  onClick={(e) => { e.stopPropagation(); setRiwayatDeleteTarget(row); }}
                                >
                                  <X size={13} />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {riwayatGabungan.length === 0 && (
                      <tr>
                        <td colSpan={config.stationConfig.mode !== "none" ? (config.routingMax > 0 ? 12 : 11) : (config.routingMax > 0 ? 11 : 10)} className="empty-state text-center py-6">
                          Belum ada data untuk filter ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              </Card>
            </>
          )}

          {/* ================= TAB 3: PERFORMANCE ================= */}
          {activeTab === "performance" && (
            <div>
              {/* Section Toggle Chips */}
              <div className="perf-toggle-row flex gap-2 mb-4">
                <button
                  type="button"
                  className={`chip chip-lg ${activePerfSection === "tahunan" ? "chip-active" : ""}`}
                  onClick={() => setActivePerfSection("tahunan")}
                >
                  Tahunan
                </button>
                <button
                  type="button"
                  className={`chip chip-lg ${activePerfSection === "bulanan" ? "chip-active" : ""}`}
                  onClick={() => setActivePerfSection("bulanan")}
                >
                  Bulanan
                </button>
                <button
                  type="button"
                  className={`chip chip-lg ${activePerfSection === "harian" ? "chip-active" : ""}`}
                  onClick={() => setActivePerfSection("harian")}
                >
                  Harian
                </button>
              </div>

              {/* Performance Main Panel */}
              <Card className="dash-panel card-glow-info">
                <div className="perf-header flex justify-between items-center mb-4">
                  <p className="dash-panel-title font-bold text-base m-0">
                    Performance {activePerfSection === "tahunan" ? "Tahunan" : activePerfSection === "bulanan" ? "Bulanan" : "Harian"}
                  </p>
                  <div className="perf-nav flex items-center gap-2">
                    {activePerfSection === "tahunan" && (
                      <Input
                        type="number"
                        min="2000"
                        max="2100"
                        className="h-8 w-20 text-xs font-mono"
                        value={perfYear}
                        onChange={(e) => setPerfYear(Number(e.target.value))}
                      />
                    )}
                    {activePerfSection === "bulanan" && (
                      <Input
                        type="month"
                        className="h-8 text-xs font-mono"
                        value={perfMonth}
                        onChange={(e) => setPerfMonth(e.target.value)}
                      />
                    )}
                    {activePerfSection === "harian" && (
                      <Input
                        type="date"
                        className="h-8 text-xs font-mono"
                        value={perfDate}
                        onChange={(e) => setPerfDate(e.target.value)}
                      />
                    )}
                    <span className="perf-period-label font-bold text-xs text-[var(--amber)]">
                      {activePerfSection === "tahunan"
                        ? perfYear
                        : activePerfSection === "bulanan"
                          ? new Date(perfMonth + "-01T00:00:00").toLocaleDateString("id-ID", { month: "long", year: "numeric" })
                          : new Date(perfDate + "T00:00:00").toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}
                    </span>
                  </div>
                </div>

                {perfLoading ? (
                  <p className="empty-state">Menghitung performance...</p>
                ) : !perfData.data ? (
                  <p className="empty-state">Belum ada data performance.</p>
                ) : (
                  <div>
                    {/* Top Grid */}
                    <div className="perf-top-grid">
                      {/* Cards Column */}
                      <div className="perf-cards-col">
                        <Card className={`perf-card perf-card-oee ${perfData.data.oee >= 75 ? "card-glow-good" : perfData.data.oee >= 50 ? "card-glow-warn" : "card-glow-bad"}`}>
                          <span className="perf-label">OEE</span>
                          <span className="perf-value perf-value-xl">{fmtNum(perfData.data.oee)}%</span>
                          <span className="perf-oee-breakdown text-xs text-[var(--muted)] block mt-1">
                            A <b>{fmtNum(perfData.data.availability)}</b>% · P <b>{fmtNum(perfData.data.performanceFactor)}</b>% · Q <b>{fmtNum(perfData.data.quality)}</b>%
                          </span>
                        </Card>
                        <Card className={`perf-card perf-card-accent ${perfData.data.performanceFactor >= 95 ? "card-glow-good" : perfData.data.performanceFactor >= 80 ? "card-glow-warn" : "card-glow-bad"}`}>
                          <span className="perf-label">GSPH Aktual</span>
                          <span className="perf-value">{fmtNum(perfData.data.gsph)}</span>
                        </Card>
                        <Card className="perf-card card-glow-info">
                          <span className="perf-label">GSPH Target</span>
                          <span className="perf-value">{fmtNum(perfData.data.targetGsph)}</span>
                        </Card>
                        <Card className="perf-card card-glow-info">
                          <span className="perf-label">Stroke (Qty)</span>
                          <span className="perf-value">{fmtNum(perfData.data.stroke)}</span>
                        </Card>
                        <Card className={`perf-card ${perfData.data.stroke > 0 && (perfData.data.ng / perfData.data.stroke) <= 0.005 ? "card-glow-good" : "card-glow-warn"}`}>
                          <span className="perf-label">NG</span>
                          <span className="perf-value">{fmtNum(perfData.data.ng)}</span>
                        </Card>
                        <Card className="perf-card card-glow-info">
                          <span className="perf-label">Downtime</span>
                          <span className="perf-value">{fmtNum(perfData.data.downtimeMenit)} mnt</span>
                        </Card>
                        <Card className="perf-card card-glow-info">
                          <span className="perf-label">Dandori</span>
                          <span className="perf-value">{fmtNum(perfData.data.dandoriMenit)} mnt</span>
                        </Card>
                        <Card className="perf-card card-glow-info">
                          <span className="perf-label">Break</span>
                          <span className="perf-value">{fmtNum(perfData.data.breakMenit)} mnt</span>
                        </Card>
                        <Card className="perf-card card-glow-info">
                          <span className="perf-label">Jam Kerja</span>
                          <span className="perf-value">{fmtNum(perfData.data.whJam)} jam</span>
                        </Card>
                      </div>

                      {/* Chart Column */}
                      <div className="perf-chart-col">
                        {activePerfSection !== "harian" ? (
                          <div className="perf-chart-wrap">
                            <canvas ref={perfChartRef} />
                          </div>
                        ) : (
                          <div className="perf-daily-split grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="perf-daily-chart">
                              <p className="panel-subtitle font-bold text-xs mb-2">GSPH Target vs Aktual</p>
                              <div style={{ height: 140, position: "relative" }}>
                                <canvas ref={perfChartRef} />
                              </div>
                            </div>
                            <div className="perf-daily-list">
                              <p className="panel-subtitle font-bold text-xs mb-2">
                                Produksi Hari Itu <span className="count font-mono text-[var(--muted)]">({perfDayRows.length} baris)</span>
                              </p>
                              <div className="table-wrap" style={{ maxHeight: 230 }}>
                                <table className="table-compact text-xs">
                                  <thead>
                                    <tr>
                                      {config.stationConfig.mode !== "none" && <th>Stasiun</th>}
                                      <th>Mulai</th>
                                      <th>Selesai</th>
                                      <th>Part Number</th>
                                      <th>Qty</th>
                                      <th>Dandori</th>
                                      <th>DT</th>
                                      <th>Break</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {perfDayRows.length > 0 ? (
                                      perfDayRows.map((row: any) => (
                                        <tr key={row.id}>
                                          {config.stationConfig.mode !== "none" && (
                                            <td className="mono">{row.stasiun || "-"}</td>
                                          )}
                                          <td className="mono">{row.waktu_awal ? new Date(row.waktu_awal).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-"}</td>
                                          <td className="mono">{row.waktu_akhir ? new Date(row.waktu_akhir).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-"}</td>
                                          <td>{row.part_number || "-"}</td>
                                          <td className="mono">{fmtNum(row.qty)}</td>
                                          <td className="mono">{fmtNum(row.dandori_menit || 0)}</td>
                                          <td className="mono">{fmtNum(row.downtime_menit || 0)}</td>
                                          <td className="mono">{fmtNum(row.break_menit || 0)}</td>
                                        </tr>
                                      ))
                                    ) : (
                                      <tr>
                                        <td colSpan={8} className="empty-state text-center py-4">
                                          Tidak ada produksi di tanggal ini.
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Lower Grid */}
                    <div className="perf-lower-grid">
                      <div className="perf-lower-col">
                        <p className="panel-subtitle font-bold text-xs mb-2">5 Downtime Terburuk</p>
                        <div className="table-wrap">
                          <table className="table-compact text-xs">
                            <thead>
                              <tr>
                                <th>Kategori</th>
                                <th>Problem</th>
                                <th>Menit</th>
                              </tr>
                            </thead>
                            <tbody>
                              {perfData.top5.length > 0 ? (
                                perfData.top5.map((row, idx) => (
                                  <tr key={idx}>
                                    <td title={row.kategori}><span className="badge">{row.kategori}</span></td>
                                    <td title={row.problem} style={{ minWidth: 100, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.problem}</td>
                                    <td className="mono">{fmtNum(row.menit)}</td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={3} className="empty-state text-center py-4">
                                    Tidak ada downtime.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="perf-lower-col">
                        <p className="panel-subtitle font-bold text-xs mb-2">
                          Downtime per Kategori
                          <span className="ml-1 text-[var(--muted)] font-mono font-normal">({config.kategoriOptions.join(" / ")})</span>
                        </p>
                        <div className="perf-pie-wrap">
                          <canvas ref={perfPieRef} />
                        </div>
                        {perfData.byCategory.length > 0 && (
                          <p className="perf-pie-summary text-xs text-[var(--muted)] mt-2">
                            {downtimeKesimpulan()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          )}


          {/* ================= TAB 4: DOWNTIME ================= */}
          {activeTab === "downtime" && (
            <div className="space-y-4">
              <Card className="dash-panel card-glow-info">
                <p className="dash-panel-title font-bold text-base mb-3">
                  {editingDowntimeId ? "Edit Data Downtime" : "Catat Downtime"}
                </p>

                {!editingDowntimeId && (
                  <div className="timer-row flex items-center gap-3">
                    {dtState === "idle" ? (
                      <Button type="button" onClick={startDowntime}>
                        <Play size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} /> Mulai Downtime
                      </Button>
                    ) : (
                      <div className="timer-badge flex items-center gap-2">
                        <span className={`timer-dot ${dtState === "running" ? "timer-dot-live" : ""}`}></span>
                        <span>Mulai <b>{fmtClock(dtStart)}</b></span>
                        {dtState === "running" ? (
                          <Button type="button" variant="secondary" size="sm" onClick={stopDowntime}>
                            <Square size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} /> Selesai
                          </Button>
                        ) : (
                          <span>· Selesai <b>{fmtClock(dtEnd)}</b></span>
                        )}
                        <Button type="button" variant="ghost" size="sm" onClick={cancelDowntime}>Batal</Button>
                      </div>
                    )}
                  </div>
                )}

                <p className="hint text-xs text-[var(--muted)] mt-3">
                  Waktu downtime harus pas di dalam satu baris produksi (tidak boleh melintasi 2 part) — sistem akan menolak otomatis kalau tidak cocok.
                </p>

                {(editingDowntimeId || dtState === "stopped") && (
                  <form onSubmit={submitDowntime} className="mt-4">
                    <div className="form-grid">
                      {config.stationConfig.mode !== "none" && (
                        <div className="field">
                          <label>Stasiun</label>
                                                    <Select
                            value={dtForm.stasiun}
                            onChange={(e) => setDtForm((prev) => ({ ...prev, stasiun: e.target.value }))}
                          >
                            <option value="">- pilih -</option>
                            {stationList().map((st) => (
                              <option key={st.id} value={dbStasiun(st.id) || ""}>{st.label}</option>
                            ))}
                          </Select>
                        </div>
                      )}
                      <div className="field">
                        <label>Kategori</label>
                                                <Select
                          value={dtForm.kategori}
                          onChange={(e) => setDtForm((prev) => ({ ...prev, kategori: e.target.value }))}
                        >
                          <option value="">- pilih -</option>
                          {config.kategoriOptions.map((k) => (
                            <option key={k} value={k}>{k}</option>
                          ))}
                        </Select>
                      </div>
                      <div className="field" style={{ gridColumn: "span 2" }}>
                        <label>Problem</label>
                        <ProblemCombobox
                          options={problemList.map((p) => p.value)}
                          value={dtForm.problem}
                          onChange={(v) => setDtForm((prev) => ({ ...prev, problem: v }))}
                        />
                      </div>
                      <div className="field" style={{ gridColumn: "span 2" }}>
                        <label>Penyebab</label>
                        <Input
                          type="text"
                          value={dtForm.penyebab}
                          onChange={(e) => setDtForm((prev) => ({ ...prev, penyebab: e.target.value }))}
                        />
                      </div>
                      <div className="field" style={{ gridColumn: "span 2" }}>
                        <label>Countermeasure</label>
                        <Input
                          type="text"
                          value={dtForm.countermeasure}
                          onChange={(e) => setDtForm((prev) => ({ ...prev, countermeasure: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="form-actions flex gap-2 justify-end">
                      <Button type="button" variant="ghost" onClick={cancelDowntime}>Batal</Button>
                      <Button type="submit">
                        {editingDowntimeId ? "Simpan Perubahan" : "Simpan Data"}
                      </Button>
                    </div>
                  </form>
                )}
              </Card>
              <Card className="dash-panel card-glow-info">
                <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                  <h3 className="dash-panel-title font-bold text-base mb-0">
                    Riwayat Downtime <span className="count">{downtimeRowsFiltered().length} baris</span>
                  </h3>
                  {downtimeFilterProductionId && (
                    <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                      <span>Filter aktif: <b className="text-[var(--text)]">{downtimeFilterLabel}</b></span>
                      <Button type="button" variant="ghost" size="sm" onClick={clearDowntimeFilter}>
                        <FilterX size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} /> Hapus Filter
                      </Button>
                    </div>
                  )}
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        {config.stationConfig.mode !== "none" && <th>Stasiun</th>}
                        <th>Waktu Awal</th>
                        <th>Waktu Akhir</th>
                        <th>Durasi</th>
                        <th>Kategori</th>
                        <th>Problem</th>
                        <th>Penyebab</th>
                        <th>Countermeasure</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {downtimeRowsFiltered().map((row) => (
                        <tr key={row.id}>
                          {config.stationConfig.mode !== "none" && <td>{row.stasiun || "-"}</td>}
                          <td>{fmt(row.waktu_awal)}</td>
                          <td>{fmt(row.waktu_akhir)}</td>
                          <td>{durasiMenit(row.waktu_awal, row.waktu_akhir)}</td>
                          <td><span className="badge">{row.kategori || "-"}</span></td>
                          <td title={row.problem || "-"}>{row.problem || "-"}</td>
                          <td title={row.penyebab || "-"}>{row.penyebab || "-"}</td>
                          <td title={row.countermeasure || "-"}>{row.countermeasure || "-"}</td>
                          <td className="flex gap-1">
                            <Button type="button" variant="ghost" size="sm" onClick={() => editDowntime(row)}>Edit</Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => deleteDowntime(row.id)}>Hapus</Button>
                          </td>
                        </tr>
                      ))}
                      {downtimeRowsFiltered().length === 0 && (
                        <tr>
                          <td colSpan={config.stationConfig.mode !== "none" ? 9 : 8} className="text-center text-[var(--muted)] py-6">
                            {downtimeFilterProductionId
                              ? "Tidak ada catatan downtime untuk baris produksi ini."
                              : "Belum ada catatan downtime."}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {/* ================= TAB 6: MASTER DATA ================= */}
          {activeTab === "master_data" && isLeaderOrAdmin && (
            <div className="space-y-6">
              {/* Panel 1: Target GSPH & Availability */}
              <Card className="dash-panel card-glow-info">
                <h3 className="dash-panel-title font-bold text-base mb-1">Target GSPH & Availability</h3>
                <p className="text-xs text-[var(--muted)] mb-4">
                  Garis target di grafik Performance. Operator cuma bisa lihat, admin/leader yang bisa atur.
                </p>

                <div className="form-grid mb-4">
                  <div className="field col-span-2">
                    <label>Mode Target</label>
                    <div className="chip-row flex gap-2 mt-1">
                      <button
                        type="button"
                        className={`chip ${mesinSettingsDraft.gsph_target_mode === "fixed" ? "chip-active" : ""
                          }`}
                        onClick={() =>
                          setMesinSettingsDraft({ ...mesinSettingsDraft, gsph_target_mode: "fixed" })
                        }
                      >
                        Target Sama (semua tanggal)
                      </button>
                      <button
                        type="button"
                        className={`chip ${mesinSettingsDraft.gsph_target_mode === "per_part" ? "chip-active" : ""
                          }`}
                        onClick={() =>
                          setMesinSettingsDraft({ ...mesinSettingsDraft, gsph_target_mode: "per_part" })
                        }
                      >
                        Target per Part (dari Std CT)
                      </button>
                    </div>
                  </div>

                  {mesinSettingsDraft.gsph_target_mode === "fixed" && (
                    <div className="field">
                      <label>Angka Target GSPH</label>
                      <Input
                        type="number"
                        value={mesinSettingsDraft.gsph_target_fixed}
                        onChange={(e) =>
                          setMesinSettingsDraft({
                            ...mesinSettingsDraft,
                            gsph_target_fixed: e.target.value === "" ? "" : Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  )}

                  <div className="field">
                    <label>Target Availability (%)</label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={mesinSettingsDraft.target_availability}
                      onChange={(e) =>
                        setMesinSettingsDraft({
                          ...mesinSettingsDraft,
                          target_availability: e.target.value === "" ? "" : Number(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>

                <div className="form-actions">
                  <Button type="button" onClick={handleSaveMesinSettings}>
                    Simpan Target
                  </Button>
                </div>
              </Card>

              {/* Panel 2: CRUD Part Number */}
              <Card className="dash-panel card-glow-info">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="dash-panel-title font-bold text-base">
                      Daftar Part Number <span className="text-xs font-mono text-[var(--muted)]">({masterParts.length} item)</span>
                    </h3>
                    <p className="text-xs text-[var(--muted)]">
                      Kelola master part number, cycle time, next process, dan harga per pcs.
                    </p>
                  </div>
                </div>

                {/* Form Tambah Part Number */}
                <form onSubmit={handleAddPartNumber} className="bg-[var(--bg)] p-4 rounded border border-[var(--border)] mb-6">
                  <h4 className="text-xs font-mono font-bold uppercase mb-3 text-[var(--amber)]">+ Tambah Part Number Baru</h4>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <div>
                      <label className="text-xs block mb-1">Kode Part *</label>
                      <Input
                        type="text"
                        placeholder="Kode Part"
                        value={newPartKode}
                        onChange={(e) => setNewPartKode(e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label className="text-xs block mb-1">Nama Part</label>
                      <Input
                        type="text"
                        placeholder="Nama Part"
                        value={newPartNama}
                        onChange={(e) => setNewPartNama(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs block mb-1">Std CT (mnt/stroke)</label>
                      <Input
                        type="number"
                        step="0.0001"
                        placeholder="mis. 0.05"
                        value={newPartStdCt}
                        onChange={(e) => setNewPartStdCt(e.target.value === "" ? "" : Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <label className="text-xs block mb-1">SPM (otomatis)</label>
                      <Input
                        type="text"
                        disabled
                        className="opacity-70 bg-black/20"
                        value={newPartStdCt && Number(newPartStdCt) > 0 ? (1 / Number(newPartStdCt)).toFixed(2) : "-"}
                      />
                    </div>
                    <div>
                      <label className="text-xs block mb-1">Next Process</label>
                      <Input
                        type="text"
                        placeholder="mis. Welding"
                        value={newPartNextProcess}
                        onChange={(e) => setNewPartNextProcess(e.target.value)}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs block mb-1">Harga per Pcs (Rp)</label>
                      <Input
                        type="number"
                        placeholder="mis. 5000"
                        value={newPartHarga}
                        onChange={(e) => setNewPartHarga(e.target.value === "" ? "" : Number(e.target.value))}
                      />
                    </div>
                    <div className="md:col-span-3 flex items-end">
                      <Button type="submit" className="w-full">
                        + Simpan Part Number
                      </Button>
                    </div>
                  </div>
                </form>

                {/* Tabel Part Number */}
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Kode Part</th>
                        <th>Nama Part</th>
                        <th>Std CT (mnt)</th>
                        <th>SPM</th>
                        <th>Next Process</th>
                        <th>Harga (Rp)</th>
                        <th className="text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {masterParts.map((p) => {
                        const isEditing = editingPartId === p.id;
                        const ctVal = p.std_ct ?? (p.ct_detik ? p.ct_detik / 60 : 0);
                        const spmVal = ctVal && ctVal > 0 ? (1 / ctVal).toFixed(2) : "-";

                        if (isEditing) {
                          return (
                            <tr key={p.id || p.kode_part}>
                              <td>
                                <Input
                                  type="text"
                                  className="w-full text-xs h-7 p-1"
                                  value={editPartForm.kode_part}
                                  onChange={(e) => setEditPartForm({ ...editPartForm, kode_part: e.target.value })}
                                />
                              </td>
                              <td>
                                <Input
                                  type="text"
                                  className="w-full text-xs h-7 p-1"
                                  value={editPartForm.nama_part}
                                  onChange={(e) => setEditPartForm({ ...editPartForm, nama_part: e.target.value })}
                                />
                              </td>
                              <td>
                                <Input
                                  type="number"
                                  step="0.0001"
                                  className="w-24 text-xs h-7 p-1 font-mono"
                                  value={editPartForm.std_ct}
                                  onChange={(e) => setEditPartForm({ ...editPartForm, std_ct: e.target.value === "" ? "" : Number(e.target.value) })}
                                />
                              </td>
                              <td className="mono text-xs text-[var(--muted)]">
                                {editPartForm.std_ct && Number(editPartForm.std_ct) > 0
                                  ? (1 / Number(editPartForm.std_ct)).toFixed(2)
                                  : "-"}
                              </td>
                              <td>
                                <Input
                                  type="text"
                                  className="w-full text-xs h-7 p-1"
                                  value={editPartForm.next_process}
                                  onChange={(e) => setEditPartForm({ ...editPartForm, next_process: e.target.value })}
                                />
                              </td>
                              <td>
                                <Input
                                  type="number"
                                  className="w-28 text-xs h-7 p-1 font-mono"
                                  value={editPartForm.harga_rp}
                                  onChange={(e) => setEditPartForm({ ...editPartForm, harga_rp: e.target.value === "" ? "" : Number(e.target.value) })}
                                />
                              </td>
                              <td className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => p.id && handleSaveEditPartNumber(p.id)}
                                  >
                                    Simpan
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setEditingPartId(null)}
                                  >
                                    Batal
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr key={p.id || p.kode_part}>
                            <td><b className="font-mono">{p.kode_part || p.value}</b></td>
                            <td>{p.nama_part || p.kode_part || p.value}</td>
                            <td className="mono">{ctVal ? ctVal.toFixed(4) : "-"}</td>
                            <td className="mono font-bold text-[var(--amber)]">{spmVal}</td>
                            <td>{p.next_process || "-"}</td>
                            <td className="mono">{p.harga_rp || p.harga_pcs ? `Rp ${fmtNum(p.harga_rp || p.harga_pcs)}` : "-"}</td>
                            <td className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleStartEditPartNumber(p)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => p.id && handleDeletePartNumber(p.id)}
                                >
                                  Hapus
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {masterParts.length === 0 && (
                        <tr>
                          <td colSpan={7} className="text-center text-[var(--muted)] py-6">
                            Belum ada data Part Number untuk mesin ini.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Panel 3: CRUD Daftar Problem Downtime */}
              <Card className="dash-panel card-glow-info">
                <h3 className="dash-panel-title font-bold text-base">
                  Daftar Problem Downtime{" "}
                  <span className="text-xs font-mono text-[var(--muted)]">({problemList.length} item)</span>
                </h3>
                <div className="master-add-row flex gap-2 mb-4 mt-3">
                  <Input
                    type="text"
                    placeholder="Tambah problem baru..."
                    value={newProblemValue}
                    onChange={(e) => setNewProblemValue(e.target.value)}
                    onKeyUp={(e) => {
                      if (e.key === "Enter") handleAddProblem();
                    }}
                  />
                  <Button type="button" size="sm" onClick={handleAddProblem}>
                    + Tambah
                  </Button>
                </div>
                <div className="master-list">
                  {problemList.map((item) => (
                    <div key={item.id} className="master-list-row flex justify-between items-center py-2 border-b border-[var(--border)] last:border-0">
                      {editingProblemId === item.id ? (
                        <Input
                          type="text"
                          className="flex-1 text-xs h-8 mr-2"
                          value={editProblemValue}
                          onChange={(e) => setEditProblemValue(e.target.value)}
                          onKeyUp={(e) => {
                            if (e.key === "Enter") handleSaveEditProblem(item.id);
                          }}
                        />
                      ) : (
                        <span className="master-value">{item.value}</span>
                      )}
                      <div className="master-row-actions flex gap-1">
                        {editingProblemId === item.id ? (
                          <>
                            <Button type="button" size="sm" onClick={() => handleSaveEditProblem(item.id)}>
                              Simpan
                            </Button>
                            <Button type="button" variant="ghost" size="sm" onClick={handleCancelEditProblem}>
                              Batal
                            </Button>
                          </>
                        ) : (
                          <Button type="button" variant="secondary" size="sm" onClick={() => handleStartEditProblem(item)}>
                            Edit
                          </Button>
                        )}
                        <Button type="button" variant="destructive" size="sm" onClick={() => handleDeleteProblem(item.id)}>
                          Hapus
                        </Button>
                      </div>
                    </div>
                  ))}
                  {problemList.length === 0 && <p className="empty-state">Belum ada data.</p>}
                </div>
              </Card>

              {/* Panel 4: CRUD Jenis Non-Produksi */}
              <Card className="dash-panel card-glow-info">
                <h3 className="dash-panel-title font-bold text-base">
                  Daftar Jenis Non-Produksi{" "}
                  <span className="text-xs font-mono text-[var(--muted)]">({nonProduksiTypes.length} item)</span>
                </h3>
                <p className="text-xs text-[var(--muted)] mb-4">
                  Meeting Awal Shift, Watari, 5S, TPM, dll — dipilih operator saat klasifikasi jeda.
                </p>

                <div className="master-add-row flex gap-2 mb-4">
                  <Input
                    type="text"
                    placeholder="Tambah jenis baru..."
                    value={newNonProduksiTypeValue}
                    onChange={(e) => setNewNonProduksiTypeValue(e.target.value)}
                    onKeyUp={(e) => {
                      if (e.key === "Enter") handleAddNonProduksiType();
                    }}
                  />
                  <Button type="button" size="sm" onClick={handleAddNonProduksiType}>
                    + Tambah
                  </Button>
                </div>

                <div className="master-list">
                  {nonProduksiTypes.map((t) => (
                    <div key={t.id} className="master-list-row flex justify-between items-center py-2 border-b border-[var(--border)] last:border-0">
                      <span className="master-value">{t.nama}</span>
                      <div className="master-row-actions">
                        <Button type="button" variant="destructive" size="sm" onClick={() => handleDeleteNonProduksiType(t.id)}>
                          Hapus
                        </Button>
                      </div>
                    </div>
                  ))}
                  {nonProduksiTypes.length === 0 && (
                    <p className="empty-state">Belum ada data.</p>
                  )}
                </div>
              </Card>
            </div>
          )}
        </>
      )}

      {/* Modal Konfirmasi Hapus Riwayat — menggunakan Dialog shadcn */}
      {riwayatDeleteTarget && (
        <Dialog open={!!riwayatDeleteTarget} onOpenChange={(open) => { if (!open) setRiwayatDeleteTarget(null); }}>
          <DialogContent onClose={() => setRiwayatDeleteTarget(null)} maxWidth="max-w-md">
            <DialogHeader>
              <DialogTitle>Hapus Baris Riwayat</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-[var(--muted)] mb-4">
              Yakin ingin menghapus baris ini?{" "}
              <span className="font-semibold text-[var(--text)]">
                {riwayatDeleteTarget.jenis === "produksi"
                  ? `Produksi — ${riwayatDeleteTarget.part_number || "-"}`
                  : riwayatDeleteTarget.jenis === "downtime"
                  ? `Downtime — ${riwayatDeleteTarget.data?.kategori || "-"}`
                  : `Non-Produksi — ${riwayatDeleteTarget.data?.kategori || riwayatDeleteTarget.data?.keterangan || "-"}`}
              </span>{" "}
              pada{" "}
              {riwayatDeleteTarget.waktu_awal
                ? new Date(riwayatDeleteTarget.waktu_awal).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })
                : "-"}.
              <br />
              <span className="text-red-400 text-xs mt-1 block">Tindakan ini tidak bisa dibatalkan.</span>
            </p>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setRiwayatDeleteTarget(null)}
                disabled={isDeletingRiwayat}
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDeleteRiwayat}
                disabled={isDeletingRiwayat}
              >
                {isDeletingRiwayat ? "Menghapus…" : "Ya, Hapus"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </HeaderNav>
  );
}
