"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Calendar,
  ChevronDown,
  Clock,
  Coffee,
  Download,
  Filter,
  Layers,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import { getLines, type Line } from "@/lib/services/line";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const LOG_REFRESH_INTERVAL_MS = 5000;

export interface CombinedLogItem {
  id: string;
  jenis: "produksi" | "non_produksi";
  line_id: string | null;
  mesin: string;
  stasiun: string | null;
  waktu_awal: string;
  waktu_akhir: string | null;
  part_number: string | null;
  line_name?: string | null;
  data: any;
}

interface EditProductionForm {
  part_number: string;
  qty: string;
  ng: string;
  manpower: string;
  waktu_awal: string;
  waktu_akhir: string;
  dandori_menit: string;
  downtime_menit: string;
  break_menit: string;
  routing_type: "WIP" | "FG" | "";
  routing_numbers: string;
}

interface EditNonProduksiForm {
  waktu_awal: string;
  waktu_akhir: string;
  nama: string;
}

interface CreateForm extends EditProductionForm {
  jenis: "produksi" | "non_produksi";
  line_id: string;
  mesin: string;
  stasiun: string;
  nama_non_produksi: string;
}

const emptyProductionEdit = (): EditProductionForm => ({
  part_number: "",
  qty: "",
  ng: "",
  manpower: "",
  waktu_awal: "",
  waktu_akhir: "",
  dandori_menit: "",
  downtime_menit: "",
  break_menit: "",
  routing_type: "",
  routing_numbers: "",
});

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function fmt(iso?: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return "-";
  return n.toLocaleString("id-ID");
}

const inputCls =
  "w-full h-9 px-3 text-sm border border-slate-300 rounded-lg bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block">{label}</label>
      {children}
    </div>
  );
}

export default function ProductionLogDashboard() {
  const supabase = createClient();

  const [logs, setLogs] = useState<CombinedLogItem[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const requestIdRef = useRef(0);

  // Filters
  const [selectedLineId, setSelectedLineId] = useState("all");
  const [selectedJenis, setSelectedJenis] = useState<"all" | "produksi" | "non_produksi">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Part number options
  const [partOptions, setPartOptions] = useState<string[]>([]);

  // Edit modal
  const [editTarget, setEditTarget] = useState<CombinedLogItem | null>(null);
  const [editProdForm, setEditProdForm] = useState<EditProductionForm>(emptyProductionEdit());
  const [editNonProdForm, setEditNonProdForm] = useState<EditNonProduksiForm>({
    waktu_awal: "",
    waktu_akhir: "",
    nama: "",
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isEditClosing, setIsEditClosing] = useState(false);
  const [editError, setEditError] = useState("");

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<CombinedLogItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteClosing, setIsDeleteClosing] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Bulk Selection & Delete state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isBulkDeleteClosing, setIsBulkDeleteClosing] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState("");

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [isCreateClosing, setIsCreateClosing] = useState(false);
  const [isSavingCreate, setIsSavingCreate] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createForm, setCreateForm] = useState<CreateForm>({
    ...emptyProductionEdit(),
    jenis: "produksi",
    line_id: "",
    mesin: "",
    stasiun: "",
    nama_non_produksi: "",
  });

  // ----- Data Fetching -----
  const loadLogs = useCallback(
    async ({ showLoading = true }: { showLoading?: boolean } = {}) => {
      const reqId = ++requestIdRef.current;
      try {
        if (showLoading) setIsLoading(true);
        setError("");

        // 1. Fetch Production Logs
        let prodQuery = supabase
          .from("prod_production_log" as any)
          .select("*, line:lines(name)")
          .eq("is_active", true)
          .order("waktu_awal", { ascending: false })
          .limit(500);

        // 2. Fetch Non-Production Logs (Dandori/Setup/etc)
        let nonProdQuery = supabase
          .from("prod_dandori_log" as any)
          .select("*, line:lines(name)")
          .eq("is_active", true)
          .order("waktu_awal", { ascending: false })
          .limit(500);

        if (selectedLineId !== "all") {
          prodQuery = prodQuery.eq("line_id", selectedLineId);
          nonProdQuery = nonProdQuery.eq("line_id", selectedLineId);
        }
        if (startDate) {
          prodQuery = prodQuery.gte("waktu_awal", `${startDate}T00:00:00`);
          nonProdQuery = nonProdQuery.gte("waktu_awal", `${startDate}T00:00:00`);
        }
        if (endDate) {
          prodQuery = prodQuery.lte("waktu_awal", `${endDate}T23:59:59`);
          nonProdQuery = nonProdQuery.lte("waktu_awal", `${endDate}T23:59:59`);
        }

        const [{ data: prodData, error: prodErr }, { data: nonProdData, error: nonProdErr }] =
          await Promise.all([prodQuery, nonProdQuery]);

        if (requestIdRef.current !== reqId) return;
        if (prodErr) throw prodErr;
        if (nonProdErr) throw nonProdErr;

        const combined: CombinedLogItem[] = [
          ...(prodData || []).map((row: any) => ({
            id: row.id,
            jenis: "produksi" as const,
            line_id: row.line_id,
            mesin: row.mesin,
            stasiun: row.stasiun,
            waktu_awal: row.waktu_awal,
            waktu_akhir: row.waktu_akhir,
            part_number: row.part_number,
            line_name: row.line?.name ?? null,
            data: row,
          })),
          ...(nonProdData || []).map((row: any) => ({
            id: row.id,
            jenis: "non_produksi" as const,
            line_id: row.line_id,
            mesin: row.mesin,
            stasiun: null,
            waktu_awal: row.waktu_awal,
            waktu_akhir: row.waktu_akhir,
            part_number: row.part_ke || row.part_dari || row.keterangan || null,
            line_name: row.line?.name ?? null,
            data: row,
          })),
        ].sort((a, b) => new Date(b.waktu_awal).getTime() - new Date(a.waktu_awal).getTime());

        setLogs(combined);
      } catch (err) {
        if (requestIdRef.current !== reqId) return;
        const msg = err instanceof Error ? err.message : "Gagal memuat riwayat produksi";
        setError(msg);
        console.error(err);
      } finally {
        if (requestIdRef.current === reqId && showLoading) setIsLoading(false);
      }
    },
    [selectedLineId, startDate, endDate] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const loadPartOptions = useCallback(async (lineId?: string) => {
    try {
      let q = supabase
        .from("prod_part_numbers" as any)
        .select("value")
        .eq("is_active", true);
      if (lineId && lineId !== "all") {
        q = q.eq("line_id", lineId);
      }
      const { data } = await q.order("value");
      if (data) {
        const parts = (data as any[])
          .map((p) => p.value)
          .filter(Boolean);
        setPartOptions(Array.from(new Set(parts)));
      }
    } catch {
      setPartOptions([]);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    async function loadLines() {
      try {
        const data = await getLines({ includeHidden: true });
        setLines(data);
      } catch (err) {
        console.error("Gagal memuat lines:", err);
      }
    }
    void loadLines();
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void loadLogs(), 100);
    return () => window.clearTimeout(t);
  }, [loadLogs]);

  useEffect(() => {
    const refresh = () => void loadLogs({ showLoading: false });
    const channelProd = supabase
      .channel("admin-prod-log-channel")
      .on("postgres_changes", { event: "*", schema: "public", table: "prod_production_log" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "prod_dandori_log" }, refresh)
      .subscribe();
    const interval = window.setInterval(refresh, LOG_REFRESH_INTERVAL_MS);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      void supabase.removeChannel(channelProd);
    };
  }, [loadLogs]); // eslint-disable-line react-hooks/exhaustive-deps

  // ----- Client-side filter -----
  const filtered = useMemo(() => {
    return logs.filter((log) => {
      if (selectedJenis !== "all" && log.jenis !== selectedJenis) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const code = (log.data.kode ?? "").toLowerCase();
      const part = (log.part_number ?? "").toLowerCase();
      const lineName = (log.line_name ?? "").toLowerCase();
      const machine = (log.mesin ?? "").toLowerCase();
      const station = (log.stasiun ?? "").toLowerCase();
      return (
        code.includes(q) ||
        part.includes(q) ||
        lineName.includes(q) ||
        machine.includes(q) ||
        station.includes(q)
      );
    });
  }, [logs, selectedJenis, searchQuery]);

  // Bulk Selection Helpers
  const isAllSelected = useMemo(() => {
    return filtered.length > 0 && filtered.every((r) => selectedIds.has(r.id));
  }, [filtered, selectedIds]);

  const isSomeSelected = useMemo(() => {
    return filtered.some((r) => selectedIds.has(r.id)) && !isAllSelected;
  }, [filtered, selectedIds, isAllSelected]);

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((r) => r.id)));
    }
  };

  const toggleSelectRow = (id: string, e?: React.MouseEvent | React.ChangeEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openBulkDeleteModal = () => {
    if (selectedIds.size === 0) return;
    setBulkDeleteError("");
    setIsBulkDeleteModalOpen(true);
  };

  const closeBulkDeleteModal = () => {
    if (isBulkDeleting || isBulkDeleteClosing) return;
    setIsBulkDeleteClosing(true);
    setTimeout(() => {
      setIsBulkDeleteModalOpen(false);
      setIsBulkDeleteClosing(false);
      setBulkDeleteError("");
    }, 200);
  };

  const handleBulkDeleteConfirm = async () => {
    if (selectedIds.size === 0) return;
    try {
      setIsBulkDeleting(true);
      setBulkDeleteError("");

      const selectedItems = logs.filter((l) => selectedIds.has(l.id));
      const prodIds = selectedItems.filter((l) => l.jenis === "produksi").map((l) => l.id);
      const nonProdIds = selectedItems.filter((l) => l.jenis === "non_produksi").map((l) => l.id);

      const promises = [];
      if (prodIds.length > 0) {
        promises.push(
          supabase.from("prod_production_log" as any).update({ is_active: false }).in("id", prodIds)
        );
      }
      if (nonProdIds.length > 0) {
        promises.push(
          supabase.from("prod_dandori_log" as any).update({ is_active: false }).in("id", nonProdIds)
        );
      }

      const results = await Promise.all(promises);
      for (const res of results) {
        if (res.error) throw res.error;
      }

      toast.success(`${selectedIds.size} baris riwayat berhasil dihapus.`);
      setLogs((prev) => prev.filter((l) => !selectedIds.has(l.id)));
      setSelectedIds(new Set());
      closeBulkDeleteModal();
    } catch (err) {
      setBulkDeleteError(err instanceof Error ? err.message : "Gagal menghapus riwayat terpilih");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // ----- KPI Stats (identical aggregation) -----
  const stats = useMemo(() => {
    let totalQty = 0;
    let totalDandori = 0;
    let totalDT = 0;
    let totalBreak = 0;
    let prodCount = 0;
    let nonProdCount = 0;
    const uniqueLines = new Set<string>();

    filtered.forEach((l) => {
      if (l.line_id) uniqueLines.add(l.line_id);
      if (l.jenis === "produksi") {
        prodCount++;
        totalQty += l.data.qty ?? 0;
        totalDandori += l.data.dandori_menit ?? 0;
        totalDT += l.data.downtime_menit ?? 0;
        totalBreak += l.data.break_menit ?? 0;
      } else {
        nonProdCount++;
      }
    });

    return {
      totalQty,
      totalDandori,
      totalDT,
      totalBreak,
      prodCount,
      nonProdCount,
      totalRows: filtered.length,
      activeLinesCount: uniqueLines.size,
    };
  }, [filtered]);

  const handleResetFilters = () => {
    setSelectedLineId("all");
    setSelectedJenis("all");
    setStartDate("");
    setEndDate("");
    setSearchQuery("");
  };

  // ----- CSV Export -----
  const handleExportCSV = () => {
    if (filtered.length === 0) return;
    const headers = [
      "Kode",
      "Jenis",
      "Line",
      "Stasiun",
      "Waktu Awal",
      "Waktu Akhir",
      "Part Number / Keterangan",
      "Qty",
      "MP",
      "Dandori (mnt)",
      "DT (mnt)",
      "Break (mnt)",
      "Routing",
    ];

    const rows = filtered.map((row) => {
      const data = row.data;
      const isProd = row.jenis === "produksi";
      const routing = isProd && data.extra?.routing_type
        ? `${data.extra.routing_type}${data.extra.routing_numbers ? ` ${data.extra.routing_numbers.join(",")}` : ""}`
        : "-";

      return [
        isProd ? (data.kode || "-") : "-",
        isProd ? "Produksi" : "Non-Produksi",
        row.line_name ?? row.mesin,
        data.stasiun ?? "-",
        fmt(row.waktu_awal),
        fmt(row.waktu_akhir),
        row.part_number ?? "-",
        isProd ? (data.qty ?? 0) : "-",
        isProd ? (data.manpower ?? "-") : "-",
        isProd ? (data.dandori_menit ?? 0) : "-",
        isProd ? (data.downtime_menit ?? 0) : "-",
        isProd ? (data.break_menit ?? 0) : "-",
        routing,
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Riwayat_Produksi_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ----- Edit Handlers -----
  const openEdit = (item: CombinedLogItem) => {
    setEditTarget(item);
    setEditError("");
    const data = item.data;

    if (item.jenis === "produksi") {
      setEditProdForm({
        part_number: data.part_number ?? "",
        qty: data.qty !== null && data.qty !== undefined ? String(data.qty) : "",
        ng: data.ng !== null && data.ng !== undefined ? String(data.ng) : "",
        manpower: data.manpower !== null && data.manpower !== undefined ? String(data.manpower) : "",
        waktu_awal: toLocalInput(data.waktu_awal),
        waktu_akhir: toLocalInput(data.waktu_akhir),
        dandori_menit: data.dandori_menit !== null && data.dandori_menit !== undefined ? String(data.dandori_menit) : "",
        downtime_menit: data.downtime_menit !== null && data.downtime_menit !== undefined ? String(data.downtime_menit) : "",
        break_menit: data.break_menit !== null && data.break_menit !== undefined ? String(data.break_menit) : "",
        routing_type: (data.extra?.routing_type as "WIP" | "FG") ?? "",
        routing_numbers: data.extra?.routing_numbers ? data.extra.routing_numbers.join(",") : "",
      });
      void loadPartOptions(item.line_id ?? undefined);
    } else {
      setEditNonProdForm({
        waktu_awal: toLocalInput(data.waktu_awal),
        waktu_akhir: toLocalInput(data.waktu_akhir),
        nama: data.part_ke || data.keterangan || data.part_dari || "",
      });
    }
  };

  const closeEdit = () => {
    if (isEditClosing) return;
    setIsEditClosing(true);
    setTimeout(() => {
      setEditTarget(null);
      setIsEditClosing(false);
      setEditError("");
    }, 200);
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    try {
      setIsSavingEdit(true);
      setEditError("");

      if (editTarget.jenis === "produksi") {
        const extra = { ...(editTarget.data.extra || {}) };
        if (editProdForm.routing_type) {
          extra.routing_type = editProdForm.routing_type;
          extra.routing_numbers = editProdForm.routing_numbers
            ? editProdForm.routing_numbers.split(",").map((n) => Number(n.trim())).filter((n) => !isNaN(n))
            : [];
        } else {
          delete extra.routing_type;
          delete extra.routing_numbers;
        }

        const payload: Record<string, any> = {
          part_number: editProdForm.part_number || null,
          qty: editProdForm.qty !== "" ? Number(editProdForm.qty) : null,
          ng: editProdForm.ng !== "" ? Number(editProdForm.ng) : null,
          manpower: editProdForm.manpower !== "" ? Number(editProdForm.manpower) : null,
          waktu_akhir: editProdForm.waktu_akhir ? new Date(editProdForm.waktu_akhir).toISOString() : null,
          dandori_menit: editProdForm.dandori_menit !== "" ? Number(editProdForm.dandori_menit) : null,
          downtime_menit: editProdForm.downtime_menit !== "" ? Number(editProdForm.downtime_menit) : null,
          break_menit: editProdForm.break_menit !== "" ? Number(editProdForm.break_menit) : null,
          extra,
        };
        if (editProdForm.waktu_awal) {
          payload.waktu_awal = new Date(editProdForm.waktu_awal).toISOString();
        }

        const { error: err } = await supabase
          .from("prod_production_log" as any)
          .update(payload)
          .eq("id", editTarget.id);
        if (err) throw err;
      } else {
        const payload: Record<string, any> = {
          waktu_awal: new Date(editNonProdForm.waktu_awal).toISOString(),
          waktu_akhir: editNonProdForm.waktu_akhir ? new Date(editNonProdForm.waktu_akhir).toISOString() : null,
          part_ke: editNonProdForm.nama,
          keterangan: editNonProdForm.nama,
        };
        const { error: err } = await supabase
          .from("prod_dandori_log" as any)
          .update(payload)
          .eq("id", editTarget.id);
        if (err) throw err;
      }

      toast.success("Data riwayat berhasil diperbarui!");
      closeEdit();
      void loadLogs({ showLoading: false });
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Gagal menyimpan perubahan");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // ----- Delete Handlers -----
  const openDelete = (item: CombinedLogItem) => {
    setDeleteTarget(item);
    setDeleteError("");
  };

  const closeDelete = () => {
    if (isDeleteClosing) return;
    setIsDeleteClosing(true);
    setTimeout(() => {
      setDeleteTarget(null);
      setIsDeleteClosing(false);
      setDeleteError("");
    }, 200);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      setDeleteError("");
      const table = deleteTarget.jenis === "produksi" ? "prod_production_log" : "prod_dandori_log";
      const { error: err } = await supabase
        .from(table as any)
        .update({ is_active: false })
        .eq("id", deleteTarget.id);
      if (err) throw err;

      toast.success("Baris riwayat berhasil dihapus (soft-delete).");
      setLogs((prev) => prev.filter((l) => l.id !== deleteTarget.id));
      closeDelete();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Gagal menghapus baris riwayat");
    } finally {
      setIsDeleting(false);
    }
  };

  // ----- Create Handlers -----
  const openCreate = () => {
    setCreateForm({
      ...emptyProductionEdit(),
      jenis: "produksi",
      line_id: selectedLineId !== "all" ? selectedLineId : "",
      mesin: "",
      stasiun: "",
      nama_non_produksi: "",
    });
    setCreateError("");
    setShowCreate(true);
    if (selectedLineId !== "all") void loadPartOptions(selectedLineId);
  };

  const closeCreate = () => {
    if (isCreateClosing) return;
    setIsCreateClosing(true);
    setTimeout(() => {
      setShowCreate(false);
      setIsCreateClosing(false);
      setCreateError("");
    }, 200);
  };

  const handleSaveCreate = async () => {
    if (!createForm.waktu_awal) {
      setCreateError("Waktu Mulai wajib diisi.");
      return;
    }
    if (!createForm.line_id) {
      setCreateError("Pilih Line terlebih dahulu.");
      return;
    }
    try {
      setIsSavingCreate(true);
      setCreateError("");
      const selectedLine = lines.find((l) => l.id === createForm.line_id);
      const machineType = selectedLine?.machine_type ?? "blanking";

      if (createForm.jenis === "produksi") {
        const extra: Record<string, any> = {};
        if (createForm.routing_type) {
          extra.routing_type = createForm.routing_type;
          extra.routing_numbers = createForm.routing_numbers
            ? createForm.routing_numbers.split(",").map((n) => Number(n.trim())).filter((n) => !isNaN(n))
            : [];
        }

        const payload = {
          line_id: createForm.line_id,
          mesin: machineType,
          stasiun: createForm.stasiun || null,
          waktu_awal: new Date(createForm.waktu_awal).toISOString(),
          waktu_akhir: createForm.waktu_akhir ? new Date(createForm.waktu_akhir).toISOString() : null,
          part_number: createForm.part_number || null,
          qty: createForm.qty !== "" ? Number(createForm.qty) : null,
          ng: createForm.ng !== "" ? Number(createForm.ng) : null,
          manpower: createForm.manpower !== "" ? Number(createForm.manpower) : null,
          dandori_menit: createForm.dandori_menit !== "" ? Number(createForm.dandori_menit) : null,
          downtime_menit: createForm.downtime_menit !== "" ? Number(createForm.downtime_menit) : null,
          break_menit: createForm.break_menit !== "" ? Number(createForm.break_menit) : null,
          extra,
          is_active: true,
        };

        const { error: insErr } = await supabase.from("prod_production_log" as any).insert(payload);
        if (insErr) throw insErr;
      } else {
        const payload = {
          line_id: createForm.line_id,
          mesin: machineType,
          waktu_awal: new Date(createForm.waktu_awal).toISOString(),
          waktu_akhir: createForm.waktu_akhir ? new Date(createForm.waktu_akhir).toISOString() : null,
          part_ke: createForm.nama_non_produksi || "Non-Produksi",
          keterangan: createForm.nama_non_produksi || "Non-Produksi",
          is_active: true,
        };
        const { error: insErr } = await supabase.from("prod_dandori_log" as any).insert(payload);
        if (insErr) throw insErr;
      }

      toast.success("Entri baru berhasil ditambahkan!");
      closeCreate();
      void loadLogs({ showLoading: false });
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Gagal menambah data");
    } finally {
      setIsSavingCreate(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Riwayat Produksi (All Lines)</h1>
          <p className="mt-1 text-sm text-slate-500">
            Tampilan riwayat lengkap seluruh line sesuai format operator (Kode, Line, Stasiun, Waktu, Qty, MP, Dandori, DT, Break, Routing).
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={() => void loadLogs()}
            variant="outline"
            className="h-10 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2 cursor-pointer dark:bg-white dark:text-slate-700 dark:hover:bg-slate-50 dark:border-slate-300"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Perbarui
          </Button>
          <Button
            onClick={handleExportCSV}
            disabled={filtered.length === 0}
            className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 cursor-pointer"
          >
            <Download className="h-4 w-4" />
            Ekspor CSV
          </Button>
          <Button
            onClick={openCreate}
            className="h-10 bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Tambah Entri
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Total Produksi (Qty) */}
        <div className="relative overflow-hidden rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-4 shadow-sm transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">Total Qty</span>
            <div className="rounded-lg bg-blue-100 p-2 text-blue-600">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-900">{fmtNum(stats.totalQty)}</h3>
            <p className="mt-0.5 text-xs text-blue-600 font-medium">{stats.prodCount} baris produksi</p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500" />
        </div>

        {/* Total Dandori */}
        <div className="relative overflow-hidden rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-600">Total Dandori</span>
            <div className="rounded-lg bg-amber-100 p-2 text-amber-600">
              <Wrench className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-900">{fmtNum(stats.totalDandori)} mnt</h3>
            <p className="mt-0.5 text-xs text-amber-600 font-medium">Waktu pergantian part</p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500" />
        </div>

        {/* Total Downtime */}
        <div className="relative overflow-hidden rounded-xl border border-rose-100 bg-gradient-to-br from-rose-50 to-white p-4 shadow-sm transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-600">Total DT</span>
            <div className="rounded-lg bg-rose-100 p-2 text-rose-600">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-900">{fmtNum(stats.totalDT)} mnt</h3>
            <p className="mt-0.5 text-xs text-rose-600 font-medium">Downtime tercatat</p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-rose-500" />
        </div>

        {/* Total Break */}
        <div className="relative overflow-hidden rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Total Break</span>
            <div className="rounded-lg bg-emerald-100 p-2 text-emerald-600">
              <Coffee className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-900">{fmtNum(stats.totalBreak)} mnt</h3>
            <p className="mt-0.5 text-xs text-emerald-600 font-medium">Istirahat operator</p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500" />
        </div>

        {/* Active Lines & Rows */}
        <div className="relative overflow-hidden rounded-xl border border-purple-100 bg-gradient-to-br from-purple-50 to-white p-4 shadow-sm transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-purple-600">Line &amp; Entri</span>
            <div className="rounded-lg bg-purple-100 p-2 text-purple-600">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-900">{stats.activeLinesCount} Line</h3>
            <p className="mt-0.5 text-xs text-purple-600 font-medium">{stats.totalRows} baris total</p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-purple-500" />
        </div>
      </div>

      {/* Filter Panel */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4 text-slate-700">
          <SlidersHorizontal className="h-5 w-5 text-slate-500" />
          <h2 className="font-semibold text-base">Panel Filter &amp; Pencarian</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          {/* Line Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Line Produksi</label>
            <div className="relative">
              <select
                value={selectedLineId}
                onChange={(e) => setSelectedLineId(e.target.value)}
                className="w-full pl-3 pr-8 py-2 text-sm border border-slate-200 bg-slate-50/50 rounded-xl text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none font-medium transition cursor-pointer"
              >
                <option value="all">Semua Line</option>
                {lines.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </div>
          </div>

          {/* Jenis Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Kategori / Jenis</label>
            <div className="relative">
              <select
                value={selectedJenis}
                onChange={(e) => setSelectedJenis(e.target.value as any)}
                className="w-full pl-3 pr-8 py-2 text-sm border border-slate-200 bg-slate-50/50 rounded-xl text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none font-medium transition cursor-pointer"
              >
                <option value="all">Semua (Produksi + Non)</option>
                <option value="produksi">Hanya Produksi</option>
                <option value="non_produksi">Hanya Non-Produksi</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </div>
          </div>

          {/* Date start */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Tanggal Mulai</label>
            <div className="relative flex items-center rounded border border-slate-300 bg-white hover:border-slate-400 transition-colors px-3">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 w-full bg-transparent text-sm text-slate-700 outline-none pr-6 cursor-pointer"
              />
              <Calendar className="pointer-events-none absolute right-3 h-4 w-4 text-slate-400" />
            </div>
          </div>

          {/* Date end */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Tanggal Akhir</label>
            <div className="relative flex items-center rounded border border-slate-300 bg-white hover:border-slate-400 transition-colors px-3">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 w-full bg-transparent text-sm text-slate-700 outline-none pr-6 cursor-pointer"
              />
              <Calendar className="pointer-events-none absolute right-3 h-4 w-4 text-slate-400" />
            </div>
          </div>

          {/* Search */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Pencarian</label>
            <div className="relative flex items-center rounded border border-slate-300 bg-white hover:border-slate-400 transition-colors px-3">
              <input
                type="text"
                placeholder="Kode / Part / Mesin..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full bg-transparent text-sm text-slate-700 outline-none pr-6"
              />
              <Search className="pointer-events-none absolute right-3 h-4 w-4 text-slate-400" />
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-slate-100">
          <p className="text-xs font-medium text-slate-500">
            Menampilkan <span className="font-semibold text-slate-800">{filtered.length}</span> baris riwayat produksi.
          </p>
          {(selectedLineId !== "all" || selectedJenis !== "all" || startDate || endDate || searchQuery) && (
            <button
              onClick={handleResetFilters}
              className="text-xs font-semibold text-red-600 hover:text-red-700 hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-0 self-start sm:self-center"
            >
              Reset Semua Filter
            </button>
          )}
        </div>
      </div>

      {/* Bulk Action Floating Bar */}
      {selectedIds.size > 0 && (
        <div className="sticky top-4 z-30 flex items-center justify-between gap-3 p-3.5 bg-slate-900 text-white rounded-xl shadow-xl border border-slate-700 animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold">
              {selectedIds.size}
            </span>
            <span className="text-xs sm:text-sm font-semibold">Riwayat Produksi Dipilih</span>
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
              onClick={openBulkDeleteModal}
              className="h-8 px-3 text-xs font-bold bg-red-600 hover:bg-red-700 text-white flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Hapus ({selectedIds.size})</span>
            </Button>
          </div>
        </div>
      )}

      {/* Main Table Card */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {error && (
          <div className="m-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isLoading ? (
          <ProductionLogTableSkeleton />
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center px-4">
            <div className="mx-auto h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center border border-slate-200">
              <Filter className="h-5 w-5 text-slate-400" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-slate-900">Belum ada data riwayat</h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
              Tidak ada data yang cocok dengan kriteria filter saat ini. Ubah filter atau tambahkan entri baru.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 select-none">
                  <th className="py-4 pl-3 pr-1 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isSomeSelected;
                      }}
                      onChange={toggleSelectAll}
                      aria-label="Pilih semua baris riwayat"
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                    />
                  </th>
                  <th className="py-4 px-3 font-bold text-xs uppercase tracking-wider">Kode</th>
                  <th className="py-4 px-3 font-bold text-xs uppercase tracking-wider">Line</th>
                  <th className="py-4 px-3 font-bold text-xs uppercase tracking-wider">Stasiun</th>
                  <th className="py-4 px-3 font-bold text-xs uppercase tracking-wider">Waktu Awal</th>
                  <th className="py-4 px-3 font-bold text-xs uppercase tracking-wider">Waktu Akhir</th>
                  <th className="py-4 px-3 font-bold text-xs uppercase tracking-wider">Part Number</th>
                  <th className="py-4 px-3 font-bold text-xs uppercase tracking-wider text-right">Qty</th>
                  <th className="py-4 px-3 font-bold text-xs uppercase tracking-wider text-center">MP</th>
                  <th className="py-4 px-3 font-bold text-xs uppercase tracking-wider text-right">Dandori</th>
                  <th className="py-4 px-3 font-bold text-xs uppercase tracking-wider text-right">DT</th>
                  <th className="py-4 px-3 font-bold text-xs uppercase tracking-wider text-right">Break</th>
                  <th className="py-4 px-3 font-bold text-xs uppercase tracking-wider text-center">Routing</th>
                  <th className="py-4 px-3 font-bold text-xs uppercase tracking-wider text-center">Aksi</th>
                </tr>
              </thead>
              <tbody
                key={`${selectedLineId}-${selectedJenis}-${startDate}-${endDate}`}
                className="divide-y divide-slate-100 animate-in fade-in slide-in-from-bottom-2 duration-500"
              >
                {filtered.map((row, index) => {
                  const isSelected = selectedIds.has(row.id);
                  const data = row.data;
                  const isProd = row.jenis === "produksi";
                  const routing = isProd && data.extra?.routing_type
                    ? `${data.extra.routing_type}${data.extra.routing_numbers ? ` ${data.extra.routing_numbers.join(",")}` : ""}`
                    : "-";
                  const hasDt = isProd && (data.downtime_menit ?? 0) > 0;

                  return (
                    <tr
                      key={`${row.jenis}-${data.id || index}`}
                      onClick={() => toggleSelectRow(row.id)}
                      className={`transition-colors duration-200 cursor-pointer animate-in fade-in slide-in-from-bottom-1 duration-300 fill-mode-backwards ${
                        isSelected ? "bg-blue-50/70 hover:bg-blue-50" : "hover:bg-slate-50"
                      }`}
                      style={{ animationDelay: `${Math.min(index * 20, 300)}ms` }}
                    >
                      {/* Checkbox Column */}
                      <td className="py-3 pl-3 pr-1 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => toggleSelectRow(row.id, e)}
                          aria-label={`Pilih baris ${row.part_number || row.id}`}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                        />
                      </td>

                      {/* Kode */}
                      <td className="py-3 px-3 font-mono text-xs text-slate-700 whitespace-nowrap">
                        {isProd ? data.kode || "-" : (
                          <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                            Non-Prod
                          </span>
                        )}
                      </td>

                      {/* Line */}
                      <td className="py-3 px-3 font-semibold text-xs text-slate-700 whitespace-nowrap">
                        {row.line_name ?? row.mesin}
                      </td>

                      {/* Stasiun */}
                      <td className="py-3 px-3 font-mono text-xs text-slate-500 whitespace-nowrap">
                        {data.stasiun || "-"}
                      </td>

                      {/* Waktu Awal */}
                      <td className="py-3 px-3 font-mono text-xs text-slate-700 whitespace-nowrap">
                        {fmt(row.waktu_awal)}
                      </td>

                      {/* Waktu Akhir */}
                      <td className="py-3 px-3 font-mono text-xs text-slate-700 whitespace-nowrap">
                        {fmt(row.waktu_akhir)}
                      </td>

                      {/* Part Number */}
                      <td className="py-3 px-3 font-semibold text-xs text-slate-900 whitespace-nowrap font-mono">
                        {row.part_number || "-"}
                      </td>

                      {/* Qty */}
                      <td className="py-3 px-3 text-right font-mono text-xs font-bold text-slate-800 whitespace-nowrap">
                        {isProd ? fmtNum(data.qty) : "-"}
                      </td>

                      {/* MP */}
                      <td className="py-3 px-3 text-center font-mono text-xs text-slate-700 whitespace-nowrap">
                        {isProd ? fmtNum(data.manpower) : "-"}
                      </td>

                      {/* Dandori */}
                      <td className="py-3 px-3 text-right font-mono text-xs text-slate-600 whitespace-nowrap">
                        {isProd ? (data.dandori_menit ? `${fmtNum(data.dandori_menit)} mnt` : "-") : "-"}
                      </td>

                      {/* DT */}
                      <td className="py-3 px-3 text-right font-mono text-xs whitespace-nowrap">
                        {isProd ? (
                          hasDt ? (
                            <span className="text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              {fmtNum(data.downtime_menit)} mnt
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )
                        ) : (
                          "-"
                        )}
                      </td>

                      {/* Break */}
                      <td className="py-3 px-3 text-right font-mono text-xs text-slate-600 whitespace-nowrap">
                        {isProd ? (data.break_menit ? `${fmtNum(data.break_menit)} mnt` : "-") : "-"}
                      </td>

                      {/* Routing */}
                      <td className="py-3 px-3 text-center text-xs text-slate-600 whitespace-nowrap font-mono">
                        {routing}
                      </td>

                      {/* Aksi */}
                      <td className="py-3 px-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            className="inline-flex items-center justify-center h-7 w-7 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors duration-200 cursor-pointer"
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openDelete(row)}
                            className="inline-flex items-center justify-center h-7 w-7 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors duration-200 cursor-pointer"
                            title="Hapus"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ===================== EDIT MODAL ===================== */}
      {editTarget && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-[2px] ${
            isEditClosing
              ? "animate-out fade-out duration-200 [animation-fill-mode:forwards]"
              : "animate-in fade-in duration-200"
          }`}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeEdit();
          }}
        >
          <div
            className={`relative w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden text-slate-800 ${
              isEditClosing
                ? "animate-out fade-out zoom-out-95 duration-200 [animation-fill-mode:forwards]"
                : "animate-in fade-in zoom-in-95 duration-200"
            }`}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Edit Riwayat {editTarget.jenis === "produksi" ? "Produksi" : "Non-Produksi"}
                </h3>
                <p className="text-xs text-slate-500">
                  {editTarget.line_name ?? editTarget.mesin} — {fmt(editTarget.waktu_awal)}
                </p>
              </div>
              <button
                onClick={closeEdit}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors duration-200 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 max-h-[65vh] overflow-y-auto space-y-3">
              {editTarget.jenis === "produksi" ? (
                <>
                  <Field label="Part Number">
                    <input
                      list="edit-part-options"
                      value={editProdForm.part_number}
                      onChange={(e) => setEditProdForm((p) => ({ ...p, part_number: e.target.value }))}
                      placeholder="Pilih atau ketik part number..."
                      className={inputCls}
                    />
                    <datalist id="edit-part-options">
                      {partOptions.map((p) => (
                        <option key={p} value={p} />
                      ))}
                    </datalist>
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Waktu Awal">
                      <input
                        type="datetime-local"
                        value={editProdForm.waktu_awal}
                        onChange={(e) => setEditProdForm((p) => ({ ...p, waktu_awal: e.target.value }))}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Waktu Akhir">
                      <input
                        type="datetime-local"
                        value={editProdForm.waktu_akhir}
                        onChange={(e) => setEditProdForm((p) => ({ ...p, waktu_akhir: e.target.value }))}
                        className={inputCls}
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Qty">
                      <input
                        type="number"
                        min={0}
                        value={editProdForm.qty}
                        onChange={(e) => setEditProdForm((p) => ({ ...p, qty: e.target.value }))}
                        className={inputCls}
                        placeholder="0"
                      />
                    </Field>
                    <Field label="Manpower (MP)">
                      <input
                        type="number"
                        min={0}
                        value={editProdForm.manpower}
                        onChange={(e) => setEditProdForm((p) => ({ ...p, manpower: e.target.value }))}
                        className={inputCls}
                        placeholder="0"
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Dandori (mnt)">
                      <input
                        type="number"
                        min={0}
                        value={editProdForm.dandori_menit}
                        onChange={(e) => setEditProdForm((p) => ({ ...p, dandori_menit: e.target.value }))}
                        className={inputCls}
                        placeholder="0"
                      />
                    </Field>
                    <Field label="Downtime (mnt)">
                      <input
                        type="number"
                        min={0}
                        value={editProdForm.downtime_menit}
                        onChange={(e) => setEditProdForm((p) => ({ ...p, downtime_menit: e.target.value }))}
                        className={inputCls}
                        placeholder="0"
                      />
                    </Field>
                    <Field label="Break (mnt)">
                      <input
                        type="number"
                        min={0}
                        value={editProdForm.break_menit}
                        onChange={(e) => setEditProdForm((p) => ({ ...p, break_menit: e.target.value }))}
                        className={inputCls}
                        placeholder="0"
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Routing Type">
                      <select
                        value={editProdForm.routing_type}
                        onChange={(e) => setEditProdForm((p) => ({ ...p, routing_type: e.target.value as any }))}
                        className={inputCls}
                      >
                        <option value="">- Tidak Ada -</option>
                        <option value="WIP">WIP</option>
                        <option value="FG">FG</option>
                      </select>
                    </Field>
                    <Field label="Routing Numbers (mis: 1,2,3)">
                      <input
                        type="text"
                        value={editProdForm.routing_numbers}
                        onChange={(e) => setEditProdForm((p) => ({ ...p, routing_numbers: e.target.value }))}
                        className={inputCls}
                        placeholder="1,2,3"
                      />
                    </Field>
                  </div>
                </>
              ) : (
                <>
                  <Field label="Jenis / Nama Non-Produksi">
                    <input
                      type="text"
                      value={editNonProdForm.nama}
                      onChange={(e) => setEditNonProdForm((p) => ({ ...p, nama: e.target.value }))}
                      className={inputCls}
                      placeholder="Contoh: Briefing, 5R, Setup, dll."
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Waktu Awal">
                      <input
                        type="datetime-local"
                        value={editNonProdForm.waktu_awal}
                        onChange={(e) => setEditNonProdForm((p) => ({ ...p, waktu_awal: e.target.value }))}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Waktu Akhir">
                      <input
                        type="datetime-local"
                        value={editNonProdForm.waktu_akhir}
                        onChange={(e) => setEditNonProdForm((p) => ({ ...p, waktu_akhir: e.target.value }))}
                        className={inputCls}
                      />
                    </Field>
                  </div>
                </>
              )}

              {editError && (
                <p className="mt-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-2">
                  {editError}
                </p>
              )}
            </div>

            <div className="border-t border-slate-100 px-6 py-4 flex gap-3">
              <Button onClick={closeEdit} disabled={isSavingEdit} variant="outline" className="flex-1 h-10 cursor-pointer">
                Batal
              </Button>
              <Button onClick={handleSaveEdit} disabled={isSavingEdit} className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer">
                {isSavingEdit ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  "Simpan Perubahan"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== CREATE MODAL ===================== */}
      {showCreate && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-[2px] ${
            isCreateClosing
              ? "animate-out fade-out duration-200 [animation-fill-mode:forwards]"
              : "animate-in fade-in duration-200"
          }`}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeCreate();
          }}
        >
          <div
            className={`relative w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden text-slate-800 ${
              isCreateClosing
                ? "animate-out fade-out zoom-out-95 duration-200 [animation-fill-mode:forwards]"
                : "animate-in fade-in zoom-in-95 duration-200"
            }`}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Tambah Entri Riwayat</h3>
                <p className="text-xs text-slate-500">Tambah data produksi atau non-produksi secara manual</p>
              </div>
              <button
                onClick={closeCreate}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors duration-200 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 max-h-[65vh] overflow-y-auto space-y-3">
              {/* Jenis Switcher */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block">Kategori Entri *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateForm((p) => ({ ...p, jenis: "produksi" }))}
                    className={`py-2 text-xs font-bold rounded-lg border transition cursor-pointer ${
                      createForm.jenis === "produksi"
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Produksi
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreateForm((p) => ({ ...p, jenis: "non_produksi" }))}
                    className={`py-2 text-xs font-bold rounded-lg border transition cursor-pointer ${
                      createForm.jenis === "non_produksi"
                        ? "border-amber-600 bg-amber-50 text-amber-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Non-Produksi (Setup/5R/dll)
                  </button>
                </div>
              </div>

              {/* Line Selector */}
              <Field label="Line *">
                <div className="relative">
                  <select
                    value={createForm.line_id}
                    onChange={(e) => {
                      setCreateForm((p) => ({ ...p, line_id: e.target.value, part_number: "" }));
                      void loadPartOptions(e.target.value);
                    }}
                    className={inputCls}
                  >
                    <option value="">— Pilih Line —</option>
                    {lines.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </div>
              </Field>

              {createForm.jenis === "produksi" ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Part Number">
                      <input
                        list="create-part-options"
                        value={createForm.part_number}
                        onChange={(e) => setCreateForm((p) => ({ ...p, part_number: e.target.value }))}
                        placeholder="Pilih/ketik..."
                        className={inputCls}
                      />
                      <datalist id="create-part-options">
                        {partOptions.map((p) => (
                          <option key={p} value={p} />
                        ))}
                      </datalist>
                    </Field>
                    <Field label="Stasiun (Opsional)">
                      <input
                        type="text"
                        value={createForm.stasiun}
                        onChange={(e) => setCreateForm((p) => ({ ...p, stasiun: e.target.value }))}
                        placeholder="ST1, OP10, dll."
                        className={inputCls}
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Waktu Mulai *">
                      <input
                        type="datetime-local"
                        value={createForm.waktu_awal}
                        onChange={(e) => setCreateForm((p) => ({ ...p, waktu_awal: e.target.value }))}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Waktu Selesai">
                      <input
                        type="datetime-local"
                        value={createForm.waktu_akhir}
                        onChange={(e) => setCreateForm((p) => ({ ...p, waktu_akhir: e.target.value }))}
                        className={inputCls}
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Qty">
                      <input
                        type="number"
                        min={0}
                        value={createForm.qty}
                        onChange={(e) => setCreateForm((p) => ({ ...p, qty: e.target.value }))}
                        className={inputCls}
                        placeholder="0"
                      />
                    </Field>
                    <Field label="Manpower (MP)">
                      <input
                        type="number"
                        min={0}
                        value={createForm.manpower}
                        onChange={(e) => setCreateForm((p) => ({ ...p, manpower: e.target.value }))}
                        className={inputCls}
                        placeholder="0"
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Dandori (mnt)">
                      <input
                        type="number"
                        min={0}
                        value={createForm.dandori_menit}
                        onChange={(e) => setCreateForm((p) => ({ ...p, dandori_menit: e.target.value }))}
                        className={inputCls}
                        placeholder="0"
                      />
                    </Field>
                    <Field label="Downtime (mnt)">
                      <input
                        type="number"
                        min={0}
                        value={createForm.downtime_menit}
                        onChange={(e) => setCreateForm((p) => ({ ...p, downtime_menit: e.target.value }))}
                        className={inputCls}
                        placeholder="0"
                      />
                    </Field>
                    <Field label="Break (mnt)">
                      <input
                        type="number"
                        min={0}
                        value={createForm.break_menit}
                        onChange={(e) => setCreateForm((p) => ({ ...p, break_menit: e.target.value }))}
                        className={inputCls}
                        placeholder="0"
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Routing Type">
                      <select
                        value={createForm.routing_type}
                        onChange={(e) => setCreateForm((p) => ({ ...p, routing_type: e.target.value as any }))}
                        className={inputCls}
                      >
                        <option value="">- Tidak Ada -</option>
                        <option value="WIP">WIP</option>
                        <option value="FG">FG</option>
                      </select>
                    </Field>
                    <Field label="Routing Numbers">
                      <input
                        type="text"
                        value={createForm.routing_numbers}
                        onChange={(e) => setCreateForm((p) => ({ ...p, routing_numbers: e.target.value }))}
                        placeholder="1,2,3"
                        className={inputCls}
                      />
                    </Field>
                  </div>
                </>
              ) : (
                <>
                  <Field label="Jenis / Nama Non-Produksi *">
                    <input
                      type="text"
                      value={createForm.nama_non_produksi}
                      onChange={(e) => setCreateForm((p) => ({ ...p, nama_non_produksi: e.target.value }))}
                      placeholder="Briefing, 5R, Setup, Maintenance, dll."
                      className={inputCls}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Waktu Mulai *">
                      <input
                        type="datetime-local"
                        value={createForm.waktu_awal}
                        onChange={(e) => setCreateForm((p) => ({ ...p, waktu_awal: e.target.value }))}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Waktu Selesai">
                      <input
                        type="datetime-local"
                        value={createForm.waktu_akhir}
                        onChange={(e) => setCreateForm((p) => ({ ...p, waktu_akhir: e.target.value }))}
                        className={inputCls}
                      />
                    </Field>
                  </div>
                </>
              )}

              {createError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-2">
                  {createError}
                </p>
              )}
            </div>

            <div className="border-t border-slate-100 px-6 py-4 flex gap-3">
              <Button onClick={closeCreate} disabled={isSavingCreate} variant="outline" className="flex-1 h-10 cursor-pointer">
                Batal
              </Button>
              <Button onClick={handleSaveCreate} disabled={isSavingCreate} className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer">
                {isSavingCreate ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  "Tambah Entri"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== DELETE MODAL ===================== */}
      {deleteTarget && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-[2px] ${
            isDeleteClosing
              ? "animate-out fade-out duration-200 [animation-fill-mode:forwards]"
              : "animate-in fade-in duration-200"
          }`}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) closeDelete();
          }}
        >
          <div
            className={`relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl ${
              isDeleteClosing
                ? "animate-out fade-out zoom-out-95 duration-200 [animation-fill-mode:forwards]"
                : "animate-in fade-in zoom-in-95 duration-200"
            }`}
          >
            <button
              onClick={closeDelete}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors duration-200"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-50 border border-red-100 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900">Hapus Baris Riwayat</h3>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                  Hapus entri <span className="font-semibold text-slate-800">{deleteTarget.part_number ?? "-"}</span>{" "}
                  pada <span className="font-semibold text-slate-800">{fmt(deleteTarget.waktu_awal)}</span>{" "}
                  ({deleteTarget.line_name ?? deleteTarget.mesin})?
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Data akan disembunyikan (soft-delete), bukan dihapus permanen.
                </p>
              </div>
            </div>
            {deleteError && (
              <div className="mt-4 rounded-md bg-red-50 p-3 text-xs text-red-800 border border-red-100">
                {deleteError}
              </div>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <Button
                disabled={isDeleting}
                onClick={closeDelete}
                className="h-10 bg-slate-500 hover:bg-slate-600 text-white font-semibold cursor-pointer"
              >
                Batal
              </Button>
              <Button
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="h-10 bg-red-600 hover:bg-red-700 text-white font-semibold cursor-pointer"
              >
                {isDeleting ? "Menghapus..." : "Ya, Hapus"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== BULK DELETE MODAL ===================== */}
      {isBulkDeleteModalOpen && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-[2px] ${
            isBulkDeleteClosing
              ? "animate-out fade-out duration-200 [animation-fill-mode:forwards]"
              : "animate-in fade-in duration-200"
          }`}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isBulkDeleting) closeBulkDeleteModal();
          }}
        >
          <div
            className={`relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl ${
              isBulkDeleteClosing
                ? "animate-out fade-out zoom-out-95 duration-200 [animation-fill-mode:forwards]"
                : "animate-in fade-in zoom-in-95 duration-200"
            }`}
          >
            <button
              onClick={closeBulkDeleteModal}
              disabled={isBulkDeleting}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors duration-200 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-50 border border-red-100 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900">Hapus {selectedIds.size} Baris Riwayat</h3>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                  Apakah Anda yakin ingin menghapus <span className="font-bold text-slate-900">{selectedIds.size}</span> data riwayat produksi yang dipilih?
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Data akan disembunyikan (soft-delete), bukan dihapus permanen.
                </p>
              </div>
            </div>
            {bulkDeleteError && (
              <div className="mt-4 rounded-md bg-red-50 p-3 text-xs text-red-800 border border-red-100">
                {bulkDeleteError}
              </div>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                disabled={isBulkDeleting}
                onClick={closeBulkDeleteModal}
                className="h-10 bg-slate-500 hover:bg-slate-600 text-white font-semibold cursor-pointer"
              >
                Batal
              </Button>
              <Button
                type="button"
                disabled={isBulkDeleting}
                onClick={handleBulkDeleteConfirm}
                className="h-10 bg-red-600 hover:bg-red-700 text-white font-semibold flex items-center gap-2 cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
                {isBulkDeleting ? "Menghapus..." : `Ya, Hapus (${selectedIds.size})`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductionLogTableSkeleton() {
  return (
    <div className="overflow-x-auto select-none animate-pulse">
      <table className="w-full text-left text-sm border-collapse">
        <thead>
          <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
            <th className="py-4 pl-3 pr-1 w-10 text-center"><div className="h-4 w-4 bg-slate-200 rounded mx-auto" /></th>
            {[
              "Kode",
              "Line",
              "Stasiun",
              "Waktu Awal",
              "Waktu Akhir",
              "Part Number",
              "Qty",
              "MP",
              "Dandori",
              "DT",
              "Break",
              "Routing",
              "Aksi",
            ].map((col) => (
              <th key={col} className="py-4 px-3 font-bold text-xs uppercase tracking-wider">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {Array.from({ length: 8 }).map((_, i) => (
            <tr key={i}>
              <td className="py-3 pl-3 pr-1 text-center"><div className="h-4 w-4 bg-slate-200 rounded mx-auto" /></td>
              <td className="py-3 px-3"><div className="h-4 bg-slate-200 rounded w-14" /></td>
              <td className="py-3 px-3"><div className="h-4 bg-slate-200 rounded w-20" /></td>
              <td className="py-3 px-3"><div className="h-4 bg-slate-200 rounded w-12" /></td>
              <td className="py-3 px-3"><div className="h-4 bg-slate-200 rounded w-24" /></td>
              <td className="py-3 px-3"><div className="h-4 bg-slate-200 rounded w-24" /></td>
              <td className="py-3 px-3"><div className="h-4 bg-slate-200 rounded w-20 font-mono" /></td>
              <td className="py-3 px-3"><div className="h-4 bg-slate-200 rounded w-10 ml-auto" /></td>
              <td className="py-3 px-3"><div className="h-4 bg-slate-200 rounded w-8 mx-auto" /></td>
              <td className="py-3 px-3"><div className="h-4 bg-slate-200 rounded w-12 ml-auto" /></td>
              <td className="py-3 px-3"><div className="h-4 bg-slate-200 rounded w-12 ml-auto" /></td>
              <td className="py-3 px-3"><div className="h-4 bg-slate-200 rounded w-12 ml-auto" /></td>
              <td className="py-3 px-3"><div className="h-4 bg-slate-200 rounded w-14 mx-auto" /></td>
              <td className="py-3 px-3"><div className="h-7 bg-slate-200 rounded-lg w-16 mx-auto" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
