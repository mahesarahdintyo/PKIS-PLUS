"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  Filter,
  RefreshCw,
  AlertTriangle,
  Activity,
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
  Check,
  Layers,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import "@/app/admin/(produksi)/produksi.css";

const PAGE_SIZE = 1000;

const BASE_MACHINES = [
  { key: "tandem", label: "Tandem" },
  { key: "blanking", label: "Blanking" },
  { key: "transfer_2000t", label: "Transfer 2000t" },
  { key: "transfer_800t", label: "Transfer 800t" },
  { key: "pc200t", label: "PC200t" },
];

const CATEGORY_OPTIONS = [
  { value: "all", label: "Semua Kategori" },
  { value: "MESIN", label: "MESIN" },
  { value: "DIES", label: "DIES" },
  { value: "FINGER", label: "FINGER" },
  { value: "LINE STOP", label: "LINE STOP" },
  { value: "SMALL STOP", label: "SMALL STOP" },
  { value: "OTHER", label: "OTHER" },
];

const FORM_CATEGORIES = [
  "MESIN",
  "DIES",
  "FINGER",
  "LINE STOP",
  "SMALL STOP",
  "OTHER",
];

function formatDate(iso?: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(iso?: string | null): string {
  if (!iso) return "--:--";
  return new Date(iso).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toLocalInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

interface DowntimeFormState {
  mesin: string;
  stasiun: string;
  waktu_awal: string;
  waktu_akhir: string;
  kategori: string;
  problem: string;
  penyebab: string;
  countermeasure: string;
}

const emptyForm = (): DowntimeFormState => {
  const now = new Date();
  const past = new Date(now.getTime() - 15 * 60000); // 15 mins ago
  return {
    mesin: "tandem",
    stasiun: "",
    waktu_awal: toLocalInput(past.toISOString()),
    waktu_akhir: toLocalInput(now.toISOString()),
    kategori: "MESIN",
    problem: "",
    penyebab: "",
    countermeasure: "",
  };
};

export default function DowntimeLogClient() {
  const supabase = useMemo(() => createClient(), []);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const sevenDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  }, []);

  // Filter States
  const [filterMesin, setFilterMesin] = useState<string>("all");
  const [filterTanggalDari, setFilterTanggalDari] = useState<string>(sevenDaysAgo);
  const [filterTanggalSampai, setFilterTanggalSampai] = useState<string>(today);
  const [filterKategori, setFilterKategori] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Data States
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [page, setPage] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [downtimeRows, setDowntimeRows] = useState<any[]>([]);
  const [problemSuggestions, setProblemSuggestions] = useState<string[]>([]);
  const [lines, setLines] = useState<any[]>([]);

  // Bulk Selection States
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState<boolean>(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState<boolean>(false);
  const [bulkDeleteError, setBulkDeleteError] = useState<string>("");

  // Create Modal States
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [createForm, setCreateForm] = useState<DowntimeFormState>(emptyForm());
  const [isSavingCreate, setIsSavingCreate] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string>("");

  // Edit Modal States
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<DowntimeFormState>(emptyForm());
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);
  const [editError, setEditError] = useState<string>("");

  // Delete Single Modal States
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string>("");

  const channelNameRef = useRef<string>(
    "downtime_log_watch_" + Math.random().toString(36).slice(2)
  );

  // Machine lookup list
  const machineOptions = useMemo(() => {
    const list = [...BASE_MACHINES];
    lines.forEach((l) => {
      if (l.id && !list.some((m) => m.key === l.id || m.key === l.name)) {
        list.push({ key: l.id, label: l.name });
      }
    });
    return list;
  }, [lines]);

  const getMachineLabel = useCallback(
    (key: string): string => {
      const m = machineOptions.find((item) => item.key === key);
      return m ? m.label : key;
    },
    [machineOptions]
  );

  // Load problem suggestions & lines
  useEffect(() => {
    async function loadAuxData() {
      try {
        const [{ data: probs }, { data: lineData }] = await Promise.all([
          supabase.from("prod_downtime_problems" as any).select("value").eq("is_active", true).order("value"),
          supabase.from("lines").select("id, name").eq("is_active", true).order("name"),
        ]);
        if (probs) {
          setProblemSuggestions(probs.map((p: any) => p.value).filter(Boolean));
        }
        if (lineData) {
          setLines(lineData);
        }
      } catch (err) {
        console.error("Auxiliary data load error:", err);
      }
    }
    loadAuxData();
  }, [supabase]);

  // Fetch Downtime
  const fetchDowntime = useCallback(
    async (targetPage = 0) => {
      if (targetPage > 0) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const from = targetPage * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        let q = supabase
          .from("prod_downtime_log" as any)
          .select("*")
          .eq("is_active", true)
          .order("waktu_awal", { ascending: false })
          .range(from, to);

        if (filterMesin !== "all") {
          q = q.eq("mesin", filterMesin);
        }

        if (filterKategori !== "all") {
          q = q.eq("kategori", filterKategori);
        }

        if (filterTanggalDari) {
          const startIso = new Date(`${filterTanggalDari}T00:00:00`).toISOString();
          q = q.gte("waktu_awal", startIso);
        }

        if (filterTanggalSampai) {
          const endIso = new Date(`${filterTanggalSampai}T23:59:59.999`).toISOString();
          q = q.lte("waktu_awal", endIso);
        }

        const { data, error } = await q;
        if (error) throw error;

        const rows = (data || []).map((r: any) => {
          let durasi = r.durasi_menit || r.durasi;
          if (!durasi && r.waktu_awal && r.waktu_akhir) {
            durasi = Math.round(
              (new Date(r.waktu_akhir).getTime() - new Date(r.waktu_awal).getTime()) / 60000
            );
          }
          return {
            ...r,
            durasi_menit: durasi || 0,
          };
        });

        if (targetPage === 0) {
          setDowntimeRows(rows);
        } else {
          setDowntimeRows((prev) => [...prev, ...rows]);
        }
        setHasMore((data?.length ?? 0) === PAGE_SIZE);
        setPage(targetPage);
      } catch (err: any) {
        console.error("Downtime fetch error:", err?.message || err);
        toast.error("Gagal memuat log downtime: " + (err?.message || ""));
      } finally {
        if (targetPage > 0) {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
    },
    [filterMesin, filterKategori, filterTanggalDari, filterTanggalSampai, supabase]
  );

  useEffect(() => {
    fetchDowntime(0);
  }, [fetchDowntime]);

  // Supabase Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(channelNameRef.current)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "prod_downtime_log" },
        () => {
          fetchDowntime(0);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDowntime, supabase]);

  const resetFilters = () => {
    setFilterMesin("all");
    setFilterTanggalDari(sevenDaysAgo);
    setFilterTanggalSampai(today);
    setFilterKategori("all");
    setSearchQuery("");
  };

  // Client-side search filtering
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return downtimeRows;
    const q = searchQuery.toLowerCase();
    return downtimeRows.filter((r) => {
      const problem = (r.problem || "").toLowerCase();
      const penyebab = (r.penyebab || "").toLowerCase();
      const countermeasure = (r.countermeasure || "").toLowerCase();
      const stasiun = (r.stasiun || "").toLowerCase();
      const mesin = (getMachineLabel(r.mesin) || "").toLowerCase();
      const kategori = (r.kategori || "").toLowerCase();
      return (
        problem.includes(q) ||
        penyebab.includes(q) ||
        countermeasure.includes(q) ||
        stasiun.includes(q) ||
        mesin.includes(q) ||
        kategori.includes(q)
      );
    });
  }, [downtimeRows, searchQuery, getMachineLabel]);

  // Bulk selection computed values
  const isAllSelected = useMemo(() => {
    return filteredRows.length > 0 && filteredRows.every((r) => selectedIds.has(r.id));
  }, [filteredRows, selectedIds]);

  const isIndeterminate = useMemo(() => {
    return filteredRows.some((r) => selectedIds.has(r.id)) && !isAllSelected;
  }, [filteredRows, selectedIds, isAllSelected]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRows.map((r) => r.id)));
    }
  };

  // ─── Create Handler ──────────────────────────────────────────────────────────
  const handleOpenCreate = () => {
    setCreateForm(emptyForm());
    setCreateError("");
    setShowCreateModal(true);
  };

  const handleSaveCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.mesin || !createForm.waktu_awal || !createForm.kategori) {
      setCreateError("Mesin, waktu awal, dan kategori wajib diisi.");
      return;
    }

    try {
      setIsSavingCreate(true);
      setCreateError("");

      const startMs = new Date(createForm.waktu_awal).getTime();
      const endMs = createForm.waktu_akhir ? new Date(createForm.waktu_akhir).getTime() : startMs;
      const durasi = Math.max(0, Math.round((endMs - startMs) / 60000));

      const payload = {
        mesin: createForm.mesin,
        stasiun: createForm.stasiun.trim() || null,
        waktu_awal: new Date(createForm.waktu_awal).toISOString(),
        waktu_akhir: createForm.waktu_akhir ? new Date(createForm.waktu_akhir).toISOString() : null,
        durasi_menit: durasi,
        durasi: durasi,
        kategori: createForm.kategori,
        problem: createForm.problem.trim() || null,
        penyebab: createForm.penyebab.trim() || null,
        countermeasure: createForm.countermeasure.trim() || null,
        is_active: true,
      };

      const { error } = await supabase.from("prod_downtime_log" as any).insert(payload);
      if (error) throw error;

      toast.success("Data downtime berhasil ditambahkan.");
      setShowCreateModal(false);
      await fetchDowntime(0);
    } catch (err: any) {
      setCreateError(err?.message || "Gagal menyimpan data downtime.");
    } finally {
      setIsSavingCreate(false);
    }
  };

  // ─── Edit Handler ────────────────────────────────────────────────────────────
  const handleOpenEdit = (row: any) => {
    setEditTarget(row);
    setEditForm({
      mesin: row.mesin || "tandem",
      stasiun: row.stasiun || "",
      waktu_awal: toLocalInput(row.waktu_awal),
      waktu_akhir: toLocalInput(row.waktu_akhir),
      kategori: row.kategori || "MESIN",
      problem: row.problem || "",
      penyebab: row.penyebab || "",
      countermeasure: row.countermeasure || "",
    });
    setEditError("");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;

    try {
      setIsSavingEdit(true);
      setEditError("");

      const startMs = new Date(editForm.waktu_awal).getTime();
      const endMs = editForm.waktu_akhir ? new Date(editForm.waktu_akhir).getTime() : startMs;
      const durasi = Math.max(0, Math.round((endMs - startMs) / 60000));

      const payload = {
        mesin: editForm.mesin,
        stasiun: editForm.stasiun.trim() || null,
        waktu_awal: new Date(editForm.waktu_awal).toISOString(),
        waktu_akhir: editForm.waktu_akhir ? new Date(editForm.waktu_akhir).toISOString() : null,
        durasi_menit: durasi,
        durasi: durasi,
        kategori: editForm.kategori,
        problem: editForm.problem.trim() || null,
        penyebab: editForm.penyebab.trim() || null,
        countermeasure: editForm.countermeasure.trim() || null,
      };

      const { error } = await supabase
        .from("prod_downtime_log" as any)
        .update(payload)
        .eq("id", editTarget.id);

      if (error) throw error;

      toast.success("Data downtime berhasil diperbarui.");
      setEditTarget(null);
      await fetchDowntime(0);
    } catch (err: any) {
      setEditError(err?.message || "Gagal memperbarui data downtime.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // ─── Single Delete Handler ───────────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    try {
      setIsDeleting(true);
      setDeleteError("");

      const { error } = await supabase
        .from("prod_downtime_log" as any)
        .update({ is_active: false })
        .eq("id", deleteTarget.id);

      if (error) throw error;

      toast.success("Data downtime berhasil dipindahkan ke Tempat Sampah.");
      setDeleteTarget(null);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteTarget.id);
        return next;
      });
      await fetchDowntime(0);
    } catch (err: any) {
      setDeleteError(err?.message || "Gagal menghapus data downtime.");
    } finally {
      setIsDeleting(false);
    }
  };

  // ─── Bulk Delete Handler ─────────────────────────────────────────────────────
  const handleBulkDeleteConfirm = async () => {
    if (selectedIds.size === 0) return;

    try {
      setIsBulkDeleting(true);
      setBulkDeleteError("");

      const ids = Array.from(selectedIds);
      const { error } = await supabase
        .from("prod_downtime_log" as any)
        .update({ is_active: false })
        .in("id", ids);

      if (error) throw error;

      const count = ids.length;
      toast.success(`${count} data downtime berhasil dipindahkan ke Tempat Sampah.`);
      setSelectedIds(new Set());
      setShowBulkDeleteModal(false);
      await fetchDowntime(0);
    } catch (err: any) {
      setBulkDeleteError(err?.message || "Gagal menghapus data terpilih.");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Metrics calculation
  const totalKejadian = filteredRows.length;
  const totalDurasiMenit = useMemo(() => {
    return filteredRows.reduce((acc, row) => acc + (Number(row.durasi_menit) || 0), 0);
  }, [filteredRows]);
  const avgDurasiMenit = totalKejadian > 0 ? Math.round(totalDurasiMenit / totalKejadian) : 0;

  return (
    <div className="app-shell machine-hub-container">
      <main className="main max-w-6xl mx-auto p-4 sm:p-6 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500 pb-16">
        {/* Top Navigation */}
        <div className="flex items-center justify-between">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-2 text-xs font-semibold rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors touch-manipulation shadow-xs"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            Kembali ke Admin
          </Link>
        </div>

        {/* Page Header & Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="page-header mb-0">
            <h1 className="page-title text-2xl font-bold font-display">
              <span className="eyebrow block text-xs font-semibold text-blue-500 uppercase tracking-wider mb-0.5">
                Monitoring & Analisis
              </span>
              Downtime Log
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Catatan riwayat gangguan mesin &amp; line stop untuk seluruh mesin produksi.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchDowntime(0)}
              disabled={loading}
              className="inline-flex items-center gap-2 min-h-[40px] px-3.5 py-2 text-xs font-bold rounded-xl border border-border bg-card text-foreground hover:bg-muted active:scale-95 transition-all cursor-pointer touch-manipulation shadow-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>

            <Button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white active:scale-95 transition-all cursor-pointer shadow-sm"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah Downtime</span>
            </Button>
          </div>
        </div>

        {/* Filter & Search Panel */}
        <Card className="dash-panel p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2 mb-3 text-sm font-bold text-foreground">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" />
              <span>Filter &amp; Pencarian</span>
            </div>
            {(filterMesin !== "all" || filterKategori !== "all" || searchQuery || filterTanggalDari !== sevenDaysAgo || filterTanggalSampai !== today) && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs font-semibold text-rose-500 hover:underline cursor-pointer bg-transparent border-0"
              >
                Reset Filter
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="field">
              <label className="text-xs font-semibold block mb-1 text-muted-foreground">Mesin / Line</label>
              <Select
                value={filterMesin}
                onChange={(e) => setFilterMesin(e.target.value)}
                className="w-full min-h-[40px] text-xs"
              >
                <option value="all">Semua Mesin</option>
                {machineOptions.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="field">
              <label className="text-xs font-semibold block mb-1 text-muted-foreground">Dari Tanggal</label>
              <Input
                type="date"
                value={filterTanggalDari}
                onChange={(e) => setFilterTanggalDari(e.target.value)}
                className="w-full min-h-[40px] text-xs"
              />
            </div>

            <div className="field">
              <label className="text-xs font-semibold block mb-1 text-muted-foreground">Sampai Tanggal</label>
              <Input
                type="date"
                value={filterTanggalSampai}
                onChange={(e) => setFilterTanggalSampai(e.target.value)}
                className="w-full min-h-[40px] text-xs"
              />
            </div>

            <div className="field">
              <label className="text-xs font-semibold block mb-1 text-muted-foreground">Kategori</label>
              <Select
                value={filterKategori}
                onChange={(e) => setFilterKategori(e.target.value)}
                className="w-full min-h-[40px] text-xs"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="field">
              <label className="text-xs font-semibold block mb-1 text-muted-foreground">Cari Cepat</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Problem, penyebab, stasiun..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full min-h-[40px] pl-8 text-xs"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Summary Metric Cards */}
        <div
          key={`metrics-${filterMesin}-${filterTanggalDari}-${filterTanggalSampai}-${filterKategori}-${searchQuery}`}
          className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500"
        >
          <Card className="dash-panel p-4 flex items-center gap-3.5 border-l-4 border-l-rose-500">
            <div className="h-11 w-11 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500 shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                Total Kejadian
              </span>
              <span className="text-xl sm:text-2xl font-bold font-display">
                {totalKejadian}{" "}
                <span className="text-xs font-normal text-muted-foreground font-sans">kali</span>
              </span>
            </div>
          </Card>

          <Card className="dash-panel p-4 flex items-center gap-3.5 border-l-4 border-l-amber-500">
            <div className="h-11 w-11 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                Total Durasi Downtime
              </span>
              <span className="text-xl sm:text-2xl font-bold font-display">
                {totalDurasiMenit}{" "}
                <span className="text-xs font-normal text-muted-foreground font-sans">
                  menit ({(totalDurasiMenit / 60).toFixed(1)} jam)
                </span>
              </span>
            </div>
          </Card>

          <Card className="dash-panel p-4 flex items-center gap-3.5 border-l-4 border-l-blue-500">
            <div className="h-11 w-11 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                Rata-rata Durasi
              </span>
              <span className="text-xl sm:text-2xl font-bold font-display">
                {avgDurasiMenit}{" "}
                <span className="text-xs font-normal text-muted-foreground font-sans">
                  menit / kejadian
                </span>
              </span>
            </div>
          </Card>
        </div>

        {/* Floating Bulk Action Bar */}
        {selectedIds.size > 0 && (
          <div className="sticky top-4 z-30 flex items-center justify-between gap-3 p-3.5 bg-slate-900 text-white rounded-xl shadow-xl border border-slate-700 animate-in fade-in slide-in-from-top-3 duration-200">
            <div className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold">
                {selectedIds.size}
              </span>
              <span className="text-xs sm:text-sm font-semibold">Data Downtime Dipilih</span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
                className="h-8 px-3 text-xs text-slate-300 hover:text-white hover:bg-slate-800"
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  setBulkDeleteError("");
                  setShowBulkDeleteModal(true);
                }}
                className="h-8 px-3 text-xs font-bold bg-red-600 hover:bg-red-700 text-white flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Hapus ({selectedIds.size})</span>
              </Button>
            </div>
          </div>
        )}

        {/* Data Table */}
        <Card className="dash-panel card-glow-info overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="font-bold text-base flex items-center gap-2">
              <span>Data Riwayat Downtime</span>
              <span className="text-xs font-mono font-normal px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {filteredRows.length} baris
              </span>
            </h3>
          </div>

          <div className="table-wrap overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 font-semibold text-muted-foreground select-none">
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isIndeterminate;
                      }}
                      onChange={toggleSelectAll}
                      aria-label="Pilih semua baris downtime"
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                    />
                  </th>
                  <th className="p-3 font-bold text-xs uppercase tracking-wider">Mesin</th>
                  <th className="p-3 font-bold text-xs uppercase tracking-wider">Tanggal</th>
                  <th className="p-3 font-bold text-xs uppercase tracking-wider">Waktu</th>
                  <th className="p-3 font-bold text-xs uppercase tracking-wider text-right">Durasi</th>
                  <th className="p-3 font-bold text-xs uppercase tracking-wider">Kategori</th>
                  <th className="p-3 font-bold text-xs uppercase tracking-wider">Problem</th>
                  <th className="p-3 font-bold text-xs uppercase tracking-wider">Penyebab</th>
                  <th className="p-3 font-bold text-xs uppercase tracking-wider">Countermeasure</th>
                  <th className="p-3 font-bold text-xs uppercase tracking-wider">Stasiun</th>
                  <th className="p-3 font-bold text-xs uppercase tracking-wider text-center">Aksi</th>
                </tr>
              </thead>
              <tbody
                key={`${filterMesin}-${filterTanggalDari}-${filterTanggalSampai}-${filterKategori}-${searchQuery}-${page}`}
                className="divide-y divide-border animate-in fade-in slide-in-from-bottom-2 duration-500"
              >
                {loading ? (
                  <DowntimeTableSkeleton />
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-muted-foreground">
                      Tidak ada data downtime yang sesuai dengan kriteria filter saat ini.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, idx) => {
                    const isSelected = selectedIds.has(row.id);
                    return (
                      <tr
                        key={row.id || idx}
                        onClick={() => toggleSelect(row.id)}
                        className={`transition-colors cursor-pointer animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-backwards ${
                          isSelected ? "bg-blue-50/70 dark:bg-blue-950/40" : "hover:bg-muted/30"
                        }`}
                        style={{ animationDelay: `${Math.min(idx * 20, 300)}ms` }}
                      >
                        {/* Checkbox */}
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(row.id)}
                            aria-label={`Pilih downtime ${row.problem || row.id}`}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                          />
                        </td>

                        {/* Mesin */}
                        <td className="p-3 font-bold whitespace-nowrap">
                          <span className="px-2 py-1 rounded-md bg-card border border-border text-foreground font-mono text-xs">
                            {getMachineLabel(row.mesin)}
                          </span>
                        </td>

                        {/* Tanggal */}
                        <td className="p-3 whitespace-nowrap font-medium text-foreground">
                          {formatDate(row.waktu_awal)}
                        </td>

                        {/* Waktu */}
                        <td className="p-3 whitespace-nowrap font-mono text-xs text-muted-foreground">
                          {formatTime(row.waktu_awal)} - {formatTime(row.waktu_akhir)}
                        </td>

                        {/* Durasi */}
                        <td className="p-3 text-right whitespace-nowrap font-mono font-bold text-rose-500">
                          {row.durasi_menit} m
                        </td>

                        {/* Kategori */}
                        <td className="p-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                              row.kategori === "MESIN"
                                ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                                : row.kategori === "DIES"
                                ? "bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30"
                                : row.kategori === "FINGER"
                                ? "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30"
                                : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                            }`}
                          >
                            {row.kategori || "-"}
                          </span>
                        </td>

                        {/* Problem */}
                        <td className="p-3 font-semibold text-foreground max-w-[200px] truncate" title={row.problem}>
                          {row.problem || "-"}
                        </td>

                        {/* Penyebab */}
                        <td className="p-3 text-muted-foreground max-w-[180px] truncate" title={row.penyebab}>
                          {row.penyebab || "-"}
                        </td>

                        {/* Countermeasure */}
                        <td className="p-3 text-muted-foreground max-w-[180px] truncate" title={row.countermeasure}>
                          {row.countermeasure || "-"}
                        </td>

                        {/* Stasiun */}
                        <td className="p-3 whitespace-nowrap font-mono text-xs">
                          {row.stasiun ? (
                            <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              {row.stasiun}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/50">-</span>
                          )}
                        </td>

                        {/* Aksi */}
                        <td className="p-3 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              title="Edit data downtime"
                              onClick={() => handleOpenEdit(row)}
                              className="h-8 w-8 p-0"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              title="Hapus data downtime"
                              onClick={() => {
                                setDeleteError("");
                                setDeleteTarget(row);
                              }}
                              className="h-8 w-8 p-0"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <div className="p-3 border-t border-border text-center">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={loadingMore}
                onClick={() => fetchDowntime(page + 1)}
              >
                {loadingMore ? "Memuat..." : "Muat Lebih Banyak"}
              </Button>
            </div>
          )}
        </Card>
      </main>

      {/* ── Modal: Tambah Downtime Baru ── */}
      {showCreateModal && (
        <Dialog open={showCreateModal} onOpenChange={(open) => { if (!open && !isSavingCreate) setShowCreateModal(false); }}>
          <DialogContent onClose={() => { if (!isSavingCreate) setShowCreateModal(false); }} maxWidth="max-w-lg">
            <DialogHeader>
              <DialogTitle>Tambah Catatan Downtime</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveCreate} className="space-y-3.5 mt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="field">
                  <label className="text-xs font-semibold block mb-1">Mesin / Line *</label>
                  <Select
                    value={createForm.mesin}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, mesin: e.target.value }))}
                    className="w-full"
                    required
                  >
                    {machineOptions.map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="field">
                  <label className="text-xs font-semibold block mb-1">Stasiun (Opsional)</label>
                  <Input
                    type="text"
                    placeholder="misal PA-1, PC-1"
                    value={createForm.stasiun}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, stasiun: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="field">
                  <label className="text-xs font-semibold block mb-1">Waktu Awal *</label>
                  <Input
                    type="datetime-local"
                    value={createForm.waktu_awal}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, waktu_awal: e.target.value }))}
                    required
                  />
                </div>

                <div className="field">
                  <label className="text-xs font-semibold block mb-1">Waktu Akhir</label>
                  <Input
                    type="datetime-local"
                    value={createForm.waktu_akhir}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, waktu_akhir: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="field">
                  <label className="text-xs font-semibold block mb-1">Kategori *</label>
                  <Select
                    value={createForm.kategori}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, kategori: e.target.value }))}
                    className="w-full"
                    required
                  >
                    {FORM_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="field">
                  <label className="text-xs font-semibold block mb-1">Problem</label>
                  <Input
                    type="text"
                    list="problemListCreate"
                    placeholder="Nama problem downtime..."
                    value={createForm.problem}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, problem: e.target.value }))}
                  />
                  <datalist id="problemListCreate">
                    {problemSuggestions.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="field">
                <label className="text-xs font-semibold block mb-1">Penyebab</label>
                <Input
                  type="text"
                  placeholder="Penyebab terjadinya downtime..."
                  value={createForm.penyebab}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, penyebab: e.target.value }))}
                />
              </div>

              <div className="field">
                <label className="text-xs font-semibold block mb-1">Countermeasure</label>
                <Input
                  type="text"
                  placeholder="Tindakan penanganan yang dilakukan..."
                  value={createForm.countermeasure}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, countermeasure: e.target.value }))}
                />
              </div>

              {createError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-600 dark:text-red-400">
                  {createError}
                </div>
              )}

              <DialogFooter className="mt-4">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isSavingCreate}
                  onClick={() => setShowCreateModal(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={isSavingCreate}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
                >
                  {isSavingCreate ? "Menyimpan..." : "Simpan Downtime"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Modal: Edit Downtime ── */}
      {editTarget && (
        <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open && !isSavingEdit) setEditTarget(null); }}>
          <DialogContent onClose={() => { if (!isSavingEdit) setEditTarget(null); }} maxWidth="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Catatan Downtime</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveEdit} className="space-y-3.5 mt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="field">
                  <label className="text-xs font-semibold block mb-1">Mesin / Line *</label>
                  <Select
                    value={editForm.mesin}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, mesin: e.target.value }))}
                    className="w-full"
                    required
                  >
                    {machineOptions.map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="field">
                  <label className="text-xs font-semibold block mb-1">Stasiun (Opsional)</label>
                  <Input
                    type="text"
                    placeholder="misal PA-1, PC-1"
                    value={editForm.stasiun}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, stasiun: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="field">
                  <label className="text-xs font-semibold block mb-1">Waktu Awal *</label>
                  <Input
                    type="datetime-local"
                    value={editForm.waktu_awal}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, waktu_awal: e.target.value }))}
                    required
                  />
                </div>

                <div className="field">
                  <label className="text-xs font-semibold block mb-1">Waktu Akhir</label>
                  <Input
                    type="datetime-local"
                    value={editForm.waktu_akhir}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, waktu_akhir: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="field">
                  <label className="text-xs font-semibold block mb-1">Kategori *</label>
                  <Select
                    value={editForm.kategori}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, kategori: e.target.value }))}
                    className="w-full"
                    required
                  >
                    {FORM_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="field">
                  <label className="text-xs font-semibold block mb-1">Problem</label>
                  <Input
                    type="text"
                    list="problemListEdit"
                    placeholder="Nama problem downtime..."
                    value={editForm.problem}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, problem: e.target.value }))}
                  />
                  <datalist id="problemListEdit">
                    {problemSuggestions.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="field">
                <label className="text-xs font-semibold block mb-1">Penyebab</label>
                <Input
                  type="text"
                  placeholder="Penyebab terjadinya downtime..."
                  value={editForm.penyebab}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, penyebab: e.target.value }))}
                />
              </div>

              <div className="field">
                <label className="text-xs font-semibold block mb-1">Countermeasure</label>
                <Input
                  type="text"
                  placeholder="Tindakan penanganan yang dilakukan..."
                  value={editForm.countermeasure}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, countermeasure: e.target.value }))}
                />
              </div>

              {editError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-600 dark:text-red-400">
                  {editError}
                </div>
              )}

              <DialogFooter className="mt-4">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={isSavingEdit}
                  onClick={() => setEditTarget(null)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={isSavingEdit}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
                >
                  {isSavingEdit ? "Menyimpan..." : "Simpan Perubahan"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Modal: Hapus Satu Downtime ── */}
      {deleteTarget && (
        <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open && !isDeleting) setDeleteTarget(null); }}>
          <DialogContent onClose={() => { if (!isDeleting) setDeleteTarget(null); }} maxWidth="max-w-md">
            <div className="flex items-start gap-4 mb-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-50 border border-red-100 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-foreground">Hapus Data Downtime?</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Yakin ingin menghapus catatan downtime{" "}
                  <strong className="text-foreground">
                    &quot;{deleteTarget.problem || deleteTarget.kategori || "Downtime"}&quot;
                  </strong>{" "}
                  pada mesin{" "}
                  <strong className="text-foreground">
                    {getMachineLabel(deleteTarget.mesin)}
                  </strong>
                  ?
                </p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Data akan dipindahkan ke Tempat Sampah (soft-delete).
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="mb-4 rounded-md bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-800 dark:text-red-300 border border-red-100 dark:border-red-900">
                {deleteError}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="bg-red-600 hover:bg-red-700 text-white font-bold"
              >
                {isDeleting ? "Menghapus..." : "Ya, Hapus"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Modal: Bulk Delete Downtime ── */}
      {showBulkDeleteModal && (
        <Dialog open={showBulkDeleteModal} onOpenChange={(open) => { if (!open && !isBulkDeleting) setShowBulkDeleteModal(false); }}>
          <DialogContent onClose={() => { if (!isBulkDeleting) setShowBulkDeleteModal(false); }} maxWidth="max-w-md">
            <div className="flex items-start gap-4 mb-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-50 border border-red-100 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-foreground">Hapus {selectedIds.size} Data Downtime?</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Apakah Anda yakin ingin menghapus{" "}
                  <strong className="text-foreground">{selectedIds.size} data downtime</strong> yang dipilih?
                </p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Data akan dipindahkan ke Tempat Sampah (soft-delete).
                </p>
              </div>
            </div>

            {bulkDeleteError && (
              <div className="mb-4 rounded-md bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-800 dark:text-red-300 border border-red-100 dark:border-red-900">
                {bulkDeleteError}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={isBulkDeleting}
                onClick={() => setShowBulkDeleteModal(false)}
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={isBulkDeleting}
                onClick={handleBulkDeleteConfirm}
                className="bg-red-600 hover:bg-red-700 text-white font-bold flex items-center gap-2"
              >
                <Trash2 className="h-4 w-4" />
                {isBulkDeleting ? "Menghapus..." : `Ya, Hapus (${selectedIds.size})`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function DowntimeTableSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="animate-pulse select-none">
          <td className="p-3 text-center"><div className="h-4 w-4 bg-muted rounded mx-auto" /></td>
          <td className="p-3"><div className="h-6 bg-muted rounded-md w-20" /></td>
          <td className="p-3"><div className="h-4 bg-muted rounded w-20" /></td>
          <td className="p-3"><div className="h-4 bg-muted rounded w-24" /></td>
          <td className="p-3 text-right"><div className="h-4 bg-muted rounded w-12 ml-auto" /></td>
          <td className="p-3"><div className="h-5 bg-muted rounded w-16" /></td>
          <td className="p-3"><div className="h-4 bg-muted rounded w-36" /></td>
          <td className="p-3"><div className="h-4 bg-muted rounded w-32" /></td>
          <td className="p-3"><div className="h-4 bg-muted rounded w-32" /></td>
          <td className="p-3"><div className="h-4 bg-muted rounded w-12" /></td>
          <td className="p-3 text-center"><div className="h-6 w-16 bg-muted rounded mx-auto" /></td>
        </tr>
      ))}
    </>
  );
}
