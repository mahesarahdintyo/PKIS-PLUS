"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, Pencil, Trash2, Search, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ProdProductivityRecord } from "@/types/produksi";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

function fmtNum(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "" || Number.isNaN(Number(n))) return "-";
  return Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function fmtTgl(iso: string): string {
  if (!iso) return "-";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
}

const PAGE_SIZE = 90;

export default function InputProductivityClient({ embedded }: { embedded?: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<ProdProductivityRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Search filter
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState("");

  // State untuk Dialog Edit
  const [editTarget, setEditTarget] = useState<ProdProductivityRecord | null>(null);
  const [editForm, setEditForm] = useState<ProdProductivityRecord>({
    tanggal: "",
    eh_jam: "",
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // State untuk Dialog Hapus
  const [deleteTarget, setDeleteTarget] = useState<ProdProductivityRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState<ProdProductivityRecord>({
    tanggal: today,
    eh_jam: "",
  });

  const flash = (m: string, isErr = false) => {
    if (isErr) toast.error(m);
    else toast.success(m);
  };

  const fetchRows = useCallback(async (targetPage = 0) => {
    if (targetPage > 0) setLoadingMore(true);
    else setLoading(true);

    try {
      const from = targetPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data } = await supabase
        .from("productivity_daily_reference")
        .select("id, tanggal, eh_jam")
        .eq("is_active", true)
        .order("tanggal", { ascending: false })
        .range(from, to);
      if (data) {
        if (targetPage === 0) {
          setRows(data);
        } else {
          setRows((prev) => [...prev, ...data]);
        }
        setHasMore(data.length === PAGE_SIZE);
      }
      setPage(targetPage);
    } finally {
      if (targetPage > 0) setLoadingMore(false);
      else setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchRows(0);
  }, [fetchRows]);

  const simpan = async () => {
    if (!form.tanggal || form.eh_jam === "") {
      flash("Isi tanggal & Earned Hours dulu.", true);
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("productivity_daily_reference")
      .upsert(
        {
          tanggal: form.tanggal,
          eh_jam: Number(form.eh_jam),
          is_active: true,
        },
        { onConflict: "tanggal" }
      );
    setSaving(false);
    if (error) {
      flash("Gagal simpan: " + error.message, true);
      return;
    }
    flash("Earned Hours " + form.tanggal + " disimpan.");
    setForm((prev) => ({ ...prev, eh_jam: "" }));
    await fetchRows(0);
  };

  const handleOpenEdit = (r: ProdProductivityRecord) => {
    setEditTarget(r);
    setEditForm({
      tanggal: r.tanggal,
      eh_jam: r.eh_jam,
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    if (!editForm.tanggal || editForm.eh_jam === "") {
      flash("Isi tanggal & Earned Hours dulu.", true);
      return;
    }
    setIsSavingEdit(true);
    const payload = {
      tanggal: editForm.tanggal,
      eh_jam: Number(editForm.eh_jam),
    };
    let q = supabase.from("productivity_daily_reference").update(payload);
    if (editTarget.id) {
      q = q.eq("id", editTarget.id);
    } else {
      q = q.eq("tanggal", editTarget.tanggal);
    }
    const { error } = await q;
    setIsSavingEdit(false);
    if (error) {
      flash("Gagal simpan: " + error.message, true);
      return;
    }
    flash("Earned Hours " + editForm.tanggal + " diperbarui.");
    setEditTarget(null);
    await fetchRows(0);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    let q = supabase.from("productivity_daily_reference").update({ is_active: false });
    if (deleteTarget.id) {
      q = q.eq("id", deleteTarget.id);
    } else {
      q = q.eq("tanggal", deleteTarget.tanggal);
    }
    const { error } = await q;
    setIsDeleting(false);
    if (error) {
      flash("Gagal menghapus: " + error.message, true);
      return;
    }
    flash("Data Earned Hours " + deleteTarget.tanggal + " berhasil dihapus.");
    setDeleteTarget(null);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (deleteTarget.id) next.delete(deleteTarget.id);
      else next.delete(deleteTarget.tanggal);
      return next;
    });
    await fetchRows(0);
  };

  // Client-side search filtering
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter((r) => {
      const tgl = (r.tanggal || "").toLowerCase();
      const formatted = fmtTgl(r.tanggal).toLowerCase();
      return tgl.includes(q) || formatted.includes(q);
    });
  }, [rows, searchQuery]);

  // Bulk Selection helpers
  const isAllSelected = useMemo(() => {
    return filteredRows.length > 0 && filteredRows.every((r) => {
      const key = r.id || r.tanggal;
      return selectedIds.has(key);
    });
  }, [filteredRows, selectedIds]);

  const isIndeterminate = useMemo(() => {
    return filteredRows.some((r) => {
      const key = r.id || r.tanggal;
      return selectedIds.has(key);
    }) && !isAllSelected;
  }, [filteredRows, selectedIds, isAllSelected]);

  const toggleSelect = (key: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      const keys = filteredRows.map((r) => (r.id || r.tanggal)).filter(Boolean) as string[];
      setSelectedIds(new Set(keys));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      setIsBulkDeleting(true);
      setBulkDeleteError("");

      const keys = Array.from(selectedIds);
      // Soft delete by id or tanggal
      const { error } = await supabase
        .from("productivity_daily_reference")
        .update({ is_active: false })
        .or(`id.in.(${keys.join(",")}),tanggal.in.(${keys.join(",")})`);

      if (error) throw error;

      flash(`${keys.length} data Earned Hours berhasil dipindahkan ke Tempat Sampah.`);
      setSelectedIds(new Set());
      setShowBulkDeleteModal(false);
      fetchRows(0);
    } catch (err: any) {
      setBulkDeleteError(err?.message || "Gagal menghapus data terpilih.");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const innerContent = (
    <div className="space-y-6 pb-16">
      <Card className="dash-panel card-glow-info p-5">
        <p className="dash-panel-title font-bold text-base mb-1">Target Earned Hours Harian (Total)</p>
        <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
          Masukkan total Earned Hours (EH) yang direncanakan untuk seluruh line per tanggal.
          Target ini digunakan untuk menghitung rasio produktivitas di dashboard.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div className="field">
            <label className="text-xs font-semibold block mb-1">Tanggal</label>
            <Input
              type="date"
              value={form.tanggal}
              onChange={(e) => setForm((prev) => ({ ...prev, tanggal: e.target.value }))}
            />
          </div>
          <div className="field">
            <label className="text-xs font-semibold block mb-1">Earned Hours (jam)</label>
            <Input
              type="number"
              step="0.1"
              placeholder="mis. 7.5"
              value={form.eh_jam}
              onChange={(e) => setForm((prev) => ({ ...prev, eh_jam: e.target.value }))}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="button" onClick={simpan} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
            {saving ? "Menyimpan..." : "Simpan Target EH"}
          </Button>
        </div>
      </Card>

      <Card className="dash-panel card-glow-info p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <p className="dash-panel-title font-bold text-base flex items-center gap-2">
            <span>Riwayat Target EH Harian</span>
            <span className="text-xs font-mono font-normal px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {filteredRows.length} baris
            </span>
          </p>
        </div>

        {/* Search filter toolbar */}
        <div className="mb-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Cari tanggal (YYYY-MM-DD)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 text-xs min-h-[38px]"
            />
          </div>
        </div>

        {/* Floating Bulk Action Bar */}
        {selectedIds.size > 0 && (
          <div className="sticky top-4 z-30 flex items-center justify-between gap-3 p-3.5 bg-slate-900 text-white rounded-xl shadow-xl border border-slate-700 mb-4 animate-in fade-in slide-in-from-top-3 duration-200">
            <div className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold">
                {selectedIds.size}
              </span>
              <span className="text-xs sm:text-sm font-semibold">Data EH Dipilih</span>
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
                    aria-label="Pilih semua baris EH"
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                  />
                </th>
                <th className="p-3">Tanggal</th>
                <th className="p-3 text-right">Earned Hours Target (jam)</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <ProductivityTableSkeleton />
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-muted-foreground">
                    Belum ada data Earned Hours yang cocok dengan pencarian.
                  </td>
                </tr>
              ) : (
                filteredRows.map((r, index) => {
                  const rowKey = r.id || r.tanggal;
                  const isSelected = selectedIds.has(rowKey);
                  return (
                    <tr
                      key={rowKey || index}
                      onClick={() => toggleSelect(rowKey)}
                      className={`transition-colors cursor-pointer animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-backwards ${
                        isSelected ? "bg-blue-50/70 dark:bg-blue-950/40" : "hover:bg-muted/30"
                      }`}
                      style={{ animationDelay: `${Math.min(index * 25, 300)}ms` }}
                    >
                      <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(rowKey)}
                          aria-label={`Pilih EH ${r.tanggal}`}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                        />
                      </td>
                      <td className="p-3 font-mono font-medium text-foreground">
                        {fmtTgl(r.tanggal)} <span className="text-xs text-muted-foreground ml-1">({r.tanggal})</span>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {fmtNum(r.eh_jam)} jam
                      </td>
                      <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <Button variant="secondary" size="sm" onClick={() => handleOpenEdit(r)} className="h-8 w-8 p-0" title="Edit target EH">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(r)} className="h-8 w-8 p-0" title="Hapus target EH">
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
          <div className="mt-4 text-center">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={loadingMore}
              onClick={() => fetchRows(page + 1)}
            >
              {loadingMore ? "Memuat..." : "Muat Lebih Banyak"}
            </Button>
          </div>
        )}
      </Card>

      {/* Modal Edit EH */}
      {editTarget && (
        <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open && !isSavingEdit) setEditTarget(null); }}>
          <DialogContent onClose={() => { if (!isSavingEdit) setEditTarget(null); }} maxWidth="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Target Earned Hours — {fmtTgl(editTarget.tanggal)}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveEdit} className="space-y-4 mt-2">
              <div className="field">
                <label className="text-xs font-semibold block mb-1">Tanggal</label>
                <Input
                  type="date"
                  value={editForm.tanggal}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, tanggal: e.target.value }))}
                  required
                />
              </div>
              <div className="field">
                <label className="text-xs font-semibold block mb-1">Earned Hours (jam)</label>
                <Input
                  type="number"
                  step="0.1"
                  value={editForm.eh_jam}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, eh_jam: e.target.value }))}
                  required
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setEditTarget(null)}
                  disabled={isSavingEdit}
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

      {/* Modal Konfirmasi Hapus Satuan */}
      {deleteTarget && (
        <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open && !isDeleting) setDeleteTarget(null); }}>
          <DialogContent onClose={() => { if (!isDeleting) setDeleteTarget(null); }} maxWidth="max-w-md">
            <div className="flex items-start gap-4 mb-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-50 border border-red-100 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-foreground">Hapus Target Earned Hours?</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Yakin ingin menghapus target EH tanggal <strong className="text-foreground">{fmtTgl(deleteTarget.tanggal)}</strong>?
                </p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Data akan dipindahkan ke Tempat Sampah (soft-delete).
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700 text-white font-bold"
              >
                {isDeleting ? "Menghapus…" : "Ya, Hapus"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal Konfirmasi Bulk Delete */}
      {showBulkDeleteModal && (
        <Dialog open={showBulkDeleteModal} onOpenChange={(open) => { if (!open && !isBulkDeleting) setShowBulkDeleteModal(false); }}>
          <DialogContent onClose={() => { if (!isBulkDeleting) setShowBulkDeleteModal(false); }} maxWidth="max-w-md">
            <div className="flex items-start gap-4 mb-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-50 border border-red-100 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-foreground">Hapus {selectedIds.size} Data Target EH?</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Apakah Anda yakin ingin menghapus <strong className="text-foreground">{selectedIds.size} data Earned Hours</strong> yang dipilih?
                </p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Data akan dipindahkan ke Tempat Sampah (soft-delete).
                </p>
              </div>
            </div>

            {bulkDeleteError && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs">
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
                onClick={handleBulkDelete}
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

  if (embedded) {
    return <div className="main animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ minHeight: 0 }}>{innerContent}</div>;
  }

  return (
    <div className="app-shell">
      <main className="main max-w-6xl mx-auto w-full animate-in fade-in slide-in-from-bottom-2 duration-500">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 self-start min-h-[40px] px-3 py-2 mb-4 text-xs font-semibold rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors touch-manipulation shadow-xs"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          Kembali ke Admin
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="page-header mb-0">
            <h1 className="page-title text-2xl font-bold font-display">
              <span className="eyebrow block text-xs font-semibold text-blue-500 uppercase tracking-wider mb-0.5">
                Produksi
              </span>
              Input Earned Hours (EH) Harian
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Pencatatan target jam kerja efektif (Earned Hours) untuk evaluasi produktivitas harian.
            </p>
          </div>

          <button
            type="button"
            onClick={() => fetchRows(0)}
            disabled={loading}
            className="inline-flex items-center gap-2 min-h-[40px] px-3.5 py-2 text-xs font-bold rounded-xl border border-border bg-card text-foreground hover:bg-muted active:scale-95 transition-all cursor-pointer touch-manipulation shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        {innerContent}
      </main>
    </div>
  );
}

function ProductivityTableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="animate-pulse select-none">
          <td className="p-3 text-center"><div className="h-4 w-4 bg-muted rounded mx-auto" /></td>
          <td className="p-3"><div className="h-4 bg-muted rounded w-36" /></td>
          <td className="p-3 text-right"><div className="h-4 bg-muted rounded w-16 ml-auto" /></td>
          <td className="p-3 text-center"><div className="h-7 w-20 bg-muted rounded mx-auto" /></td>
        </tr>
      ))}
    </>
  );
}
