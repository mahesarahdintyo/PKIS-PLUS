"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Calendar,
  Coffee,
  Download,
  Filter,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  AlertTriangle,
  X,
  Layers,
  ChevronDown,
  Eye,
  Copy,
  Check,
} from "lucide-react";
import { getLands, type Land } from "@/lib/services/land";
import {
  getProductionReports,
  deleteProductionReport,
  type ProductionReport,
} from "@/lib/services/production-report";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const PRODUCTION_REPORT_REFRESH_INTERVAL_MS = 3000;

export default function ProductionReportsDashboard() {
  const [reports, setReports] = useState<ProductionReport[]>([]);
  const [lands, setLands] = useState<Land[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters state
  const [selectedLandId, setSelectedLandId] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedShift, setSelectedShift] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal Delete state
  const [deleteTarget, setDeleteTarget] = useState<ProductionReport | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteClosing, setIsDeleteClosing] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const closeDeleteModal = () => {
    if (!deleteTarget || isDeleteClosing) return;
    setIsDeleteClosing(true);
    setTimeout(() => {
      setDeleteTarget(null);
      setIsDeleteClosing(false);
    }, 200);
  };

  // Modal Detail state
  const [detailReport, setDetailReport] = useState<ProductionReport | null>(null);
  const [isDetailClosing, setIsDetailClosing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const reportsRequestIdRef = useRef(0);

  const closeDetailModal = () => {
    if (!detailReport || isDetailClosing) return;
    setIsDetailClosing(true);
    setTimeout(() => {
      setDetailReport(null);
      setIsDetailClosing(false);
    }, 200);
  };

  const loadReports = useCallback(
    async ({ showLoading = true }: { showLoading?: boolean } = {}) => {
      const requestId = reportsRequestIdRef.current + 1;
      reportsRequestIdRef.current = requestId;

      try {
        if (showLoading) {
          setIsLoading(true);
        }
        setError("");

        const query = {
          landId: selectedLandId !== "all" ? selectedLandId : undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        };
        const reportsData = await getProductionReports(query);

        if (reportsRequestIdRef.current !== requestId) return;
        setReports(reportsData);
      } catch (err) {
        if (reportsRequestIdRef.current !== requestId) return;
        setError(err instanceof Error ? err.message : "Gagal memperbarui data");
        console.error(err);
      } finally {
        if (reportsRequestIdRef.current === requestId && showLoading) {
          setIsLoading(false);
        }
      }
    },
    [endDate, selectedLandId, startDate]
  );

  // Load lands once for the filter options
  useEffect(() => {
    async function loadLands() {
      try {
        const landsData = await getLands({ includeHidden: true });
        setLands(landsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat data line");
        console.error(err);
      }
    }

    void loadLands();
  }, []);

  const handleRefresh = () => {
    void loadReports();
  };

  // Trigger refresh when database filters change
  useEffect(() => {
    const delayDebounce = window.setTimeout(() => {
      void loadReports();
    }, 100);
    return () => window.clearTimeout(delayDebounce);
  }, [loadReports]);

  useEffect(() => {
    const supabase = createClient();

    const refreshReports = () => {
      void loadReports({ showLoading: false });
    };

    const channel = supabase
      .channel("admin-production-reports")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "production_reports" },
        refreshReports
      )
      .subscribe();

    const intervalId = window.setInterval(() => {
      void loadReports({ showLoading: false });
    }, PRODUCTION_REPORT_REFRESH_INTERVAL_MS);

    window.addEventListener("focus", refreshReports);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshReports);
      void supabase.removeChannel(channel);
    };
  }, [loadReports]);

  const handleResetFilters = () => {
    setSelectedLandId("all");
    setStartDate("");
    setEndDate("");
    setSelectedShift("all");
    setSearchQuery("");
  };

  // Client-side filtering for shift and search query
  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      // Shift filter
      if (selectedShift !== "all" && report.shift !== selectedShift) {
        return false;
      }

      // Text search (operator_name or part_number)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesOperator = report.operator_name.toLowerCase().includes(query);
        const matchesPartNumber = report.part_number.toLowerCase().includes(query);
        const matchesLandName = (report.land?.name ?? "").toLowerCase().includes(query);
        if (!matchesOperator && !matchesPartNumber && !matchesLandName) {
          return false;
        }
      }

      return true;
    });
  }, [reports, selectedShift, searchQuery]);

  // Aggregate statistics calculation
  const stats = useMemo(() => {
    let totalQty = 0;
    let totalNgQty = 0;
    let totalBreak = 0;
    const uniqueLines = new Set<string>();

    filteredReports.forEach((report) => {
      totalQty += report.qty;
      totalNgQty += report.ng_qty;
      totalBreak += report.break_minutes;
      uniqueLines.add(report.land_id);
    });

    const totalOkQty = totalQty - totalNgQty;
    const avgNgRate = totalQty > 0 ? (totalNgQty / totalQty) * 100 : 0;

    return {
      totalQty,
      totalOkQty,
      totalNgQty,
      avgNgRate,
      totalBreak,
      activeLinesCount: uniqueLines.size,
    };
  }, [filteredReports]);

  // CSV Export utility
  const handleExportCSV = () => {
    if (filteredReports.length === 0) return;

    const headers = [
      "Tanggal",
      "Line/Card",
      "Operator",
      "Shift",
      "Part Number",
      "Mulai",
      "Selesai",
      "Istirahat (Menit)",
      "QTY Total",
      "QTY OK",
      "QTY NG",
      "NG Rate (%)",
    ];

    const csvRows = [headers.join(",")];

    filteredReports.forEach((report) => {
      const okQty = report.qty - report.ng_qty;
      const ngRate = report.qty > 0 ? ((report.ng_qty / report.qty) * 100).toFixed(1) : "0.0";
      const landName = report.land?.name ?? "Unknown Line";

      const values = [
        report.report_date,
        landName,
        report.operator_name,
        report.shift,
        report.part_number,
        report.start_time,
        report.end_time,
        report.break_minutes,
        report.qty,
        okQty,
        report.ng_qty,
        `${ngRate}%`,
      ].map((val) => {
        const escaped = ("" + val).replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(","));
    });

    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `Laporan_Produksi_Futaba_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Delete Action
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      setDeleteError("");
      await deleteProductionReport(deleteTarget.id);

      // Update UI state local
      setReports((prev) => prev.filter((r) => r.id !== deleteTarget.id));
      closeDeleteModal();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Gagal menghapus laporan");
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper formatting time
  const formatTime = (timeStr: string) => {
    if (!timeStr) return "-";
    // HH:MM:SS -> HH:MM
    const parts = timeStr.split(":");
    if (parts.length >= 2) {
      return `${parts[0]}:${parts[1]}`;
    }
    return timeStr;
  };

  // Helper formatting date to standard dd/mm/yyyy
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-";
    const [year, month, day] = dateStr.split("-");
    if (year && month && day) {
      return `${day}/${month}/${year}`;
    }
    return dateStr;
  };

  // Helper formatting date to Indonesian representation (e.g. 09 Juli 2026)
  const formatDateIndo = (dateStr: string) => {
    if (!dateStr) return "-";
    const [year, month, day] = dateStr.split("-");
    if (!year || !month || !day) return dateStr;

    const months = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni",
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];

    const monthIndex = parseInt(month, 10) - 1;
    const monthName = months[monthIndex] ?? month;

    return `${day} ${monthName} ${year}`;
  };

  // Copy helper with fallback for non-secure HTTP contexts (e.g. network IP)
  const copyToClipboard = async (text: string): Promise<boolean> => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // fallback if clipboard API fails
    }

    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      console.error("Fallback copy failed", err);
      return false;
    }
  };

  // Copy receipt text to clipboard
  const handleCopyDetail = async () => {
    if (!detailReport) return;
    const landName = detailReport.land?.name ?? "Unknown Line";
    const breakMin = detailReport.break_minutes > 0 ? `${detailReport.break_minutes} Menit` : "-";
    const ngCat = detailReport.ng_category ?? "-";

    const text = `===================================
LAPORAN PRODUKSI
-----------------------------------
Tanggal: ${formatDateIndo(detailReport.report_date)}
Operator: ${detailReport.operator_name}
Line: ${landName}
Shift: ${detailReport.shift}
Part Number: ${detailReport.part_number}
Qty Total: ${detailReport.qty}
Qty OK: ${detailReport.qty - detailReport.ng_qty}
Qty NG: ${detailReport.ng_qty}
Kategori NG: ${ngCat}
Jam Awal: ${formatTime(detailReport.start_time)}
Jam Akhir: ${formatTime(detailReport.end_time)}
Istirahat: ${breakMin}
===================================`;

    const success = await copyToClipboard(text);
    if (success) {
      setIsCopied(true);
      toast.success("Detail laporan berhasil disalin ke clipboard!");
      setTimeout(() => setIsCopied(false), 2000);
    } else {
      toast.error("Gagal menyalin detail laporan");
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Top Banner & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Daftar Laporan Produksi
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Lihat, filter, dan unduh laporan produksi yang disubmit oleh operator di lapangan secara real-time.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleRefresh}
            variant="outline"
            className="h-10 border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2 cursor-pointer dark:bg-white dark:text-slate-700 dark:hover:bg-slate-50 dark:border-slate-300"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Perbarui
          </Button>
          <Button
            onClick={handleExportCSV}
            disabled={filteredReports.length === 0}
            className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-2 cursor-pointer"
          >
            <Download className="h-4 w-4" />
            Ekspor CSV
          </Button>
        </div>
      </div>

      {/* KPI Stats Cards - Rich Aesthetics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total QTY Card */}
        <div className="relative overflow-hidden rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">
              Total Produksi
            </span>
            <div className="rounded-lg bg-blue-100 p-2 text-blue-600">
              <Activity className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-bold text-slate-900">{stats.totalQty}</h3>
            <p className="mt-1 text-xs text-slate-500 font-medium">QTY Total terhitung</p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500" />
        </div>

        {/* OK QTY Card */}
        <div className="relative overflow-hidden rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
              Total QTY OK
            </span>
            <div className="rounded-lg bg-emerald-100 p-2 text-emerald-600">
              <Activity className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-bold text-slate-900">{stats.totalOkQty}</h3>
            <p className="mt-1 text-xs text-emerald-600 font-semibold">
              {stats.totalQty > 0
                ? `${((stats.totalOkQty / stats.totalQty) * 100).toFixed(1)}% dari total`
                : "100% dari total"}
            </p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500" />
        </div>

        {/* NG QTY Card */}
        <div className="relative overflow-hidden rounded-xl border border-rose-100 bg-gradient-to-br from-rose-50 to-white p-5 shadow-sm transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-600">
              Total QTY NG
            </span>
            <div className="rounded-lg bg-rose-100 p-2 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-bold text-slate-900">{stats.totalNgQty}</h3>
            <p className="mt-1 text-xs text-rose-600 font-semibold">
              Rata-rata Rate: {stats.avgNgRate.toFixed(1)}%
            </p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-rose-500" />
        </div>

        {/* Break Duration Card */}
        <div className="relative overflow-hidden rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-600">
              Total Istirahat
            </span>
            <div className="rounded-lg bg-amber-100 p-2 text-amber-600">
              <Coffee className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-bold text-slate-900">{stats.totalBreak} m</h3>
            <p className="mt-1 text-xs text-slate-500 font-medium">Dalam satuan menit</p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500" />
        </div>

        {/* Active Lines Card */}
        <div className="relative overflow-hidden rounded-xl border border-purple-100 bg-gradient-to-br from-purple-50 to-white p-5 shadow-sm transition-all duration-200 hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-purple-600">
              Line Aktif
            </span>
            <div className="rounded-lg bg-purple-100 p-2 text-purple-600">
              <Layers className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-bold text-slate-900">{stats.activeLinesCount}</h3>
            <p className="mt-1 text-xs text-slate-500 font-medium">Card/Line beraktivitas</p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-purple-500" />
        </div>
      </div>

      {/* Filter and Search Panel */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4 text-slate-700">
          <SlidersHorizontal className="h-5 w-5 text-slate-500" />
          <h2 className="font-semibold text-base">Panel Filter & Pencarian</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          {/* Land Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Line (Card)
            </label>
            <div className="relative rounded border border-slate-300 bg-white hover:border-slate-400 transition-colors duration-200">
              <select
                value={selectedLandId}
                onChange={(e) => setSelectedLandId(e.target.value)}
                className="h-10 w-full appearance-none bg-transparent px-3 pr-9 text-sm font-medium text-slate-700 outline-none"
              >
                <option value="all">Semua Line</option>
                {lands.map((land) => (
                  <option key={land.id} value={land.id}>
                    {land.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </div>
          </div>

          {/* Shift Selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Shift
            </label>
            <div className="relative rounded border border-slate-300 bg-white hover:border-slate-400 transition-colors duration-200">
              <select
                value={selectedShift}
                onChange={(e) => setSelectedShift(e.target.value)}
                className="h-10 w-full appearance-none bg-transparent px-3 pr-9 text-sm font-medium text-slate-700 outline-none"
              >
                <option value="all">Semua Shift</option>
                <option value="Shift 1">Shift 1</option>
                <option value="Shift 2">Shift 2</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </div>
          </div>

          {/* Date Picker Start */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Tanggal Mulai
            </label>
            <div className="relative flex items-center rounded border border-slate-300 bg-white hover:border-slate-400 transition-colors duration-200 px-3">
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
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Tanggal Akhir
            </label>
            <div className="relative flex items-center rounded border border-slate-300 bg-white hover:border-slate-400 transition-colors duration-200 px-3">
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
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
              Pencarian
            </label>
            <div className="relative flex items-center rounded border border-slate-300 bg-white hover:border-slate-400 transition-colors duration-200 px-3">
              <input
                type="text"
                placeholder="Operator / Part Number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full bg-transparent text-sm text-slate-700 outline-none pr-6"
              />
              <Search className="pointer-events-none absolute right-3 h-4 w-4 text-slate-400" />
            </div>
          </div>
        </div>

        {/* Clear filter and status count */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-slate-100">
          <p className="text-xs font-medium text-slate-500">
            Menampilkan <span className="font-semibold text-slate-800">{filteredReports.length}</span> laporan produksi.
          </p>
          {(selectedLandId !== "all" || startDate || endDate || selectedShift !== "all" || searchQuery) && (
            <button
              onClick={handleResetFilters}
              className="text-xs font-semibold text-red-600 hover:text-red-700 hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-0 self-start sm:self-center"
            >
              Reset Semua Filter
            </button>
          )}
        </div>
      </div>

      {/* Main Table Card */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {error && (
          <div className="m-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isLoading ? (
          <div className="py-20 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600"></div>
            <p className="mt-4 text-sm text-slate-500 font-medium">Memuat laporan produksi...</p>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="py-20 text-center px-4">
            <div className="mx-auto h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center border border-slate-200">
              <Filter className="h-5 w-5 text-slate-400" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-slate-900">Tidak ada laporan produksi</h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
              Tidak ada data laporan yang cocok dengan kriteria filter saat ini. Ubah filter atau tunggu operator menyubmit laporan baru.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 select-none">
                  <th className="py-4 px-4 font-bold text-xs uppercase tracking-wider">Tanggal</th>
                  <th className="py-4 px-4 font-bold text-xs uppercase tracking-wider">Line/Card</th>
                  <th className="py-4 px-4 font-bold text-xs uppercase tracking-wider">Operator</th>
                  <th className="py-4 px-4 font-bold text-xs uppercase tracking-wider">Shift</th>
                  <th className="py-4 px-4 font-bold text-xs uppercase tracking-wider">Part Number</th>
                  <th className="py-4 px-4 font-bold text-xs uppercase tracking-wider text-center">Mulai - Selesai</th>
                  <th className="py-4 px-4 font-bold text-xs uppercase tracking-wider text-center">Istirahat</th>
                  <th className="py-4 px-4 font-bold text-xs uppercase tracking-wider text-right">QTY OK</th>
                  <th className="py-4 px-4 font-bold text-xs uppercase tracking-wider text-right">QTY NG</th>
                  <th className="py-4 px-4 font-bold text-xs uppercase tracking-wider text-right">NG Rate</th>
                  <th className="py-4 px-4 font-bold text-xs uppercase tracking-wider text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReports.map((report, index) => {
                  const okQty = report.qty - report.ng_qty;
                  const ngRate = report.qty > 0 ? (report.ng_qty / report.qty) * 100 : 0;
                  const isNgHigh = report.ng_qty > 0;

                  return (
                    <tr
                      key={report.id}
                      className="hover:bg-slate-50 transition-colors duration-200 group animate-in fade-in slide-in-from-bottom-1 duration-300 fill-mode-backwards"
                      style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
                    >
                      {/* Tanggal */}
                      <td className="py-3.5 px-4 font-medium text-slate-900 whitespace-nowrap">
                        {formatDate(report.report_date)}
                      </td>

                      {/* Line Name */}
                      <td className="py-3.5 px-4 font-semibold text-slate-700 whitespace-nowrap">
                        {report.land?.name ?? "Unknown Line"}
                      </td>

                      {/* Operator Name */}
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        {report.operator_name}
                      </td>

                      {/* Shift */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ${report.shift === "Shift 1"
                            ? "bg-sky-50 text-sky-700 border border-sky-100"
                            : "bg-indigo-50 text-indigo-700 border border-indigo-100"
                            }`}
                        >
                          {report.shift}
                        </span>
                      </td>

                      {/* Part Number */}
                      <td className="py-3.5 px-4 font-semibold text-slate-800 whitespace-nowrap font-mono">
                        {report.part_number}
                      </td>

                      {/* Mulai - Selesai */}
                      <td className="py-3.5 px-4 text-center text-slate-600 whitespace-nowrap font-medium">
                        {formatTime(report.start_time)} - {formatTime(report.end_time)}
                      </td>

                      {/* Istirahat */}
                      <td className="py-3.5 px-4 text-center text-slate-600 whitespace-nowrap font-medium">
                        {report.break_minutes > 0 ? `${report.break_minutes} m` : "-"}
                      </td>

                      {/* QTY OK */}
                      <td className="py-3.5 px-4 text-right text-slate-800 font-bold whitespace-nowrap">
                        {okQty}
                      </td>

                      {/* QTY NG */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <span
                          className={`font-bold ${isNgHigh ? "text-red-600 bg-red-50 border border-red-100 rounded px-1.5 py-0.5" : "text-slate-500"
                            }`}
                        >
                          {report.ng_qty}
                        </span>
                      </td>

                      {/* NG Rate */}
                      <td className="py-3.5 px-4 text-right font-semibold whitespace-nowrap">
                        <span
                          className={`${isNgHigh
                            ? ngRate > 5
                              ? "text-red-700"
                              : "text-amber-700"
                            : "text-slate-400 font-normal"
                            }`}
                        >
                          {ngRate.toFixed(1)}%
                        </span>
                      </td>

                      {/* Aksi Detail & Hapus */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDetailReport(report)}
                            className="inline-flex items-center justify-center h-8 w-8 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors duration-200 cursor-pointer"
                            title="Lihat Detail"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(report)}
                            className="inline-flex items-center justify-center h-8 w-8 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors duration-200 cursor-pointer"
                            title="Hapus Laporan"
                          >
                            <Trash2 className="h-4 w-4" />
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

      {/* Detail Laporan Modal (Modern Light Theme Modal) */}
      {detailReport && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs ${
            isDetailClosing
              ? "animate-out fade-out duration-200 [animation-fill-mode:forwards]"
              : "animate-in fade-in duration-200"
          }`}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeDetailModal();
          }}
        >
          <div
            className={`relative w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 select-text overflow-hidden text-slate-800 ${
              isDetailClosing
                ? "animate-out fade-out zoom-out-95 duration-200 [animation-fill-mode:forwards]"
                : "animate-in fade-in zoom-in-95 duration-200"
            }`}
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Detail Laporan Produksi</h3>
                  <p className="text-xs text-slate-500">Informasi lengkap laporan yang diisi oleh operator.</p>
                </div>
              </div>
              <button
                onClick={closeDetailModal}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors duration-200 cursor-pointer"
                aria-label="Tutup"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Grid Content */}
            <div className="py-5 space-y-6">

              {/* Section 1: Informasi Umum */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none">Tanggal</span>
                  <div className="text-sm font-semibold text-slate-800 mt-1">{formatDateIndo(detailReport.report_date)}</div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none">Operator</span>
                  <div className="text-sm font-semibold text-slate-800 mt-1">{detailReport.operator_name}</div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none">Line (Card)</span>
                  <div className="text-sm font-semibold text-slate-800 mt-1">{detailReport.land?.name ?? "Unknown Line"}</div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none">Shift</span>
                  <div className="mt-1">
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${detailReport.shift === "Shift 1"
                      ? "bg-sky-50 text-sky-700 border border-sky-100"
                      : "bg-indigo-50 text-indigo-700 border border-indigo-100"
                      }`}>
                      {detailReport.shift}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 2: Hasil Produksi */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider select-none">Hasil Produksi & Kualitas</h4>

                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-sm text-slate-600 font-medium">Part Number</span>
                  <span className="text-sm font-bold text-slate-800 font-mono">{detailReport.part_number}</span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-blue-50/30 border border-blue-100/50 rounded-xl p-3 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none">Total Qty</span>
                    <div className="text-xl font-bold text-blue-700 mt-1">{detailReport.qty}</div>
                  </div>
                  <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none">Qty OK</span>
                    <div className="text-xl font-bold text-emerald-700 mt-1">{detailReport.qty - detailReport.ng_qty}</div>
                  </div>
                  <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-3 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none">Qty NG</span>
                    <div className="text-xl font-bold text-rose-700 mt-1">{detailReport.ng_qty}</div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-b border-slate-100 pb-2 pt-2">
                  <span className="text-sm text-slate-600 font-medium">NG Rate / Persentase Cacat</span>
                  <span className={`text-sm font-bold ${detailReport.ng_qty > 0 ? "text-rose-600" : "text-slate-800"}`}>
                    {(detailReport.qty > 0 ? (detailReport.ng_qty / detailReport.qty) * 100 : 0).toFixed(1)}%
                  </span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-sm text-slate-600 font-medium">Kategori NG</span>
                  <span className="text-sm font-bold text-slate-800">{detailReport.ng_category ?? "-"}</span>
                </div>
              </div>

              {/* Section 3: Waktu Kerja */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider select-none">Waktu & Efisiensi</h4>
                <div className="grid grid-cols-3 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none">Jam Awal</span>
                    <div className="text-sm font-semibold text-slate-800 mt-1">{formatTime(detailReport.start_time)}</div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none">Jam Akhir</span>
                    <div className="text-sm font-semibold text-slate-800 mt-1">{formatTime(detailReport.end_time)}</div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider select-none">Istirahat</span>
                    <div className="text-sm font-semibold text-slate-800 mt-1">
                      {detailReport.break_minutes > 0 ? `${detailReport.break_minutes} Menit` : "-"}
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* Footer Actions */}
            <div className="border-t border-slate-100 pt-4 flex gap-3">
              <button
                type="button"
                onClick={handleCopyDetail}
                className="flex-1 h-10 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition duration-200 cursor-pointer flex items-center justify-center gap-2"
              >
                {isCopied ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-600" />
                    <span className="text-emerald-600">Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>Salin Laporan</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={closeDetailModal}
                className="flex-1 h-10 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition duration-200 cursor-pointer text-center"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs ${
            isDeleteClosing
              ? "animate-out fade-out duration-200 [animation-fill-mode:forwards]"
              : "animate-in fade-in duration-200"
          }`}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) closeDeleteModal();
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
              onClick={closeDeleteModal}
              className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors duration-200"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-50 border border-red-100 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900">Hapus Laporan Produksi</h3>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                  Apakah Anda yakin ingin menghapus laporan produksi dari operator{" "}
                  <span className="font-semibold text-slate-800">
                    {deleteTarget.operator_name}
                  </span>{" "}
                  untuk part number{" "}
                  <span className="font-semibold text-slate-800">
                    {deleteTarget.part_number}
                  </span>{" "}
                  pada tanggal {formatDate(deleteTarget.report_date)}?
                </p>
                <p className="mt-1 text-xs text-red-500 font-medium">
                  Tindakan ini permanen dan tidak dapat dibatalkan.
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
                onClick={closeDeleteModal}
                className="h-10 bg-slate-500 hover:bg-slate-600 text-white font-semibold flex items-center justify-center cursor-pointer"
              >
                Batal
              </Button>
              <Button
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="h-10 bg-red-600 hover:bg-red-700 text-white font-semibold flex items-center justify-center cursor-pointer"
              >
                {isDeleting ? "Menghapus..." : "Ya, Hapus"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
