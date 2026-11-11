"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Copy,
  Download,
  Eye,
  Layers,
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
import { downtimeApi, subscribeToSocketEvent } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const DOWNTIME_REFRESH_INTERVAL_MS = 60000;

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

function getDefaultMonthRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return {
    startDate: `${year}-${month}-01`,
    endDate: `${year}-${month}-${day}`,
  };
}

// Format date directly from string/UTC without timezone shift
function formatDate(iso?: string | null): string {
  if (!iso) return "-";
  if (typeof iso === "string") {
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      const [, y, mo, d] = m;
      return `${d}/${mo}/${y}`;
    }
  }
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

// Format time directly from string/UTC without timezone shift (15:45 stays 15:45)
function formatTime(iso?: string | null): string {
  if (!iso) return "--:--";
  if (typeof iso === "string") {
    const m = iso.match(/(?:[T ]|^)(\d{2}):(\d{2})/);
    if (m) return `${m[1]}:${m[2]}`;
  }
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "--:--";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

// Convert DB ISO string to datetime-local value (YYYY-MM-DDTHH:mm)
function toLocalInput(iso?: string | null): string {
  if (!iso) return "";
  if (typeof iso === "string") {
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
    if (m) {
      const [, y, mo, d, h, mi] = m;
      return `${y}-${mo}-${d}T${h}:${mi}`;
    }
  }
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

// Convert datetime-local value to DB ISO without timezone shift
function toDbIso(localInputStr: string | null | undefined): string | null {
  if (!localInputStr) return null;
  const trimmed = localInputStr.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?/.test(trimmed)) {
    if (trimmed.length === 16) return `${trimmed}:00.000Z`;
    return trimmed.endsWith("Z") ? trimmed : `${trimmed}.000Z`;
  }
  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function getDurationMinutes(startIso?: string | null, endIso?: string | null): number {
  if (!startIso || !endIso) return 0;
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  if (isNaN(startMs) || isNaN(endMs)) return 0;
  return Math.max(0, Math.round((endMs - startMs) / 60000));
}

export interface DowntimeItem {
  id: string;
  mesin: string;
  line_id: string | null;
  line_name?: string | null;
  waktu_awal: string;
  waktu_akhir: string;
  kategori: string | null;
  problem: string | null;
  penyebab: string | null;
  countermeasure: string | null;
  stasiun: string | null;
  is_active: boolean;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface DowntimeFormData {
  id?: string;
  line_id: string;
  mesin: string;
  stasiun: string;
  kategori: string;
  problem: string;
  penyebab: string;
  countermeasure: string;
  waktu_awal: string;
  waktu_akhir: string;
}

const emptyFormData = (): DowntimeFormData => {
  const now = new Date();
  const past = new Date(now.getTime() - 15 * 60000);
  return {
    line_id: "",
    mesin: "tandem",
    stasiun: "",
    kategori: "MESIN",
    problem: "",
    penyebab: "",
    countermeasure: "",
    waktu_awal: toLocalInput(past.toISOString()),
    waktu_akhir: toLocalInput(now.toISOString()),
  };
};

export default function DowntimeLogClient() {
  const [downtimeList, setDowntimeList] = useState<DowntimeItem[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters (default to current month)
  const defaultRange = useMemo(() => getDefaultMonthRange(), []);
  const [selectedLineId, setSelectedLineId] = useState("all");
  const [selectedKategori, setSelectedKategori] = useState("all");
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Pagination state (Server-side)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [serverTotalPages, setServerTotalPages] = useState(1);
  const [isExporting, setIsExporting] = useState(false);

  // Bulk Selection States
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  // Detail Modal State
  const [detailItem, setDetailItem] = useState<DowntimeItem | null>(null);
  const [isDetailClosing, setIsDetailClosing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Form (Create / Edit) Modal State
  const [showFormModal, setShowFormModal] = useState(false);
  const [isFormClosing, setIsFormClosing] = useState(false);
  const [isSavingForm, setIsSavingForm] = useState(false);
  const [formError, setFormError] = useState("");
  const [formData, setFormData] = useState<DowntimeFormData>(emptyFormData());
  const isEditing = Boolean(formData.id);

  // Single Delete Modal State
  const [deleteTarget, setDeleteTarget] = useState<DowntimeItem | null>(null);
  const [isDeletingSingle, setIsDeletingSingle] = useState(false);
  const [isDeleteClosing, setIsDeleteClosing] = useState(false);

  const requestIdRef = useRef(0);
  const lastBackgroundRefreshRef = useRef(0);

  // Common Problem suggestions
  const problemSuggestions = useMemo(() => {
    const set = new Set<string>();
    downtimeList.forEach((d) => {
      if (d.problem && d.problem.trim()) set.add(d.problem.trim());
    });
    return Array.from(set).slice(0, 30);
  }, [downtimeList]);

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Load lines on mount
  useEffect(() => {
    async function loadLines() {
      try {
        const linesData = await getLines({ includeHidden: true });
        setLines(linesData);
      } catch (err) {
        console.error("Gagal memuat line produksi:", err);
      }
    }
    void loadLines();
  }, []);

  // Fetch Downtime Data with Server-Side Pagination
  const loadDowntime = useCallback(
    async ({ showLoading = true }: { showLoading?: boolean } = {}) => {
      const requestId = ++requestIdRef.current;
      try {
        if (showLoading) setIsLoading(true);
        setError("");

        const params: Parameters<typeof downtimeApi.get>[0] = {
          page: currentPage,
          pageSize,
          is_active: true,
          search: debouncedSearch.trim() || undefined,
        };

        if (selectedLineId !== "all") params.line_id = selectedLineId;
        if (selectedKategori !== "all") params.kategori = selectedKategori;
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;

        const res = await downtimeApi.get(params);
        if (requestIdRef.current !== requestId) return;

        if (res.error) throw new Error(res.error);

        const items: DowntimeItem[] = res.data || [];
        setDowntimeList(items);

        if (typeof res.total === "number") {
          setTotalCount(res.total);
          setServerTotalPages(res.totalPages || Math.max(1, Math.ceil(res.total / pageSize)));
        } else {
          setTotalCount(items.length);
          setServerTotalPages(Math.max(1, Math.ceil(items.length / pageSize)));
        }
      } catch (err: any) {
        if (requestIdRef.current !== requestId) return;
        setError(err.message || "Gagal memuat data downtime.");
        console.error(err);
      } finally {
        if (requestIdRef.current === requestId && showLoading) {
          setIsLoading(false);
        }
      }
    },
    [currentPage, pageSize, debouncedSearch, selectedLineId, selectedKategori, startDate, endDate]
  );

  // Trigger load on filter changes
  useEffect(() => {
    const timer = setTimeout(() => {
      void loadDowntime();
    }, 50);
    return () => clearTimeout(timer);
  }, [loadDowntime]);

  // Real-time WebSocket + Background Polling
  useEffect(() => {
    const handleBackgroundRefresh = () => {
      const now = Date.now();
      if (now - lastBackgroundRefreshRef.current < 15000) return;
      lastBackgroundRefreshRef.current = now;
      void loadDowntime({ showLoading: false });
    };

    const unsubscribe = subscribeToSocketEvent(
      "prod_downtime_log",
      "*",
      handleBackgroundRefresh
    );

    const intervalId = window.setInterval(() => {
      void loadDowntime({ showLoading: false });
    }, DOWNTIME_REFRESH_INTERVAL_MS);

    window.addEventListener("focus", handleBackgroundRefresh);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleBackgroundRefresh);
      unsubscribe();
    };
  }, [loadDowntime]);

  const handleRefresh = () => {
    void loadDowntime({ showLoading: true });
  };

  const handleResetFilters = () => {
    setSelectedLineId("all");
    setSelectedKategori("all");
    const def = getDefaultMonthRange();
    setStartDate(def.startDate);
    setEndDate(def.endDate);
    setSearchQuery("");
    setDebouncedSearch("");
    setCurrentPage(1);
  };

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedLineId, selectedKategori, startDate, endDate, pageSize]);

  // KPI Statistics Calculation
  const stats = useMemo(() => {
    let totalMinutes = 0;
    const categoryCounts: Record<string, number> = {};
    const lineMinutes: Record<string, number> = {};

    downtimeList.forEach((d) => {
      const dur = getDurationMinutes(d.waktu_awal, d.waktu_akhir);
      totalMinutes += dur;

      const cat = d.kategori || "OTHER";
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;

      const lineName = d.line_name || d.mesin || "Unknown";
      lineMinutes[lineName] = (lineMinutes[lineName] || 0) + dur;
    });

    const totalIncidents = totalCount > 0 ? totalCount : downtimeList.length;
    const avgDuration = downtimeList.length > 0 ? totalMinutes / downtimeList.length : 0;

    let topLineName = "-";
    let topLineMinutes = 0;
    Object.entries(lineMinutes).forEach(([name, mins]) => {
      if (mins > topLineMinutes) {
        topLineMinutes = mins;
        topLineName = name;
      }
    });

    let topCategoryName = "-";
    let topCategoryCount = 0;
    Object.entries(categoryCounts).forEach(([cat, cnt]) => {
      if (cnt > topCategoryCount) {
        topCategoryCount = cnt;
        topCategoryName = cat;
      }
    });
    const topCategoryPercent = downtimeList.length > 0
      ? Math.round((topCategoryCount / downtimeList.length) * 100)
      : 0;

    return {
      totalMinutes,
      totalIncidents,
      avgDuration,
      topLineName,
      topLineMinutes,
      topCategoryName,
      topCategoryCount,
      topCategoryPercent,
    };
  }, [downtimeList, totalCount]);

  // Bulk Selection Handlers
  const isAllPageSelected = useMemo(() => {
    return downtimeList.length > 0 && downtimeList.every((d) => selectedIds.has(d.id));
  }, [downtimeList, selectedIds]);

  const isSomePageSelected = useMemo(() => {
    return downtimeList.some((d) => selectedIds.has(d.id)) && !isAllPageSelected;
  }, [downtimeList, selectedIds, isAllPageSelected]);

  const toggleSelectRow = (id: string, e?: React.MouseEvent | React.ChangeEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectPage = () => {
    if (isAllPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        downtimeList.forEach((d) => next.delete(d.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        downtimeList.forEach((d) => next.add(d.id));
        return next;
      });
    }
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // CSV Export Utility
  const handleExportCSV = async () => {
    if (totalCount === 0 && downtimeList.length === 0) return;
    try {
      setIsExporting(true);
      let exportData = downtimeList;

      if (totalCount > downtimeList.length) {
        toast.info(`Mengunduh ${totalCount} data downtime untuk ekspor CSV...`);
        const fullRes = await downtimeApi.get({
          limit: 10000,
          is_active: true,
          line_id: selectedLineId !== "all" ? selectedLineId : undefined,
          kategori: selectedKategori !== "all" ? selectedKategori : undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          search: debouncedSearch.trim() || undefined,
        });
        exportData = fullRes.data || [];
      }

      if (exportData.length === 0) {
        toast.error("Tidak ada data yang dapat diekspor.");
        return;
      }

      const headers = [
        "Tanggal",
        "Line / Mesin",
        "Stasiun",
        "Kategori",
        "Problem",
        "Penyebab",
        "Countermeasure",
        "Jam Mulai",
        "Jam Selesai",
        "Durasi (Menit)",
      ];

      const csvRows = [headers.join(",")];
      exportData.forEach((row) => {
        const dur = getDurationMinutes(row.waktu_awal, row.waktu_akhir);
        const lineName = row.line_name || row.mesin || "-";

        const values = [
          formatDate(row.waktu_awal),
          lineName,
          row.stasiun || "-",
          row.kategori || "-",
          row.problem || "-",
          row.penyebab || "-",
          row.countermeasure || "-",
          formatTime(row.waktu_awal),
          formatTime(row.waktu_akhir),
          dur,
        ].map((val) => {
          const str = String(val ?? "");
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        });

        csvRows.push(values.join(","));
      });

      const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(csvRows.join("\n"));
      const link = document.createElement("a");
      link.setAttribute("href", csvContent);
      const filename = `downtime_log_${new Date().toISOString().slice(0, 10)}.csv`;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Data downtime berhasil diekspor ke CSV!");
    } catch (e: any) {
      toast.error("Gagal mengekspor data: " + (e.message || "Unknown error"));
    } finally {
      setIsExporting(false);
    }
  };

  // Detail Modal Handlers
  const openDetail = (item: DowntimeItem) => {
    setDetailItem(item);
    setIsCopied(false);
  };

  const closeDetail = () => {
    if (isDetailClosing) return;
    setIsDetailClosing(true);
    setTimeout(() => {
      setDetailItem(null);
      setIsDetailClosing(false);
      setIsCopied(false);
    }, 200);
  };

  const handleCopyDetail = () => {
    if (!detailItem) return;
    const dur = getDurationMinutes(detailItem.waktu_awal, detailItem.waktu_akhir);
    const lineName = detailItem.line_name || detailItem.mesin || "-";
    const text = `=== DETAIL CATATAN DOWNTIME ===
Tanggal: ${formatDate(detailItem.waktu_awal)}
Line: ${lineName}
Stasiun: ${detailItem.stasiun || "-"}
Kategori: ${detailItem.kategori || "-"}
Problem: ${detailItem.problem || "-"}
Penyebab: ${detailItem.penyebab || "-"}
Countermeasure: ${detailItem.countermeasure || "-"}
Waktu Mulai: ${formatTime(detailItem.waktu_awal)}
Waktu Selesai: ${formatTime(detailItem.waktu_akhir)}
Durasi: ${dur} menit (${(dur / 60).toFixed(1)} jam)
===============================`;

    try {
      navigator.clipboard.writeText(text);
      setIsCopied(true);
      toast.success("Detail downtime berhasil disalin!");
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error("Gagal menyalin detail downtime.");
    }
  };

  // Form (Create / Edit) Modal Handlers
  const openCreateModal = () => {
    const init = emptyFormData();
    if (selectedLineId !== "all") {
      init.line_id = selectedLineId;
      const matched = lines.find((l) => l.id === selectedLineId);
      if (matched) init.mesin = matched.machine_type || "tandem";
    }
    setFormData(init);
    setFormError("");
    setShowFormModal(true);
  };

  const openEditModal = (item: DowntimeItem) => {
    setFormData({
      id: item.id,
      line_id: item.line_id || "",
      mesin: item.mesin || "tandem",
      stasiun: item.stasiun || "",
      kategori: item.kategori || "MESIN",
      problem: item.problem || "",
      penyebab: item.penyebab || "",
      countermeasure: item.countermeasure || "",
      waktu_awal: toLocalInput(item.waktu_awal),
      waktu_akhir: toLocalInput(item.waktu_akhir),
    });
    setFormError("");
    setShowFormModal(true);
  };

  const closeFormModal = () => {
    if (isFormClosing) return;
    setIsFormClosing(true);
    setTimeout(() => {
      setShowFormModal(false);
      setIsFormClosing(false);
      setFormData(emptyFormData());
      setFormError("");
    }, 200);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.waktu_awal) {
      setFormError("Waktu Mulai wajib diisi.");
      return;
    }
    if (!formData.waktu_akhir) {
      setFormError("Waktu Selesai wajib diisi.");
      return;
    }
    if (!formData.problem.trim()) {
      setFormError("Deskripsi Problem wajib diisi.");
      return;
    }

    const startIso = toDbIso(formData.waktu_awal);
    const endIso = toDbIso(formData.waktu_akhir);
    if (!startIso || !endIso) {
      setFormError("Format tanggal dan waktu tidak valid.");
      return;
    }
    if (new Date(endIso).getTime() < new Date(startIso).getTime()) {
      setFormError("Waktu Selesai tidak boleh lebih awal dari Waktu Mulai.");
      return;
    }

    try {
      setIsSavingForm(true);
      setFormError("");

      const selectedLine = lines.find((l) => l.id === formData.line_id);
      const machineType = selectedLine?.machine_type || formData.mesin || "tandem";

      const payload = {
        line_id: formData.line_id || null,
        mesin: machineType,
        stasiun: formData.stasiun.trim() || null,
        kategori: formData.kategori || null,
        problem: formData.problem.trim(),
        penyebab: formData.penyebab.trim() || null,
        countermeasure: formData.countermeasure.trim() || null,
        waktu_awal: startIso,
        waktu_akhir: endIso,
        is_active: true,
      };

      if (isEditing && formData.id) {
        const res = await downtimeApi.update(formData.id, payload);
        if (res.error) throw new Error(res.error);
        toast.success("Catatan downtime berhasil diperbarui!");
      } else {
        const res = await downtimeApi.create(payload);
        if (res.error) throw new Error(res.error);
        toast.success("Catatan downtime baru berhasil ditambahkan!");
      }

      closeFormModal();
      void loadDowntime({ showLoading: false });
    } catch (err: any) {
      setFormError(err.message || "Gagal menyimpan data downtime.");
    } finally {
      setIsSavingForm(false);
    }
  };

  // Single Delete Handlers
  const openDeleteModal = (item: DowntimeItem) => {
    setDeleteTarget(item);
  };

  const closeDeleteModal = () => {
    if (isDeleteClosing) return;
    setIsDeleteClosing(true);
    setTimeout(() => {
      setDeleteTarget(null);
      setIsDeleteClosing(false);
    }, 200);
  };

  const handleConfirmSingleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeletingSingle(true);
      const res = await downtimeApi.deleteMany([deleteTarget.id]);
      if (res.error) throw new Error(res.error);

      toast.success("Catatan downtime berhasil dihapus.");
      closeDeleteModal();
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteTarget.id);
        return next;
      });
      void loadDowntime({ showLoading: false });
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus data downtime.");
    } finally {
      setIsDeletingSingle(false);
    }
  };

  // Bulk Delete Handlers
  const handleConfirmBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      setIsBulkDeleting(true);
      const idsArray = Array.from(selectedIds);
      const res = await downtimeApi.deleteMany(idsArray);
      if (res.error) throw new Error(res.error);

      toast.success(`${idsArray.length} catatan downtime berhasil dihapus.`);
      setShowBulkDeleteModal(false);
      setSelectedIds(new Set());
      void loadDowntime({ showLoading: false });
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus data downtime terpilih.");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Category Color Badges
  const getCategoryBadgeClass = (kategori: string | null) => {
    switch (kategori?.toUpperCase()) {
      case "MESIN":
        return "bg-blue-50 text-blue-700 border-blue-200";
      case "DIES":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "FINGER":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "LINE STOP":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "SMALL STOP":
        return "bg-orange-50 text-orange-700 border-orange-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const totalPages = Math.max(1, serverTotalPages);
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = totalCount > 0 ? (safeCurrentPage - 1) * pageSize + 1 : 0;
  const endIndex = Math.min(safeCurrentPage * pageSize, totalCount);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
              Kembali
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Log Downtime Produksi
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Sync
            </span>
          </div>
          <p className="mt-1.5 text-sm text-slate-500">
            Lihat, filter, kelola, dan analisis catatan downtime seluruh line produksi secara akurat dan real-time.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={handleRefresh}
            variant="outline"
            className="h-10 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Perbarui
          </Button>
          <Button
            onClick={handleExportCSV}
            disabled={totalCount === 0 || isExporting}
            className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            {isExporting ? "Mengekspor..." : "Ekspor CSV"}
          </Button>
          <Button
            onClick={openCreateModal}
            className="h-10 bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Tambah Downtime
          </Button>
        </div>
      </div>

      {/* KPI Stats Cards - Rich Aesthetics Matching Laporan Produksi */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Downtime Card */}
        <div className="relative overflow-hidden rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
              Total Downtime
            </span>
            <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-bold text-slate-900">
              {stats.totalMinutes.toLocaleString("id-ID")} m
            </h3>
            <p className="mt-1 text-xs text-slate-500 font-medium">
              ≈ {(stats.totalMinutes / 60).toFixed(1)} jam operasional
            </p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500" />
        </div>

        {/* Total Kasus Card */}
        <div className="relative overflow-hidden rounded-xl border border-rose-100 bg-gradient-to-br from-rose-50 to-white p-5 shadow-sm transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-700">
              Total Insiden
            </span>
            <div className="rounded-lg bg-rose-100 p-2 text-rose-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-bold text-slate-900">
              {stats.totalIncidents.toLocaleString("id-ID")}
            </h3>
            <p className="mt-1 text-xs text-slate-500 font-medium">Insiden tercatat</p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-rose-500" />
        </div>

        {/* Rata-rata Durasi Card */}
        <div className="relative overflow-hidden rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-700">
              Rata-rata Durasi
            </span>
            <div className="rounded-lg bg-blue-100 p-2 text-blue-700">
              <Activity className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-bold text-slate-900">
              {stats.avgDuration.toFixed(1)} m
            </h3>
            <p className="mt-1 text-xs text-slate-500 font-medium">Rata-rata per insiden</p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500" />
        </div>

        {/* Line Terbanyak Downtime Card */}
        <div className="relative overflow-hidden rounded-xl border border-purple-100 bg-gradient-to-br from-purple-50 to-white p-5 shadow-sm transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-purple-700">
              Line Terbanyak DT
            </span>
            <div className="rounded-lg bg-purple-100 p-2 text-purple-700">
              <Layers className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-900 truncate" title={stats.topLineName}>
              {stats.topLineName}
            </h3>
            <p className="mt-1 text-xs text-slate-500 font-medium">
              {stats.topLineMinutes.toLocaleString("id-ID")} menit downtime
            </p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-purple-500" />
        </div>

        {/* Kategori Dominan Card */}
        <div className="relative overflow-hidden rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Kategori Dominan
            </span>
            <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
              <Wrench className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-slate-900 truncate">
              {stats.topCategoryName}
            </h3>
            <p className="mt-1 text-xs text-slate-500 font-medium">
              {stats.topCategoryCount} kasus ({stats.topCategoryPercent}%)
            </p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500" />
        </div>
      </div>

      {/* Filter and Search Panel */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4 text-slate-700">
          <SlidersHorizontal className="h-5 w-5 text-slate-500" />
          <h2 className="font-semibold text-base">Panel Filter & Pencarian</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Line Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Line Produksi
            </label>
            <div className="relative">
              <select
                value={selectedLineId}
                onChange={(e) => setSelectedLineId(e.target.value)}
                className="w-full pl-3 pr-8 py-2 text-sm border border-slate-200 bg-slate-50/50 rounded-xl text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none font-medium transition cursor-pointer"
              >
                <option value="all">Semua Line</option>
                {lines.map((line) => (
                  <option key={line.id} value={line.id}>
                    {line.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </div>
          </div>

          {/* Kategori Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Kategori
            </label>
            <div className="relative">
              <select
                value={selectedKategori}
                onChange={(e) => setSelectedKategori(e.target.value)}
                className="w-full pl-3 pr-8 py-2 text-sm border border-slate-200 bg-slate-50/50 rounded-xl text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none font-medium transition cursor-pointer"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </div>
          </div>

          {/* Date Picker Start */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block">
              Tanggal Mulai
            </label>
            <div className="relative flex items-center rounded-xl border border-slate-200 bg-slate-50/50 hover:border-slate-300 transition-colors px-3">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 w-full bg-transparent text-sm text-slate-700 outline-none pr-6 cursor-pointer"
              />
              <Calendar className="pointer-events-none absolute right-3 h-4 w-4 text-slate-400" />
            </div>
          </div>

          {/* Date Picker End */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block">
              Tanggal Akhir
            </label>
            <div className="relative flex items-center rounded-xl border border-slate-200 bg-slate-50/50 hover:border-slate-300 transition-colors px-3">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 w-full bg-transparent text-sm text-slate-700 outline-none pr-6 cursor-pointer"
              />
              <Calendar className="pointer-events-none absolute right-3 h-4 w-4 text-slate-400" />
            </div>
          </div>

          {/* Search Query */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block">
              Pencarian
            </label>
            <div className="relative flex items-center rounded-xl border border-slate-200 bg-slate-50/50 hover:border-slate-300 transition-colors px-3">
              <input
                type="text"
                placeholder="Problem / Penyebab / Stasiun..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 pr-6"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : (
                <Search className="pointer-events-none absolute right-3 h-4 w-4 text-slate-400" />
              )}
            </div>
          </div>
        </div>

        {/* Filter tags & Reset */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <div className="flex flex-wrap items-center gap-2">
            <span>Filter Aktif:</span>
            {selectedLineId !== "all" && (
              <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 font-semibold text-blue-700 border border-blue-100">
                Line: {lines.find((l) => l.id === selectedLineId)?.name || selectedLineId}
              </span>
            )}
            {selectedKategori !== "all" && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 font-semibold text-amber-700 border border-amber-100">
                Kategori: {selectedKategori}
              </span>
            )}
            {startDate && endDate && (
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 font-semibold text-slate-700">
                Periode: {formatDate(startDate)} s/d {formatDate(endDate)}
              </span>
            )}
            {debouncedSearch && (
              <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-1 font-semibold text-purple-700 border border-purple-100">
                Pencarian: &quot;{debouncedSearch}&quot;
              </span>
            )}
            {selectedLineId === "all" && selectedKategori === "all" && !debouncedSearch && (
              <span className="text-slate-400 italic">Hanya rentang tanggal aktif</span>
            )}
          </div>

          <button
            type="button"
            onClick={handleResetFilters}
            className="text-blue-600 hover:text-blue-800 font-semibold cursor-pointer transition"
          >
            Reset Filter
          </button>
        </div>
      </div>

      {/* Main Table Area */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Bulk Action Header Toolbar */}
        {selectedIds.size > 0 && (
          <div className="bg-blue-50 border-b border-blue-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-600 text-white">
                {selectedIds.size}
              </span>
              <span className="text-sm font-semibold text-slate-800">
                Data downtime terpilih
              </span>
              <button
                type="button"
                onClick={handleClearSelection}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium underline cursor-pointer ml-1"
              >
                Batalkan pilihan
              </button>
            </div>
            <Button
              onClick={() => setShowBulkDeleteModal(true)}
              className="h-8 bg-red-600 hover:bg-red-700 text-white text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Hapus {selectedIds.size} Terpilih
            </Button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 select-none">
                <th className="py-4 pl-4 pr-2 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllPageSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isSomePageSelected;
                    }}
                    onChange={toggleSelectPage}
                    aria-label="Pilih semua baris di halaman ini"
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                  />
                </th>
                <th className="py-4 px-4 font-bold text-xs uppercase tracking-wider whitespace-nowrap">Tanggal</th>
                <th className="py-4 px-4 font-bold text-xs uppercase tracking-wider whitespace-nowrap">Line Produksi</th>
                <th className="py-4 px-4 font-bold text-xs uppercase tracking-wider whitespace-nowrap text-center">Stasiun</th>
                <th className="py-4 px-4 font-bold text-xs uppercase tracking-wider whitespace-nowrap">Kategori</th>
                <th className="py-4 px-4 font-bold text-xs uppercase tracking-wider">Problem & Penyebab</th>
                <th className="py-4 px-4 font-bold text-xs uppercase tracking-wider">Countermeasure</th>
                <th className="py-4 px-4 font-bold text-xs uppercase tracking-wider text-center whitespace-nowrap">Mulai - Selesai</th>
                <th className="py-4 px-4 font-bold text-xs uppercase tracking-wider text-right whitespace-nowrap">Durasi</th>
                <th className="py-4 px-4 font-bold text-xs uppercase tracking-wider text-center whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
                      <p className="text-sm font-medium">Memuat data log downtime...</p>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-red-600">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertTriangle className="h-6 w-6 text-red-500" />
                      <p className="text-sm font-semibold">{error}</p>
                      <Button onClick={handleRefresh} variant="outline" className="mt-2 text-xs">
                        Coba Lagi
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : downtimeList.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Clock className="h-8 w-8 text-slate-300" />
                      <p className="text-base font-semibold text-slate-700">Tidak ada data downtime ditemukan</p>
                      <p className="text-xs text-slate-400 max-w-sm">
                        Coba ubah rentang tanggal, filter line, kategori, atau bersihkan kata kunci pencarian.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                downtimeList.map((item) => {
                  const isSelected = selectedIds.has(item.id);
                  const durMinutes = getDurationMinutes(item.waktu_awal, item.waktu_akhir);
                  const lineName = item.line_name || item.mesin || "-";

                  return (
                    <tr
                      key={item.id}
                      onClick={() => toggleSelectRow(item.id)}
                      className={`transition-colors duration-150 group cursor-pointer ${
                        isSelected ? "bg-blue-50/70 hover:bg-blue-50" : "hover:bg-slate-50"
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 pl-4 pr-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => toggleSelectRow(item.id, e)}
                          aria-label={`Pilih downtime ${item.problem}`}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                        />
                      </td>

                      {/* Tanggal */}
                      <td className="py-3.5 px-4 font-medium text-slate-900 whitespace-nowrap">
                        {formatDate(item.waktu_awal)}
                      </td>

                      {/* Line Name */}
                      <td className="py-3.5 px-4 font-semibold text-slate-800 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {lineName}
                        </span>
                      </td>

                      {/* Stasiun */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap font-mono text-xs text-slate-600 font-semibold">
                        {item.stasiun ? (
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            {item.stasiun}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Kategori Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border uppercase tracking-wide ${getCategoryBadgeClass(
                            item.kategori
                          )}`}
                        >
                          {item.kategori || "OTHER"}
                        </span>
                      </td>

                      {/* Problem & Penyebab */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-semibold text-slate-900 line-clamp-1" title={item.problem || ""}>
                          {item.problem || "-"}
                        </div>
                        {item.penyebab && (
                          <div className="text-xs text-slate-500 line-clamp-1 mt-0.5" title={item.penyebab}>
                            Penyebab: {item.penyebab}
                          </div>
                        )}
                      </td>

                      {/* Countermeasure */}
                      <td className="py-3.5 px-4 max-w-xs text-xs text-slate-600">
                        {item.countermeasure ? (
                          <span className="line-clamp-2" title={item.countermeasure}>
                            {item.countermeasure}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">-</span>
                        )}
                      </td>

                      {/* Mulai - Selesai */}
                      <td className="py-3.5 px-4 text-center text-slate-600 whitespace-nowrap font-medium text-xs font-mono">
                        {formatTime(item.waktu_awal)} - {formatTime(item.waktu_akhir)}
                      </td>

                      {/* Durasi */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <span
                          className={`font-bold text-xs px-2 py-1 rounded ${
                            durMinutes >= 60
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : durMinutes >= 15
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}
                        >
                          {durMinutes} m
                        </span>
                      </td>

                      {/* Aksi */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => openDetail(item)}
                            className="inline-flex items-center justify-center h-8 w-8 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                            title="Lihat Detail"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            className="inline-flex items-center justify-center h-8 w-8 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition cursor-pointer"
                            title="Edit Downtime"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openDeleteModal(item)}
                            className="inline-flex items-center justify-center h-8 w-8 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                            title="Hapus Downtime"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-slate-200 bg-slate-50 text-slate-600 text-xs">
          <div className="flex items-center gap-2">
            <span>Baris per halaman:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-200 rounded px-2 py-1 outline-none font-medium cursor-pointer"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="ml-2 text-slate-500">
              Menampilkan {startIndex} - {endIndex} dari {totalCount} data downtime
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 bg-white border-slate-200 disabled:opacity-40"
              onClick={() => setCurrentPage(1)}
              disabled={safeCurrentPage <= 1}
              title="Halaman Pertama"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 bg-white border-slate-200 disabled:opacity-40"
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={safeCurrentPage <= 1}
              title="Sebelumnya"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <span className="px-3 py-1 font-semibold text-slate-700">
              {safeCurrentPage} / {totalPages}
            </span>

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 bg-white border-slate-200 disabled:opacity-40"
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={safeCurrentPage >= totalPages}
              title="Berikutnya"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 bg-white border-slate-200 disabled:opacity-40"
              onClick={() => setCurrentPage(totalPages)}
              disabled={safeCurrentPage >= totalPages}
              title="Halaman Terakhir"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Modal Detail Downtime */}
      {detailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border uppercase tracking-wide mb-2 ${getCategoryBadgeClass(
                    detailItem.kategori
                  )}`}
                >
                  {detailItem.kategori || "OTHER"}
                </span>
                <h3 className="text-lg font-bold text-slate-900">
                  Detail Catatan Downtime
                </h3>
              </div>
              <button
                type="button"
                onClick={closeDetail}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-sm max-h-[75vh] overflow-y-auto">
              {/* Duration Banner */}
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
                    Total Durasi Downtime
                  </p>
                  <p className="text-2xl font-black text-amber-900 mt-0.5">
                    {getDurationMinutes(detailItem.waktu_awal, detailItem.waktu_akhir)} Menit
                  </p>
                </div>
                <div className="text-right text-xs text-amber-800 font-medium">
                  ≈ {(getDurationMinutes(detailItem.waktu_awal, detailItem.waktu_akhir) / 60).toFixed(1)} Jam
                </div>
              </div>

              {/* Grid Info */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-400 block font-bold uppercase">Tanggal</span>
                  <span className="font-semibold text-slate-800 text-sm mt-0.5 block">
                    {formatDate(detailItem.waktu_awal)}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-400 block font-bold uppercase">Line / Mesin</span>
                  <span className="font-semibold text-slate-800 text-sm mt-0.5 block">
                    {detailItem.line_name || detailItem.mesin || "-"}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-400 block font-bold uppercase">Waktu Mulai</span>
                  <span className="font-semibold text-slate-800 text-sm mt-0.5 block font-mono">
                    {formatTime(detailItem.waktu_awal)}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-400 block font-bold uppercase">Waktu Selesai</span>
                  <span className="font-semibold text-slate-800 text-sm mt-0.5 block font-mono">
                    {formatTime(detailItem.waktu_akhir)}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg col-span-2">
                  <span className="text-slate-400 block font-bold uppercase">Stasiun / Mesin</span>
                  <span className="font-semibold text-slate-800 text-sm mt-0.5 block font-mono">
                    {detailItem.stasiun || "-"}
                  </span>
                </div>
              </div>

              {/* Problem Description */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Problem / Gejala
                </label>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-800 font-medium">
                  {detailItem.problem || "-"}
                </div>
              </div>

              {/* Penyebab */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Penyebab (Root Cause)
                </label>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-800 font-medium">
                  {detailItem.penyebab || "-"}
                </div>
              </div>

              {/* Countermeasure */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Tindakan Perbaikan (Countermeasure)
                </label>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-800 font-medium">
                  {detailItem.countermeasure || "-"}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={handleCopyDetail}
                className="gap-1.5 text-xs font-semibold cursor-pointer"
              >
                {isCopied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                {isCopied ? "Tersalin!" : "Salin Detail"}
              </Button>
              <Button
                type="button"
                onClick={closeDetail}
                className="bg-slate-800 hover:bg-slate-900 text-white text-xs px-5 cursor-pointer"
              >
                Tutup
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Form (Create / Edit) */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Form Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {isEditing ? "Edit Catatan Downtime" : "Tambah Catatan Downtime Baru"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pastikan waktu mulai dan waktu selesai diinput sesuai kejadian aktual di mesin.
                </p>
              </div>
              <button
                type="button"
                onClick={closeFormModal}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form Content */}
            <form onSubmit={handleSaveForm} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-700 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Line Selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    Line Produksi <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={formData.line_id}
                      onChange={(e) => {
                        const lId = e.target.value;
                        const matched = lines.find((l) => l.id === lId);
                        setFormData((prev) => ({
                          ...prev,
                          line_id: lId,
                          mesin: matched?.machine_type || prev.mesin,
                        }));
                      }}
                      className="w-full pl-3 pr-8 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50/50 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium transition cursor-pointer"
                    >
                      <option value="">Pilih Line Produksi</option>
                      {lines.map((line) => (
                        <option key={line.id} value={line.id}>
                          {line.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  </div>
                </div>

                {/* Stasiun */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    Stasiun / Mesin
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: OP10, Mesin 1, dll"
                    value={formData.stasiun}
                    onChange={(e) => setFormData((p) => ({ ...p, stasiun: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50/50 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium transition"
                  />
                </div>

                {/* Kategori */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    Kategori Downtime <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={formData.kategori}
                      onChange={(e) => setFormData((p) => ({ ...p, kategori: e.target.value }))}
                      className="w-full pl-3 pr-8 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50/50 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium transition cursor-pointer"
                    >
                      {FORM_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  </div>
                </div>

                {/* Waktu Mulai */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    Waktu Mulai <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.waktu_awal}
                    onChange={(e) => setFormData((p) => ({ ...p, waktu_awal: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50/50 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium transition cursor-pointer"
                  />
                </div>

                {/* Waktu Selesai */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    Waktu Selesai <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.waktu_akhir}
                    onChange={(e) => setFormData((p) => ({ ...p, waktu_akhir: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50/50 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium transition cursor-pointer"
                  />
                </div>

                {/* Preview Durasi */}
                <div className="flex flex-col justify-end">
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs flex items-center justify-between">
                    <span className="font-semibold text-slate-500">Estimasi Durasi:</span>
                    <span className="font-black text-slate-900">
                      {getDurationMinutes(formData.waktu_awal, formData.waktu_akhir)} Menit
                    </span>
                  </div>
                </div>
              </div>

              {/* Problem */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Deskripsi Problem <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  list="problem-suggestions"
                  placeholder="Deskripsikan problem yang terjadi..."
                  value={formData.problem}
                  onChange={(e) => setFormData((p) => ({ ...p, problem: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50/50 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium transition"
                />
                <datalist id="problem-suggestions">
                  {problemSuggestions.map((ps) => (
                    <option key={ps} value={ps} />
                  ))}
                </datalist>
              </div>

              {/* Penyebab */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Penyebab (Root Cause)
                </label>
                <textarea
                  rows={2}
                  placeholder="Penyebab akar masalah..."
                  value={formData.penyebab}
                  onChange={(e) => setFormData((p) => ({ ...p, penyebab: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50/50 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium transition"
                />
              </div>

              {/* Countermeasure */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  Tindakan Perbaikan (Countermeasure)
                </label>
                <textarea
                  rows={2}
                  placeholder="Tindakan penanganan yang dilakukan..."
                  value={formData.countermeasure}
                  onChange={(e) => setFormData((p) => ({ ...p, countermeasure: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50/50 text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium transition"
                />
              </div>

              {/* Form Buttons */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeFormModal}
                  disabled={isSavingForm}
                  className="cursor-pointer text-xs"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={isSavingForm}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-5 cursor-pointer flex items-center gap-2"
                >
                  {isSavingForm && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  {isSavingForm ? "Menyimpan..." : isEditing ? "Simpan Perubahan" : "Tambah Downtime"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Single Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Hapus Catatan Downtime?</h3>
                <p className="text-xs text-slate-500">Tindakan ini akan menghapus catatan dari daftar aktif.</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1 mb-5">
              <p>
                <span className="font-semibold text-slate-500">Line:</span>{" "}
                <span className="font-bold text-slate-800">{deleteTarget.line_name || deleteTarget.mesin}</span>
              </p>
              <p>
                <span className="font-semibold text-slate-500">Problem:</span>{" "}
                <span className="font-bold text-slate-800">{deleteTarget.problem || "-"}</span>
              </p>
              <p>
                <span className="font-semibold text-slate-500">Waktu:</span>{" "}
                <span className="font-mono text-slate-700">
                  {formatDate(deleteTarget.waktu_awal)} ({formatTime(deleteTarget.waktu_awal)} -{" "}
                  {formatTime(deleteTarget.waktu_akhir)})
                </span>
              </p>
            </div>

            <div className="flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={closeDeleteModal}
                disabled={isDeletingSingle}
                className="text-xs cursor-pointer"
              >
                Batal
              </Button>
              <Button
                type="button"
                onClick={handleConfirmSingleDelete}
                disabled={isDeletingSingle}
                className="bg-red-600 hover:bg-red-700 text-white text-xs cursor-pointer flex items-center gap-1.5"
              >
                {isDeletingSingle && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                {isDeletingSingle ? "Menghapus..." : "Ya, Hapus Sekarang"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Bulk Delete Confirmation */}
      {showBulkDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <Trash2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Hapus {selectedIds.size} Data Downtime Terpilih?
                </h3>
                <p className="text-xs text-slate-500">
                  Semua data downtime yang dipilih akan dihapus secara bersamaan.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-5">
              Apakah Anda yakin ingin menghapus <b>{selectedIds.size}</b> catatan downtime yang telah Anda pilih?
            </p>

            <div className="flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowBulkDeleteModal(false)}
                disabled={isBulkDeleting}
                className="text-xs cursor-pointer"
              >
                Batal
              </Button>
              <Button
                type="button"
                onClick={handleConfirmBulkDelete}
                disabled={isBulkDeleting}
                className="bg-red-600 hover:bg-red-700 text-white text-xs cursor-pointer flex items-center gap-1.5"
              >
                {isBulkDeleting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                {isBulkDeleting ? "Menghapus..." : `Ya, Hapus ${selectedIds.size} Data`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
