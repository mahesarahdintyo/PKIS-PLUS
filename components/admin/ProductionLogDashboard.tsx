"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Calendar,
  ChevronDown,
  Download,
  Filter,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { getLines, type Line } from "@/lib/services/line";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const LOG_REFRESH_INTERVAL_MS = 5000;

interface ProdLog {
  id: string;
  line_id: string | null;
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
  is_active: boolean;
  line?: { name: string } | null;
}

interface EditForm {
  part_number: string;
  qty: string;
  ng: string;
  manpower: string;
  waktu_awal: string;
  waktu_akhir: string;
  dandori_menit: string;
  downtime_menit: string;
  break_menit: string;
}

interface CreateForm extends EditForm {
  line_id: string;
}

const emptyEdit = (): EditForm => ({
  part_number: "",
  qty: "",
  ng: "",
  manpower: "",
  waktu_awal: "",
  waktu_akhir: "",
  dandori_menit: "",
  downtime_menit: "",
  break_menit: "",
});

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
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

function EditFields({
  form,
  partOptions,
  onChange,
}: {
  form: EditForm;
  partOptions: string[];
  onChange: (f: Partial<EditForm>) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <Field label="Part Number">
          <input
            list="part-options-list"
            value={form.part_number}
            onChange={(e) => onChange({ part_number: e.target.value })}
            placeholder="Pilih atau ketik part number..."
            className={inputCls}
          />
          <datalist id="part-options-list">
            {partOptions.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </Field>
      </div>
      <Field label="Waktu Mulai *">
        <input
          type="datetime-local"
          value={form.waktu_awal}
          onChange={(e) => onChange({ waktu_awal: e.target.value })}
          className={inputCls}
        />
      </Field>
      <Field label="Waktu Selesai">
        <input
          type="datetime-local"
          value={form.waktu_akhir}
          onChange={(e) => onChange({ waktu_akhir: e.target.value })}
          className={inputCls}
        />
      </Field>
      <Field label="QTY">
        <input
          type="number"
          min={0}
          value={form.qty}
          onChange={(e) => onChange({ qty: e.target.value })}
          className={inputCls}
          placeholder="0"
        />
      </Field>
      <Field label="NG">
        <input
          type="number"
          min={0}
          value={form.ng}
          onChange={(e) => onChange({ ng: e.target.value })}
          className={inputCls}
          placeholder="0"
        />
      </Field>
      <Field label="Manpower">
        <input
          type="number"
          min={0}
          value={form.manpower}
          onChange={(e) => onChange({ manpower: e.target.value })}
          className={inputCls}
          placeholder="0"
        />
      </Field>
      <Field label="Dandori (menit)">
        <input
          type="number"
          min={0}
          value={form.dandori_menit}
          onChange={(e) => onChange({ dandori_menit: e.target.value })}
          className={inputCls}
          placeholder="0"
        />
      </Field>
      <Field label="Downtime (menit)">
        <input
          type="number"
          min={0}
          value={form.downtime_menit}
          onChange={(e) => onChange({ downtime_menit: e.target.value })}
          className={inputCls}
          placeholder="0"
        />
      </Field>
      <Field label="Break (menit)">
        <input
          type="number"
          min={0}
          value={form.break_menit}
          onChange={(e) => onChange({ break_menit: e.target.value })}
          className={inputCls}
          placeholder="0"
        />
      </Field>
    </div>
  );
}

export default function ProductionLogDashboard() {
  const supabase = createClient();

  const [logs, setLogs] = useState<ProdLog[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const requestIdRef = useRef(0);

  // Filters
  const [selectedLineId, setSelectedLineId] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Part number options
  const [partOptions, setPartOptions] = useState<string[]>([]);

  // Edit modal
  const [editTarget, setEditTarget] = useState<ProdLog | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(emptyEdit());
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isEditClosing, setIsEditClosing] = useState(false);
  const [editError, setEditError] = useState("");

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<ProdLog | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteClosing, setIsDeleteClosing] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [isCreateClosing, setIsCreateClosing] = useState(false);
  const [isSavingCreate, setIsSavingCreate] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createForm, setCreateForm] = useState<CreateForm>({
    ...emptyEdit(),
    line_id: "",
  });

  // ----- Data loaders -----

  const loadLogs = useCallback(
    async ({ showLoading = true }: { showLoading?: boolean } = {}) => {
      const reqId = ++requestIdRef.current;
      try {
        if (showLoading) setIsLoading(true);
        setError("");

        let query = supabase
          .from("prod_production_log" as any)
          .select("*, line:lines(name)")
          .eq("is_active", true)
          .order("waktu_awal", { ascending: false })
          .limit(500);

        if (selectedLineId !== "all") {
          query = query.eq("line_id", selectedLineId);
        }
        if (startDate) {
          query = query.gte("waktu_awal", `${startDate}T00:00:00`);
        }
        if (endDate) {
          query = query.lte("waktu_awal", `${endDate}T23:59:59`);
        }

        const { data, error: qErr } = await query;
        if (requestIdRef.current !== reqId) return;
        if (qErr) throw qErr;
        setLogs((data as ProdLog[]) ?? []);
      } catch (err) {
        if (requestIdRef.current !== reqId) return;
        const msg = err instanceof Error ? err.message : "Gagal memuat data log produksi";
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
        setPartOptions(
          Array.from(new Set((data as any[]).map((p: any) => p.value ?? "").filter(Boolean)))
        );
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
    const channel = supabase
      .channel("admin-prod-log-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "prod_production_log" }, refresh)
      .subscribe();
    const interval = window.setInterval(refresh, LOG_REFRESH_INTERVAL_MS);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      void supabase.removeChannel(channel);
    };
  }, [loadLogs]); // eslint-disable-line react-hooks/exhaustive-deps

  // ----- Client-side filter -----
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return logs;
    const q = searchQuery.toLowerCase();
    return logs.filter(
      (log) =>
        (log.part_number ?? "").toLowerCase().includes(q) ||
        (log.line?.name ?? "").toLowerCase().includes(q) ||
        (log.mesin ?? "").toLowerCase().includes(q) ||
        (log.stasiun ?? "").toLowerCase().includes(q)
    );
  }, [logs, searchQuery]);

  // ----- Stats -----
  const stats = useMemo(() => {
    let totalQty = 0,
      totalNg = 0;
    const uniqueLines = new Set<string>();
    filtered.forEach((l) => {
      totalQty += l.qty ?? 0;
      totalNg += l.ng ?? 0;
      if (l.line_id) uniqueLines.add(l.line_id);
    });
    return {
      totalQty,
      totalNg,
      totalOk: totalQty - totalNg,
      ngRate: totalQty > 0 ? (totalNg / totalQty) * 100 : 0,
      activeLinesCount: uniqueLines.size,
      rowCount: filtered.length,
    };
  }, [filtered]);

  const handleResetFilters = () => {
    setSelectedLineId("all");
    setStartDate("");
    setEndDate("");
    setSearchQuery("");
  };

  const handleExportCSV = () => {
    if (filtered.length === 0) return;
    const headers = [
      "Tanggal","Waktu Mulai","Waktu Selesai","Line","Mesin","Stasiun",
      "Part Number","QTY","NG","OK","Manpower","Dandori (m)","Downtime (m)","Break (m)",
    ];
    const rows = filtered.map((l) =>
      [
        formatDate(l.waktu_awal),
        formatTime(l.waktu_awal),
        formatTime(l.waktu_akhir),
        l.line?.name ?? "-",
        l.mesin,
        l.stasiun ?? "-",
        l.part_number ?? "-",
        l.qty ?? 0,
        l.ng ?? 0,
        (l.qty ?? 0) - (l.ng ?? 0),
        l.manpower ?? "-",
        l.dandori_menit ?? 0,
        l.downtime_menit ?? 0,
        l.break_menit ?? 0,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Log_Produksi_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ----- Edit -----
  const openEdit = (log: ProdLog) => {
    setEditTarget(log);
    setEditForm({
      part_number: log.part_number ?? "",
      qty: log.qty !== null ? String(log.qty) : "",
      ng: log.ng !== null ? String(log.ng) : "",
      manpower: log.manpower !== null ? String(log.manpower) : "",
      waktu_awal: toLocalInput(log.waktu_awal),
      waktu_akhir: toLocalInput(log.waktu_akhir),
      dandori_menit: log.dandori_menit !== null ? String(log.dandori_menit) : "",
      downtime_menit: log.downtime_menit !== null ? String(log.downtime_menit) : "",
      break_menit: log.break_menit !== null ? String(log.break_menit) : "",
    });
    setEditError("");
    void loadPartOptions(log.line_id ?? undefined);
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
      const payload: Record<string, unknown> = {
        part_number: editForm.part_number || null,
        qty: editForm.qty !== "" ? Number(editForm.qty) : null,
        ng: editForm.ng !== "" ? Number(editForm.ng) : null,
        manpower: editForm.manpower !== "" ? Number(editForm.manpower) : null,
        waktu_akhir: editForm.waktu_akhir ? new Date(editForm.waktu_akhir).toISOString() : null,
        dandori_menit: editForm.dandori_menit !== "" ? Number(editForm.dandori_menit) : null,
        downtime_menit: editForm.downtime_menit !== "" ? Number(editForm.downtime_menit) : null,
        break_menit: editForm.break_menit !== "" ? Number(editForm.break_menit) : null,
      };
      if (editForm.waktu_awal) {
        payload.waktu_awal = new Date(editForm.waktu_awal).toISOString();
      }
      const { error: saveErr } = await supabase
        .from("prod_production_log" as any)
        .update(payload)
        .eq("id", editTarget.id);
      if (saveErr) throw saveErr;
      toast.success("Log produksi berhasil diperbarui!");
      closeEdit();
      void loadLogs({ showLoading: false });
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // ----- Delete -----
  const openDelete = (log: ProdLog) => {
    setDeleteTarget(log);
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
      const { error: delErr } = await supabase
        .from("prod_production_log" as any)
        .update({ is_active: false })
        .eq("id", deleteTarget.id);
      if (delErr) throw delErr;
      toast.success("Log produksi berhasil dihapus.");
      setLogs((prev) => prev.filter((l) => l.id !== deleteTarget.id));
      closeDelete();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Gagal menghapus");
    } finally {
      setIsDeleting(false);
    }
  };

  // ----- Create -----
  const openCreate = () => {
    setCreateForm({
      ...emptyEdit(),
      line_id: selectedLineId !== "all" ? selectedLineId : "",
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
      const payload = {
        line_id: createForm.line_id,
        mesin: selectedLine?.machine_type ?? "blanking",
        waktu_awal: new Date(createForm.waktu_awal).toISOString(),
        waktu_akhir: createForm.waktu_akhir ? new Date(createForm.waktu_akhir).toISOString() : null,
        part_number: createForm.part_number || null,
        qty: createForm.qty !== "" ? Number(createForm.qty) : null,
        ng: createForm.ng !== "" ? Number(createForm.ng) : null,
        manpower: createForm.manpower !== "" ? Number(createForm.manpower) : null,
        dandori_menit: createForm.dandori_menit !== "" ? Number(createForm.dandori_menit) : null,
        downtime_menit: createForm.downtime_menit !== "" ? Number(createForm.downtime_menit) : null,
        break_menit: createForm.break_menit !== "" ? Number(createForm.break_menit) : null,
        is_active: true,
      };
      const { error: insErr } = await supabase
        .from("prod_production_log" as any)
        .insert(payload);
      if (insErr) throw insErr;
      toast.success("Log produksi baru berhasil ditambahkan!");
      closeCreate();
      void loadLogs({ showLoading: false });
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setIsSavingCreate(false);
    }
  };

  // ===================== RENDER =====================

  const statCards = [
    { label: "Total QTY", value: stats.totalQty, color: "blue", sub: "Semua produksi" },
    {
      label: "QTY OK",
      value: stats.totalOk,
      color: "emerald",
      sub:
        stats.totalQty > 0
          ? `${((stats.totalOk / stats.totalQty) * 100).toFixed(1)}% dari total`
          : "0%",
    },
    { label: "QTY NG", value: stats.totalNg, color: "rose", sub: `Rate: ${stats.ngRate.toFixed(1)}%` },
    { label: "Line Aktif", value: stats.activeLinesCount, color: "purple", sub: "Line beraktivitas" },
    { label: "Total Entri", value: stats.rowCount, color: "amber", sub: "Baris ditampilkan" },
  ];

  const colorMap: Record<string, { border: string; bg: string; text: string; badge: string; bar: string }> = {
    blue:    { border: "border-blue-100",    bg: "from-blue-50",    text: "text-blue-600",    badge: "bg-blue-100",    bar: "bg-blue-500" },
    emerald: { border: "border-emerald-100", bg: "from-emerald-50", text: "text-emerald-600", badge: "bg-emerald-100", bar: "bg-emerald-500" },
    rose:    { border: "border-rose-100",    bg: "from-rose-50",    text: "text-rose-600",    badge: "bg-rose-100",    bar: "bg-rose-500" },
    purple:  { border: "border-purple-100",  bg: "from-purple-50",  text: "text-purple-600",  badge: "bg-purple-100",  bar: "bg-purple-500" },
    amber:   { border: "border-amber-100",   bg: "from-amber-50",   text: "text-amber-600",   badge: "bg-amber-100",   bar: "bg-amber-500" },
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Riwayat Produksi Semua Line</h1>
          <p className="mt-1 text-sm text-slate-500">
            Data log produksi seluruh mesin/line. Admin dapat menambah, mengedit, atau menghapus entri.
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
        {statCards.map((card) => {
          const c = colorMap[card.color];
          return (
            <div
              key={card.label}
              className={`relative overflow-hidden rounded-xl border ${c.border} bg-gradient-to-br ${c.bg} to-white p-5 shadow-sm transition-all duration-200 hover:shadow-md`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold uppercase tracking-wider ${c.text}`}>{card.label}</span>
                <div className={`rounded-lg ${c.badge} p-2 ${c.text}`}>
                  <Activity className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-3xl font-bold text-slate-900">{card.value}</h3>
                <p className={`mt-1 text-xs font-medium ${c.text}`}>{card.sub}</p>
              </div>
              <div className={`absolute bottom-0 left-0 right-0 h-1 ${c.bar}`} />
            </div>
          );
        })}
      </div>

      {/* Filter Panel */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4 text-slate-700">
          <SlidersHorizontal className="h-5 w-5 text-slate-500" />
          <h2 className="font-semibold text-base">Panel Filter &amp; Pencarian</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* Line */}
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
                placeholder="Part Number / Mesin / Line..."
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
            Menampilkan{" "}
            <span className="font-semibold text-slate-800">{filtered.length}</span> entri log produksi.
          </p>
          {(selectedLineId !== "all" || startDate || endDate || searchQuery) && (
            <button
              onClick={handleResetFilters}
              className="text-xs font-semibold text-red-600 hover:text-red-700 hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-0 self-start sm:self-center"
            >
              Reset Semua Filter
            </button>
          )}
        </div>
      </div>

      {/* Table */}
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
            <h3 className="mt-4 text-sm font-semibold text-slate-900">Tidak ada log produksi</h3>
            <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
              Tidak ada data yang cocok dengan filter saat ini. Ubah filter atau tambahkan entri baru.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 select-none">
                  <th className="py-4 px-4 font-bold text-xs uppercase tracking-wider">Tanggal</th>
                  <th className="py-4 px-4 font-bold text-xs uppercase tracking-wider">Line</th>
                  <th className="py-4 px-4 font-bold text-xs uppercase tracking-wider">Stasiun</th>
                  <th className="py-4 px-4 font-bold text-xs uppercase tracking-wider">Part Number</th>
                  <th className="py-4 px-4 font-bold text-xs uppercase tracking-wider text-center">Mulai – Selesai</th>
                  <th className="py-4 px-4 font-bold text-xs uppercase tracking-wider text-right">QTY OK</th>
                  <th className="py-4 px-4 font-bold text-xs uppercase tracking-wider text-right">QTY NG</th>
                  <th className="py-4 px-4 font-bold text-xs uppercase tracking-wider text-right">NG Rate</th>
                  <th className="py-4 px-4 font-bold text-xs uppercase tracking-wider text-center">MP</th>
                  <th className="py-4 px-4 font-bold text-xs uppercase tracking-wider text-center">Aksi</th>
                </tr>
              </thead>
              <tbody
                key={`${selectedLineId}-${startDate}-${endDate}`}
                className="divide-y divide-slate-100 animate-in fade-in slide-in-from-bottom-2 duration-500"
              >
                {filtered.map((log, index) => {
                  const qty = log.qty ?? 0;
                  const ng = log.ng ?? 0;
                  const ok = qty - ng;
                  const ngRate = qty > 0 ? (ng / qty) * 100 : 0;
                  const isNgHigh = ng > 0;
                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50 transition-colors duration-200 animate-in fade-in slide-in-from-bottom-1 duration-300 fill-mode-backwards"
                      style={{ animationDelay: `${Math.min(index * 25, 300)}ms` }}
                    >
                      <td className="py-3.5 px-4 font-medium text-slate-900 whitespace-nowrap">
                        <div>{formatDate(log.waktu_awal)}</div>
                        <div className="text-xs text-slate-400">{formatTime(log.waktu_awal)}</div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-700 whitespace-nowrap">
                        {log.line?.name ?? log.mesin}
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap text-xs">
                        {log.stasiun ?? "-"}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800 whitespace-nowrap font-mono">
                        {log.part_number ?? "-"}
                      </td>
                      <td className="py-3.5 px-4 text-center text-slate-600 whitespace-nowrap font-medium text-xs">
                        {formatTime(log.waktu_awal)} – {formatTime(log.waktu_akhir)}
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-800 font-bold whitespace-nowrap">
                        {ok}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <span
                          className={`font-bold ${
                            isNgHigh
                              ? "text-red-600 bg-red-50 border border-red-100 rounded px-1.5 py-0.5"
                              : "text-slate-500"
                          }`}
                        >
                          {ng}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold whitespace-nowrap">
                        <span
                          className={
                            isNgHigh
                              ? ngRate > 5
                                ? "text-red-700"
                                : "text-amber-700"
                              : "text-slate-400 font-normal"
                          }
                        >
                          {ngRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center text-slate-600 whitespace-nowrap">
                        {log.manpower ?? "-"}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEdit(log)}
                            className="inline-flex items-center justify-center h-8 w-8 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors duration-200 cursor-pointer"
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openDelete(log)}
                            className="inline-flex items-center justify-center h-8 w-8 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors duration-200 cursor-pointer"
                            title="Hapus"
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

      {/* ===== EDIT MODAL ===== */}
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
                <h3 className="text-lg font-bold text-slate-900">Edit Log Produksi</h3>
                <p className="text-xs text-slate-500">
                  {editTarget.line?.name ?? editTarget.mesin} — {formatDate(editTarget.waktu_awal)}
                </p>
              </div>
              <button
                onClick={closeEdit}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors duration-200 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 max-h-[65vh] overflow-y-auto">
              <EditFields
                form={editForm}
                partOptions={partOptions}
                onChange={(f) => setEditForm((prev) => ({ ...prev, ...f }))}
              />
              {editError && (
                <p className="mt-3 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-2">
                  {editError}
                </p>
              )}
            </div>
            <div className="border-t border-slate-100 px-6 py-4 flex gap-3">
              <Button
                onClick={closeEdit}
                disabled={isSavingEdit}
                variant="outline"
                className="flex-1 h-10 cursor-pointer"
              >
                Batal
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
              >
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

      {/* ===== CREATE MODAL ===== */}
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
                <h3 className="text-lg font-bold text-slate-900">Tambah Entri Log Produksi</h3>
                <p className="text-xs text-slate-500">Buat entri manual (untuk koreksi atau data operator yang terlewat)</p>
              </div>
              <button
                onClick={closeCreate}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors duration-200 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 max-h-[65vh] overflow-y-auto space-y-4">
              {/* Line selector */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block">Line *</label>
                <div className="relative">
                  <select
                    value={createForm.line_id}
                    onChange={(e) => {
                      setCreateForm((p) => ({ ...p, line_id: e.target.value, part_number: "" }));
                      void loadPartOptions(e.target.value);
                    }}
                    className="w-full pl-3 pr-8 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-800 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none cursor-pointer"
                  >
                    <option value="">— Pilih Line —</option>
                    {lines.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </div>
              </div>
              <EditFields
                form={createForm}
                partOptions={partOptions}
                onChange={(f) => setCreateForm((prev) => ({ ...prev, ...f }))}
              />
              {createError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-2">
                  {createError}
                </p>
              )}
            </div>
            <div className="border-t border-slate-100 px-6 py-4 flex gap-3">
              <Button
                onClick={closeCreate}
                disabled={isSavingCreate}
                variant="outline"
                className="flex-1 h-10 cursor-pointer"
              >
                Batal
              </Button>
              <Button
                onClick={handleSaveCreate}
                disabled={isSavingCreate}
                className="flex-1 h-10 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
              >
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

      {/* ===== DELETE MODAL ===== */}
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
                <h3 className="text-lg font-bold text-slate-900">Hapus Log Produksi</h3>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                  Hapus entri{" "}
                  <span className="font-semibold text-slate-800">
                    {deleteTarget.part_number ?? "-"}
                  </span>{" "}
                  pada{" "}
                  <span className="font-semibold text-slate-800">
                    {formatDate(deleteTarget.waktu_awal)}
                  </span>{" "}
                  ({deleteTarget.line?.name ?? deleteTarget.mesin})?
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
    </div>
  );
}

function ProductionLogTableSkeleton() {
  return (
    <div className="overflow-x-auto select-none animate-pulse">
      <table className="w-full text-left text-sm border-collapse">
        <thead>
          <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
            {[
              "Tanggal","Line","Stasiun","Part Number","Mulai – Selesai",
              "QTY OK","QTY NG","NG Rate","MP","Aksi",
            ].map((h) => (
              <th key={h} className="py-4 px-4 font-bold text-xs uppercase tracking-wider">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {Array.from({ length: 7 }).map((_, i) => (
            <tr key={i}>
              <td className="py-3.5 px-4"><div className="h-4 bg-slate-200 rounded w-20" /></td>
              <td className="py-3.5 px-4"><div className="h-4 bg-slate-200 rounded w-24" /></td>
              <td className="py-3.5 px-4"><div className="h-4 bg-slate-200 rounded w-16" /></td>
              <td className="py-3.5 px-4"><div className="h-4 bg-slate-200 rounded w-24 font-mono" /></td>
              <td className="py-3.5 px-4"><div className="h-4 bg-slate-200 rounded w-24 mx-auto" /></td>
              <td className="py-3.5 px-4"><div className="h-4 bg-slate-200 rounded w-12 ml-auto" /></td>
              <td className="py-3.5 px-4"><div className="h-4 bg-slate-200 rounded w-8 ml-auto" /></td>
              <td className="py-3.5 px-4"><div className="h-4 bg-slate-200 rounded w-12 ml-auto" /></td>
              <td className="py-3.5 px-4"><div className="h-4 bg-slate-200 rounded w-8 mx-auto" /></td>
              <td className="py-3.5 px-4"><div className="h-7 bg-slate-200 rounded-lg w-16 mx-auto" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
