"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Chart from "chart.js/auto";
import { useThemeListener } from "@/hooks/produksi/useThemeListener";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import type {
  ProdMachineConfig,
  ProdMasterPart,
  ProdProfile,
  ProdProductionPlanning,
  ProdProductionLogRow,
  ProdDandoriLogRow,
  ProdNonProduksiType,
  ProdDowntimeLogRow,
  ProdDowntimeProblem,
} from "@/types/produksi";
import {
  useProductionLines,
  CommitPayload,
  NonProdPayload,
  UpdatePayload,
  toLocalInput,
  loadFromLocalStorage,
} from "@/hooks/produksi/useProductionLines";
import { enqueueOffline, isNetworkError } from "@/lib/produksi/offlineQueue";
import { useOfflineSync } from "@/hooks/produksi/useOfflineSync";
import { useFlash } from "@/hooks/produksi/useFlash";
import { usePanggilLeader } from "@/hooks/produksi/useAndon";
import { Bell } from "lucide-react";

import ProduksiTab from "./ProduksiTab";
import RiwayatTab from "./RiwayatTab";
import PerformanceTab from "./PerformanceTab";
import DowntimeTab from "./DowntimeTab";
import MasterDataTab from "./MasterDataTab";

export const MACHINE_CONFIGS: Record<string, ProdMachineConfig> = {
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

interface MachineDetailClientProps {
  machineSlug: string;
}

export default function MachineDetailClient({ machineSlug }: MachineDetailClientProps) {
  const supabase = createClient();
  const slug = machineSlug || "tandem";
  const config = MACHINE_CONFIGS[slug] || MACHINE_CONFIGS["tandem"];

  const [activeTab, setActiveTab] = useState<"produksi" | "riwayat" | "performance" | "downtime" | "master_data">("produksi");
  const [loading, setLoading] = useState(true);

  const theme = useThemeListener();

  const { flash } = useFlash();

  const [tandemVariant, setTandemVariant] = useState<"lama" | "baru" | null>(() => {
    if (config.stationConfig.mode !== "variant") return null;
    const saved = loadFromLocalStorage(config.key).tandemVariant;
    return saved === "lama" || saved === "baru" ? saved : null;
  });

  const [profile, setProfile] = useState<ProdProfile | null>(null);
  const isLeaderOrAdmin = Boolean(profile && ["admin", "leader"].includes(profile.role || ""));

  const { andonCalling, panggilLeader } = usePanggilLeader({
    mesin: config.key,
    triggeredBy: profile?.id || null,
    onDone: (msg, isError) => flash(msg, isError),
  });

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

  // Master Data CRUD States
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

  const [newNonProduksiTypeValue, setNewNonProduksiTypeValue] = useState("");
  const [newProblemValue, setNewProblemValue] = useState("");
  const [editingProblemId, setEditingProblemId] = useState<string | null>(null);
  const [editProblemValue, setEditProblemValue] = useState("");

  // Riwayat Filter States
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

  const [newPlanningForm, setNewPlanningForm] = useState<Record<string, {
    part_number: string;
    qty_rencana: number | "";
    jam_mulai: string;
    jam_selesai: string;
  }>>({});

  // Catat Downtime Timer & Form States
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
  const [problemList, setProblemList] = useState<ProdDowntimeProblem[]>([]);

  // Data Lists
  const [masterParts, setMasterParts] = useState<ProdMasterPart[]>([]);
  const [downtimeList, setDowntimeList] = useState<ProdDowntimeLogRow[]>([]);
  const [planningList, setPlanningList] = useState<ProdProductionPlanning[]>([]);
  const [productionRows, setProductionRows] = useState<ProdProductionLogRow[]>([]);
  const [nonProduksiRows, setNonProduksiRows] = useState<ProdDandoriLogRow[]>([]);
  const [nonProduksiTypes, setNonProduksiTypes] = useState<ProdNonProduksiType[]>([]);

  // Performance Tab States
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

  const perfChartRef = useRef<HTMLCanvasElement | null>(null);
  const perfPieRef = useRef<HTMLCanvasElement | null>(null);
  const perfChartInstancesRef = useRef<Record<string, Chart>>({});

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

  useEffect(() => {
    async function fetchProfile() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .maybeSingle();
        if (data) setProfile(data as ProdProfile);
      }
    }
    fetchProfile();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Mesin Settings
      const { data: settingsData } = await supabase
        .from("prod_mesin_settings" as any)
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

      // 2. Part Numbers (from prod_part_numbers)
      const { data: pNumData, error: pNumErr } = await supabase
        .from("prod_part_numbers" as any)
        .select("*")
        .eq("mesin", config.key)
        .order("value");

      if (!pNumErr && pNumData) {
        const mappedParts: ProdMasterPart[] = pNumData.map((p: any) => ({
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
      }

      // 3. Production Log
      const { data: pRows } = await supabase
        .from("prod_production_log" as any)
        .select("*")
        .eq("mesin", config.key)
        .order("waktu_awal", { ascending: false })
        .limit(500);
      if (pRows) setProductionRows(pRows as ProdProductionLogRow[]);

      // 4. Downtime Log
      const { data: dt } = await supabase
        .from("prod_downtime_log" as any)
        .select("*")
        .eq("mesin", config.key)
        .order("waktu_awal", { ascending: false })
        .limit(500);
      if (dt) setDowntimeList(dt as ProdDowntimeLogRow[]);

      // 5. Downtime Problems Master
      const { data: probs } = await supabase
        .from("prod_downtime_problems" as any)
        .select("*")
        .eq("mesin", config.key)
        .order("value", { ascending: true });
      if (probs) setProblemList(probs as ProdDowntimeProblem[]);

      // 6. Dandori / Non-Produksi Log
      const { data: dRows } = await supabase
        .from("prod_dandori_log" as any)
        .select("*")
        .eq("mesin", config.key)
        .order("waktu_awal", { ascending: false })
        .limit(500);
      if (dRows) setNonProduksiRows(dRows as ProdDandoriLogRow[]);

      // 7. Non-Produksi Types
      const { data: npTypes } = await supabase
        .from("prod_nonproduksi_types" as any)
        .select("*")
        .eq("mesin", config.key)
        .order("nama", { ascending: true });
      if (npTypes) setNonProduksiTypes(npTypes as ProdNonProduksiType[]);

      // 8. Production Planning
      const { data: planData } = await supabase
        .from("prod_production_planning" as any)
        .select("*")
        .eq("mesin", config.key)
        .order("jam_rencana_mulai", { ascending: true });
      if (planData) setPlanningList(planData as ProdProductionPlanning[]);
    } catch (err: any) {
      console.error("Machine load error:", err?.message || err?.details || JSON.stringify(err) || err);
    } finally {
      setLoading(false);
    }
  }, [config.key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetRiwayatFilter = () => {
    setRiwayatTanggalDari("");
    setRiwayatTanggalSampai("");
    setRiwayatPartNumber("");
  };

  const fetchGabunganRange = useCallback(
    async (waktuDari: string | null, waktuSampai: string | null, partNumberFilter: string) => {
      let productionQuery = supabase.from("prod_production_log" as any).select("*").eq("mesin", config.key);
      if (waktuDari) productionQuery = productionQuery.gte("waktu_awal", waktuDari);
      if (waktuSampai) productionQuery = productionQuery.lte("waktu_awal", waktuSampai);
      if (partNumberFilter) productionQuery = productionQuery.eq("part_number", partNumberFilter);

      let nonProduksiQuery = supabase.from("prod_dandori_log" as any).select("*").eq("mesin", config.key);
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
    [config.key] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const fetchRiwayatGabungan = useCallback(async () => {
    const waktuDari = riwayatTanggalDari ? `${riwayatTanggalDari}T00:00:00.000Z` : null;
    const waktuSampai = riwayatTanggalSampai ? `${riwayatTanggalSampai}T23:59:59.999Z` : null;
    const gabungan = await fetchGabunganRange(waktuDari, waktuSampai, riwayatPartNumber);
    setRiwayatGabungan(gabungan);
  }, [fetchGabunganRange, riwayatPartNumber, riwayatTanggalDari, riwayatTanggalSampai]);

  const fetchRiwayatHariIniData = useCallback(async () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const waktuDari = `${todayStr}T00:00:00.000Z`;
    const waktuSampai = `${todayStr}T23:59:59.999Z`;
    const gabungan = await fetchGabunganRange(waktuDari, waktuSampai, "");
    setRiwayatHariIni(gabungan);
  }, [fetchGabunganRange]);

  const canDeleteRow = (row: any): boolean => {
    if (!profile) return false;
    if (isLeaderOrAdmin) return true;
    const todayStr = new Date().toISOString().slice(0, 10);
    const rowDate = row.waktu_awal ? String(row.waktu_awal).slice(0, 10) : null;
    return (
      profile.id != null &&
      row.data?.created_by === profile.id &&
      rowDate === todayStr
    );
  };

  const handleEditProductionRow = (data: any) => {
    const stationId = data.stasiun || "_single";
    if (config.stationConfig.mode === "variant" && data.stasiun) {
      if (config.stationConfig.variants?.lama.includes(data.stasiun)) setTandemVariant("lama");
      else if (config.stationConfig.variants?.baru.includes(data.stasiun)) setTandemVariant("baru");
    }
    linesHook.startEditProduction(stationId, data as ProdProductionLogRow);
  };

  const handleEditNonProduksiRow = (data: any) => {
    setNonProduksiEditForm({
      waktu_awal: toLocalInput(data.waktu_awal),
      waktu_akhir: toLocalInput(data.waktu_akhir),
      nama: data.part_ke || data.keterangan || "",
    });
    setEditingNonProduksiId(data.id);
  };

  const handleViewDowntimeForProduction = (row: any) => {
    setDowntimeFilterProductionId(row.id);
    setDowntimeFilterLabel(`${row.part_number || "-"} (${new Date(row.waktu_awal).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })})`);
    setActiveTab("downtime");
  };

  const clearDowntimeFilter = () => {
    setDowntimeFilterProductionId(null);
    setDowntimeFilterLabel("");
  };

  const handleCancelEditNonProduksi = () => {
    setEditingNonProduksiId(null);
    setNonProduksiEditForm({ waktu_awal: "", waktu_akhir: "", nama: "" });
  };

  const handleSaveNonProduksiEdit = async () => {
    const f = nonProduksiEditForm;
    const payload = {
      waktu_awal: new Date(f.waktu_awal).toISOString(),
      waktu_akhir: new Date(f.waktu_akhir).toISOString(),
      part_ke: f.nama,
      keterangan: f.nama,
    };
    try {
      const { error } = await supabase.from("prod_dandori_log" as any).update(payload).eq("id", editingNonProduksiId);
      if (error) throw error;
      handleCancelEditNonProduksi();
      await fetchRiwayatGabungan();
      await fetchRiwayatHariIniData();
    } catch (err: any) {
      flash("Gagal menyimpan data non-produksi: " + (err?.message || JSON.stringify(err)), true);
    }
  };

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
        ? "prod_production_log"
        : row.jenis === "downtime"
        ? "prod_downtime_log"
        : "prod_dandori_log";

    try {
      setIsDeletingRiwayat(true);
      const { error } = await supabase.from(table as any).delete().eq("id", row.data.id);
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

  const activeStationIds = React.useMemo(() => {
    return stationList().map((st) => st.id);
  }, [stationList]);

  const { refreshPendingCount } = useOfflineSync({
    onSynced: (synced) => {
      flash(`${synced} data offline berhasil disinkron.`);
      loadData();
      fetchRiwayatHariIniData();
      if (activeTab === "riwayat") fetchRiwayatGabungan();
    },
  });

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
        const { error } = await supabase.from("prod_production_log" as any).insert(row);
        if (error) throw error;

        if (payload.planningId) {
          await supabase
            .from("prod_production_planning" as any)
            .update({ status: "selesai" })
            .eq("id", payload.planningId);
        }

        flash("Data produksi tersimpan.");
        loadData();
        fetchRiwayatHariIniData();
      } catch (err: any) {
        if (isNetworkError(err)) {
          enqueueOffline("prod_production_log", row);
          refreshPendingCount();
          setProductionRows((prev) => [
            { ...row, id: "pending_" + Date.now(), _pending: true } as ProdProductionLogRow,
            ...prev,
          ]);
        } else {
          flash("Gagal menyimpan produksi: " + (err?.message || JSON.stringify(err)), true);
        }
      }
    },
    [loadData, fetchRiwayatHariIniData, refreshPendingCount] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleUpdateProduction = useCallback(
    async (stId: string, stationDbId: string | null, id: string, payload: UpdatePayload) => {
      try {
        const { error } = await supabase.from("prod_production_log" as any).update(payload).eq("id", id);
        if (error) throw error;
        flash("Data produksi diperbarui.");
        loadData();
        fetchRiwayatHariIniData();
      } catch (err: any) {
        flash("Gagal memperbarui produksi: " + (err?.message || JSON.stringify(err)), true);
      }
    },
    [loadData, fetchRiwayatHariIniData] // eslint-disable-line react-hooks/exhaustive-deps
  );

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
        const { error } = await supabase.from("prod_dandori_log" as any).insert(row);
        if (error) throw error;
        loadData();
        fetchRiwayatHariIniData();
      } catch (err: any) {
        if (isNetworkError(err)) {
          enqueueOffline("prod_dandori_log", row);
          refreshPendingCount();
          setNonProduksiRows((prev) => [
            { ...row, id: "pending_" + Date.now(), _pending: true } as ProdDandoriLogRow,
            ...prev,
          ]);
        } else {
          flash("Gagal menyimpan non-produksi: " + (err?.message || JSON.stringify(err)), true);
        }
      }
    },
    [loadData, fetchRiwayatHariIniData, refreshPendingCount] // eslint-disable-line react-hooks/exhaustive-deps
  );

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

  const editingStationEntry = Object.entries(linesHook.lines).find(
    ([, l]) => l.phase === "edit"
  );

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

      const { error } = await supabase.from("prod_production_planning" as any).insert([payload]);
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
      const { error } = await supabase.from("prod_production_planning" as any).delete().eq("id", id);
      if (error) throw error;
      flash("Rencana produksi dihapus.");
      loadData();
    } catch (err: any) {
      flash("Gagal menghapus rencana produksi: " + (err?.message || JSON.stringify(err)), true);
    }
  };

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
        .from("prod_mesin_settings" as any)
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

  // CRUD Part Number
  const handleAddPartNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartKode.trim()) return;

    try {
      const payload = {
        mesin: config.key,
        value: newPartKode.trim(),
        std_ct: newPartStdCt === "" ? null : Number(newPartStdCt),
        harga_pcs: newPartHarga === "" ? null : Number(newPartHarga),
      };

      const { error } = await supabase.from("prod_part_numbers" as any).insert([payload]);
      if (error) throw error;

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

  const handleStartEditPartNumber = (part: ProdMasterPart) => {
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
      const payload = {
        value: editPartForm.kode_part.trim(),
        std_ct: editPartForm.std_ct === "" ? null : Number(editPartForm.std_ct),
        harga_pcs: editPartForm.harga_rp === "" ? null : Number(editPartForm.harga_rp),
      };

      const { error } = await supabase.from("prod_part_numbers" as any).update(payload).eq("id", id);
      if (error) throw error;

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
      const { error } = await supabase.from("prod_part_numbers" as any).delete().eq("id", id);
      if (error) throw error;
      flash("Part Number berhasil dihapus!");
      loadData();
    } catch (err: any) {
      flash("Gagal menghapus Part Number: " + (err?.message || JSON.stringify(err)), true);
    }
  };

  // CRUD Jenis Non-Produksi
  const handleAddNonProduksiType = async () => {
    const v = newNonProduksiTypeValue.trim();
    if (!v) return;
    try {
      const { error } = await supabase.from("prod_nonproduksi_types" as any).insert({ mesin: config.key, nama: v });
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
      const { error } = await supabase.from("prod_nonproduksi_types" as any).delete().eq("id", id);
      if (error) throw error;
      loadData();
    } catch (err: any) {
      flash("Gagal hapus jenis non-produksi: " + (err?.message || JSON.stringify(err)), true);
    }
  };

  // CRUD Problem Downtime
  const handleAddProblem = async () => {
    const v = newProblemValue.trim();
    if (!v) return;
    try {
      const { data, error } = await supabase
        .from("prod_downtime_problems" as any)
        .insert({ mesin: config.key, value: v })
        .select()
        .single();
      if (error) throw error;
      setProblemList((prev) => [...prev, data as ProdDowntimeProblem].sort((a, b) => a.value.localeCompare(b.value)));
      setNewProblemValue("");
    } catch (err: any) {
      flash("Gagal tambah problem: " + (err?.message || JSON.stringify(err)), true);
    }
  };

  const handleStartEditProblem = (item: ProdDowntimeProblem) => {
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
      const { data, error } = await supabase.from("prod_downtime_problems" as any).update({ value: v }).eq("id", id).select();
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
      const { error } = await supabase.from("prod_downtime_problems" as any).delete().eq("id", id);
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
        Promise.resolve(supabase.rpc("prod_downtime_top_problems" as any, { p_mesin: config.key, p_stasiun_list: stasiunList, p_start: stIso, p_end: endIso, p_limit: 5 })).catch(() => ({ data: null })),
        Promise.resolve(supabase.rpc("prod_downtime_by_category" as any, { p_mesin: config.key, p_stasiun_list: stasiunList, p_start: stIso, p_end: endIso })).catch(() => ({ data: null })),
      ]);

      const trendResults = await Promise.all(
        periods.map(async (p) => {
          if (p.separator) return { label: "", gsph: null, targetGsph: null, separator: true };
          const pStartIso = p.start.toISOString(), pEndIso = p.end.toISOString();

          let aggRpc: any = null;
          try {
            aggRpc = await supabase.rpc("prod_performance_aggregate" as any, {
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
            let pq = supabase.from("prod_production_log" as any).select("*").eq("mesin", config.key).gte("waktu_awal", pStartIso).lt("waktu_awal", pEndIso);
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

            let dq = supabase.from("prod_downtime_log" as any).select("*").eq("mesin", config.key).gte("waktu_awal", pStartIso).lt("waktu_awal", pEndIso);
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
          .from("prod_production_log" as any)
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
  }, [activeTab, activePerfSection, perfYear, perfMonth, perfDate, config.key, tandemVariant, mesinSettings, masterParts, downtimeList]); // eslint-disable-line react-hooks/exhaustive-deps

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
              legend: { display: true, position: "top", align: "end", labels: { color: getCssVar("--muted-foreground") || "#94a3b8", boxWidth: 8, boxHeight: 8, usePointStyle: true, font: { size: 10 } } },
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
              legend: { display: true, position: "top", align: "end", labels: { color: getCssVar("--muted-foreground") || "#94a3b8", boxWidth: 8, boxHeight: 8, usePointStyle: true, font: { size: 10 } } },
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
                  color: getCssVar("--muted-foreground") || "#94a3b8",
                  boxWidth: 8,
                  boxHeight: 8,
                  usePointStyle: true,
                  font: { size: 10 },
                  generateLabels: (chart: any) => {
                    const dataset = chart.data.datasets[0];
                    const total = (dataset.data as number[]).reduce((a: number, b: number) => a + b, 0);
                    const legendTextColor = getCssVar("--muted-foreground") || "#94a3b8";
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
      .from("prod_downtime_problems" as any)
      .insert({ mesin: config.key, value })
      .select()
      .single();
    if (!error && data) setProblemList((prev) => [...prev, data as ProdDowntimeProblem]);
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
        const { error } = await supabase.from("prod_downtime_log" as any).update(payload).eq("id", editingDowntimeId);
        if (error) throw error;
      } else {
        const { data: { session } } = await supabase.auth.getSession();
        const { error } = await supabase.from("prod_downtime_log" as any).insert({ ...payload, created_by: session?.user?.id });
        if (error) throw error;
      }

      cancelDowntime();
      await loadData();
    } catch (err: any) {
      flash("Gagal menyimpan downtime: " + (err?.message || JSON.stringify(err)), true);
    }
  };

  const editDowntime = (row: ProdDowntimeLogRow) => {
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
      const { error } = await supabase.from("prod_downtime_log" as any).delete().eq("id", id);
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

  const availabilityHint = (row: any): string => {
    if (row.jenis !== "produksi") return "-";
    if (!row.data?.qty) return "Qty kosong";
    if (!stdCtFor(row.data.part_number)) return "Std CT belum diisi di Master Data";
    return "-";
  };

  return (
    <div className="machine-hub-container">
      {/* Modal global — Edit Data Produksi */}
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
                <div className="form-actions flex gap-2 justify-end mt-4">
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
          <div className="form-actions flex gap-2 justify-end mt-4">
            <Button type="button" variant="ghost" onClick={handleCancelEditNonProduksi}>
              Batal
            </Button>
            <Button type="button" onClick={handleSaveNonProduksiEdit}>
              Simpan
            </Button>
          </div>
        </ModalShell>
      )}

      {/* Header Bagian Mesin */}
      <div className="page-header flex flex-wrap justify-between items-center mb-6 gap-4">
        <div>
          <h1 className="page-title text-2xl font-bold font-display">
            <span className="eyebrow block text-xs font-semibold text-blue-400 uppercase tracking-wider mb-0.5">Mesin</span>
            {config.label}
          </h1>
        </div>
      </div>

      <div className="panggil-leader-row">
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="btn-panggil-leader w-full"
          onClick={() => {
            const alasan = prompt("Alasan panggilan (opsional):");
            if (alasan === null) return;
            panggilLeader(alasan);
          }}
          disabled={andonCalling}
        >
          <Bell size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} /> Panggil Leader
        </Button>
      </div>

      <div className="machine-tabs-bar flex items-center gap-2.5 flex-wrap">
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
        <Button
          type="button"
          variant={activeTab === "master_data" ? "default" : "secondary"}
          size="sm"
          onClick={() => setActiveTab("master_data")}
        >
          Master Data
        </Button>
      </div>

      {loading ? (
        <p className="empty-state">Memuat data mesin...</p>
      ) : (
        <>
          {activeTab === "produksi" && (
            <ProduksiTab
              config={config}
              tandemVariant={tandemVariant}
              setTandemVariant={setTandemVariant}
              stationList={stationList}
              dbStasiun={dbStasiun}
              linesHook={linesHook}
              planningList={planningList}
              productionRows={productionRows}
              masterParts={masterParts}
              nonProduksiTypes={nonProduksiTypes}
              newPlanningForm={newPlanningForm}
              setNewPlanningForm={setNewPlanningForm}
              handleAddPlanning={handleAddPlanning}
              handleDeletePlanning={handleDeletePlanning}
              riwayatHariIni={riwayatHariIni}
              isLeaderOrAdmin={isLeaderOrAdmin}
              canDeleteRow={canDeleteRow}
              handleEditProductionRow={handleEditProductionRow}
              handleEditNonProduksiRow={handleEditNonProduksiRow}
              handleViewDowntimeForProduction={handleViewDowntimeForProduction}
              setRiwayatDeleteTarget={setRiwayatDeleteTarget}
              fmt={fmt}
              fmtClock={fmtClock}
              fmtNum={fmtNum}
              earnedMenit={earnedMenit}
              operationMenit={operationMenit}
              rowAvailability={rowAvailability}
              availabilityHint={availabilityHint}
            />
          )}

          {activeTab === "riwayat" && (
            <RiwayatTab
              config={config}
              masterParts={masterParts}
              riwayatTanggalDari={riwayatTanggalDari}
              setRiwayatTanggalDari={setRiwayatTanggalDari}
              riwayatTanggalSampai={riwayatTanggalSampai}
              setRiwayatTanggalSampai={setRiwayatTanggalSampai}
              riwayatPartNumber={riwayatPartNumber}
              setRiwayatPartNumber={setRiwayatPartNumber}
              resetRiwayatFilter={resetRiwayatFilter}
              riwayatGabungan={riwayatGabungan}
              canDeleteRow={canDeleteRow}
              handleEditProductionRow={handleEditProductionRow}
              handleEditNonProduksiRow={handleEditNonProduksiRow}
              handleViewDowntimeForProduction={handleViewDowntimeForProduction}
              setRiwayatDeleteTarget={setRiwayatDeleteTarget}
              fmt={fmt}
              fmtNum={fmtNum}
            />
          )}

          {activeTab === "performance" && (
            <PerformanceTab
              config={config}
              activePerfSection={activePerfSection}
              setActivePerfSection={setActivePerfSection}
              perfYear={perfYear}
              setPerfYear={setPerfYear}
              perfMonth={perfMonth}
              setPerfMonth={setPerfMonth}
              perfDate={perfDate}
              setPerfDate={setPerfDate}
              perfLoading={perfLoading}
              perfData={perfData}
              perfDayRows={perfDayRows}
              perfChartRef={perfChartRef}
              perfPieRef={perfPieRef}
              downtimeKesimpulan={downtimeKesimpulan}
              fmtNum={fmtNum}
            />
          )}

          {activeTab === "downtime" && (
            <DowntimeTab
              config={config}
              isLeaderOrAdmin={isLeaderOrAdmin}
              dtState={dtState}
              dtStart={dtStart}
              dtEnd={dtEnd}
              dtForm={dtForm}
              setDtForm={setDtForm}
              problemList={problemList}
              stationList={stationList}
              dbStasiun={dbStasiun}
              startDowntime={startDowntime}
              cancelDowntime={cancelDowntime}
              stopDowntime={stopDowntime}
              submitDowntime={submitDowntime}
              editingDowntimeId={editingDowntimeId}
              downtimeRowsFiltered={downtimeRowsFiltered}
              downtimeFilterProductionId={downtimeFilterProductionId}
              downtimeFilterLabel={downtimeFilterLabel}
              clearDowntimeFilter={clearDowntimeFilter}
              editDowntime={editDowntime}
              deleteDowntime={deleteDowntime}
              durasiMenit={durasiMenit}
              fmt={fmt}
              fmtClock={fmtClock}
            />
          )}

          {activeTab === "master_data" && (
            <MasterDataTab
              config={config}
              isLeaderOrAdmin={isLeaderOrAdmin}
              mesinSettingsDraft={mesinSettingsDraft}
              setMesinSettingsDraft={setMesinSettingsDraft}
              handleSaveMesinSettings={handleSaveMesinSettings}
              masterParts={masterParts}
              newPartKode={newPartKode}
              setNewPartKode={setNewPartKode}
              newPartNama={newPartNama}
              setNewPartNama={setNewPartNama}
              newPartStdCt={newPartStdCt}
              setNewPartStdCt={setNewPartStdCt}
              newPartNextProcess={newPartNextProcess}
              setNewPartNextProcess={setNewPartNextProcess}
              newPartHarga={newPartHarga}
              setNewPartHarga={setNewPartHarga}
              handleAddPartNumber={handleAddPartNumber}
              editingPartId={editingPartId}
              editPartForm={editPartForm}
              setEditPartForm={setEditPartForm}
              handleStartEditPartNumber={handleStartEditPartNumber}
              handleSaveEditPartNumber={handleSaveEditPartNumber}
              setEditingPartId={setEditingPartId}
              handleDeletePartNumber={handleDeletePartNumber}
              nonProduksiTypes={nonProduksiTypes}
              newNonProduksiTypeValue={newNonProduksiTypeValue}
              setNewNonProduksiTypeValue={setNewNonProduksiTypeValue}
              handleAddNonProduksiType={handleAddNonProduksiType}
              handleDeleteNonProduksiType={handleDeleteNonProduksiType}
              problemList={problemList}
              newProblemValue={newProblemValue}
              setNewProblemValue={setNewProblemValue}
              editingProblemId={editingProblemId}
              editProblemValue={editProblemValue}
              setEditProblemValue={setEditProblemValue}
              handleAddProblem={handleAddProblem}
              handleStartEditProblem={handleStartEditProblem}
              handleCancelEditProblem={handleCancelEditProblem}
              handleSaveEditProblem={handleSaveEditProblem}
              handleDeleteProblem={handleDeleteProblem}
              fmtNum={fmtNum}
            />
          )}
        </>
      )}

      {/* Modal Konfirmasi Hapus Riwayat */}
      {riwayatDeleteTarget && (
        <Dialog open={!!riwayatDeleteTarget} onOpenChange={(open) => { if (!open) setRiwayatDeleteTarget(null); }}>
          <DialogContent onClose={() => setRiwayatDeleteTarget(null)} maxWidth="max-w-md">
            <DialogHeader>
              <DialogTitle>Hapus Baris Riwayat</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground mb-4">
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
    </div>
  );
}
