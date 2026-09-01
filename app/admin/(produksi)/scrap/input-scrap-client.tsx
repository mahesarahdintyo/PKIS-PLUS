"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, Pencil, Trash2, Search, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ProdScrapRecord } from "@/types/produksi";
import { enqueueOffline, isNetworkError } from "@/lib/produksi/offlineQueue";
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

function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(Number(n))) return "-";
  return Number(n).toLocaleString("en-US", { maximumFractionDigits: 3 });
}

const BULAN_OPTIONS = [
  "Januari","Februari","Maret","April","Mei","Juni",
  "Juli","Agustus","September","Oktober","November","Desember"
];

const PAGE_SIZE = 36;

export default function InputScrapClient({ embedded }: { embedded?: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<ProdScrapRecord[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filter & Search
  const [filterTahun, setFilterTahun] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState("");

  // State untuk Dialog Edit
  const [editTarget, setEditTarget] = useState<ProdScrapRecord | null>(null);
  const [editForm, setEditForm] = useState<ProdScrapRecord>({
    tahun: new Date().getFullYear(),
    bulan: new Date().getMonth() + 1,
    scrap_value_kidr: 0,
    total_value_kidr: 0,
    target_rasio: 0.0046,
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // State untuk Dialog Hapus
  const [deleteTarget, setDeleteTarget] = useState<ProdScrapRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const now = new Date();
  const [form, setForm] = useState<ProdScrapRecord>({
    tahun: now.getFullYear(),
    bulan: now.getMonth() + 1,
    scrap_value_kidr: 0,
    total_value_kidr: 0,
    target_rasio: 0.0046,
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
      let q = supabase
        .from("prod_scrap_top_end")
        .select("*")
        .eq("is_active", true)
        .order("tahun", { ascending: false })
        .order("bulan", { ascending: false })
        .range(from, to);

      if (filterTahun !== "all") {
        q = q.eq("tahun", Number(filterTahun));
      }

      const res = await q;
      if (res.data) {
        if (targetPage === 0) {
          setRows(res.data);
        } else {
          setRows((prev) => [...prev, ...(res.data || [])]);
        }
        setHasMore((res.data?.length ?? 0) === PAGE_SIZE);
      }
      setPage(targetPage);
    } finally {
      if (targetPage > 0) setLoadingMore(false);
      else setLoading(false);
    }
  }, [filterTahun, supabase]);

  useEffect(() => {
    fetchRows(0);
  }, [fetchRows]);

  const save = async () => {
    const payload = {
      tahun: Number(form.tahun),
      bulan: Number(form.bulan),
      scrap_value_kidr: Number(form.scrap_value_kidr),
      total_value_kidr: Number(form.total_value_kidr),
      target_rasio: Number(form.target_rasio),
      is_active: true,
    };

    try {
      const res = await supabase
        .from("prod_scrap_top_end")
        .upsert(payload, { onConflict: "tahun,bulan" });
      if (res.error) throw res.error;

      flash("Scrap berhasil disimpan!");
      setForm({ tahun: now.getFullYear(), bulan: now.getMonth() + 1, scrap_value_kidr: 0, total_value_kidr: 0, target_rasio: 0.0046 });
      fetchRows(0);
    } catch (err: any) {
      if (isNetworkError(err)) {
        enqueueOffline("prod_scrap_top_end", payload);
        setRows((prev) => [
          { ...payload, id: "pending_" + Date.now(), _pending: true },
          ...prev,
        ]);
        setForm({ tahun: now.getFullYear(), bulan: now.getMonth() + 1, scrap_value_kidr: 0, total_value_kidr: 0, target_rasio: 0.0046 });
      } else {
        flash("Gagal menyimpan: " + (err?.message || "Unknown error"), true);
      }
    }
  };

  const handleOpenEdit = (r: ProdScrapRecord) => {
    setEditTarget(r);
    setEditForm({ ...r });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget?.id) return;
    setIsSavingEdit(true);
    const payload = {
      tahun: Number(editForm.tahun),
      bulan: Number(editForm.bulan),
      scrap_value_kidr: Number(editForm.scrap_value_kidr),
      total_value_kidr: Number(editForm.total_value_kidr),
      target_rasio: Number(editForm.target_rasio),
    };

    try {
      const res = await supabase
        .from("prod_scrap_top_end")
        .update(payload)
        .eq("id", editTarget.id)
        .select();
      if (res.error) throw res.error;
      if (!res.data || res.data.length === 0) {
        throw new Error("Tidak ada baris yang diperbarui (data tidak ditemukan atau izin RLS ditolak).");
      }

      flash("Data scrap diperbarui!");
      setEditTarget(null);
      fetchRows(0);
    } catch (err: any) {
      if (isNetworkError(err)) {
        enqueueOffline("prod_scrap_top_end", { ...payload, id: editTarget.id, is_active: true });
        setRows((prev) =>
          prev.map((r) => (r.id === editTarget.id ? { ...r, ...payload } : r))
        );
        setEditTarget(null);
      } else {
        flash("Gagal menyimpan: " + (err?.message || "Unknown error"), true);
      }
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      let q = supabase.from("prod_scrap_top_end").update({ is_active: false });
      if (deleteTarget.id) {
        q = q.eq("id", deleteTarget.id);
      } else {
        q = q.eq("tahun", deleteTarget.tahun).eq("bulan", deleteTarget.bulan);
      }
      const { error } = await q;
      if (error) throw error;

      flash(`Data scrap ${BULAN_OPTIONS[deleteTarget.bulan - 1]} ${deleteTarget.tahun} berhasil dihapus.`);
      setDeleteTarget(null);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (deleteTarget.id) next.delete(deleteTarget.id);
        return next;
      });
      fetchRows(0);
    } catch (err: any) {
      flash("Gagal menghapus: " + (err?.message || "Unknown error"), true);
    } finally {
      setIsDeleting(false);
    }
  };

  // Client-side search filtering
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter((r) => {
      const bulanName = (BULAN_OPTIONS[r.bulan - 1] || "").toLowerCase();
      const tahunStr = String(r.tahun);
      return bulanName.includes(q) || tahunStr.includes(q);
    });
  }, [rows, searchQuery]);

  // Bulk Selection helpers
  const isAllSelected = useMemo(() => {
    return filteredRows.length > 0 && filteredRows.every((r) => r.id && selectedIds.has(r.id));
  }, [filteredRows, selectedIds]);

  const isIndeterminate = useMemo(() => {
    return filteredRows.some((r) => r.id && selectedIds.has(r.id)) && !isAllSelected;
  }, [filteredRows, selectedIds, isAllSelected]);

  const toggleSelect = (id?: string) => {
    if (!id) return;
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
      const ids = filteredRows.map((r) => r.id).filter(Boolean) as string[];
      setSelectedIds(new Set(ids));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      setIsBulkDeleting(true);
      setBulkDeleteError("");

      const ids = Array.from(selectedIds);
      const { error } = await supabase
        .from("prod_scrap_top_end")
        .update({ is_active: false })
        .in("id", ids);

      if (error) throw error;

      flash(`${ids.length} data scrap berhasil dipindahkan ke Tempat Sampah.`);
      setSelectedIds(new Set());
      setShowBulkDeleteModal(false);
      fetchRows(0);
    } catch (err: any) {
      setBulkDeleteError(err?.message || "Gagal menghapus data terpilih.");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const yearOptions = useMemo(() => {
    const currentY = new Date().getFullYear();
    const set = new Set<number>([currentY, currentY - 1, currentY - 2]);
    rows.forEach((r) => set.add(r.tahun));
    return Array.from(set).sort((a, b) => b - a);
  }, [rows]);

  const innerContent = (
    <div className="space-y-6 pb-16">
      <Card className="dash-panel card-glow-info p-5">
        <p className="dash-panel-title font-bold text-base mb-1">Form Input Scrap Nilai Bulanan</p>
        <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
          Pencatatan nilai scrap (kIDR) dan total nilai produksi (kIDR) per bulan untuk perhitungan rasio scrap.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
          <div className="field">
            <label className="text-xs font-semibold block mb-1">Tahun</label>
            <Input type="number" value={form.tahun} onChange={(e) => setForm({ ...form, tahun: Number(e.target.value) })} />
          </div>
          <div className="field">
            <label className="text-xs font-semibold block mb-1">Bulan</label>
            <Select value={form.bulan} onChange={(e) => setForm({ ...form, bulan: Number(e.target.value) })}>
              {BULAN_OPTIONS.map((name, idx) => (
                <option key={idx + 1} value={idx + 1}>{name}</option>
              ))}
            </Select>
          </div>
          <div className="field">
            <label className="text-xs font-semibold block mb-1">Scrap Value (kIDR)</label>
            <Input type="number" step="0.001" value={form.scrap_value_kidr} onChange={(e) => setForm({ ...form, scrap_value_kidr: Number(e.target.value) })} />
          </div>
          <div className="field">
            <label className="text-xs font-semibold block mb-1">Total Value (kIDR)</label>
            <Input type="number" step="0.001" value={form.total_value_kidr} onChange={(e) => setForm({ ...form, total_value_kidr: Number(e.target.value) })} />
          </div>
          <div className="field">
            <label className="text-xs font-semibold block mb-1">Target Rasio</label>
            <Input type="number" step="0.0001" value={form.target_rasio} onChange={(e) => setForm({ ...form, target_rasio: Number(e.target.value) })} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="button" onClick={save} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
            Simpan Scrap
          </Button>
        </div>
      </Card>

      <Card className="dash-panel card-glow-info p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <p className="dash-panel-title font-bold text-base flex items-center gap-2">
            <span>Riwayat Data Scrap</span>
            <span className="text-xs font-mono font-normal px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {filteredRows.length} baris
            </span>
          </p>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div className="field">
            <label className="text-xs font-semibold block mb-1 text-muted-foreground">Filter Tahun</label>
            <Select
              value={filterTahun}
              onChange={(e) => setFilterTahun(e.target.value)}
              className="w-full text-xs"
            >
              <option value="all">Semua Tahun</option>
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </Select>
          </div>

          <div className="field">
            <label className="text-xs font-semibold block mb-1 text-muted-foreground">Cari Bulan / Tahun</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Cari nama bulan atau tahun..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 text-xs min-h-[38px]"
              />
            </div>
          </div>
        </div>

        {/* Floating Bulk Action Bar */}
        {selectedIds.size > 0 && (
          <div className="sticky top-4 z-30 flex items-center justify-between gap-3 p-3.5 bg-slate-900 text-white rounded-xl shadow-xl border border-slate-700 mb-4 animate-in fade-in slide-in-from-top-3 duration-200">
            <div className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold">
                {selectedIds.size}
              </span>
              <span className="text-xs sm:text-sm font-semibold">Data Scrap Dipilih</span>
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
                    aria-label="Pilih semua baris scrap"
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                  />
                </th>
                <th className="p-3">Periode</th>
                <th className="p-3 text-right">Scrap (kIDR)</th>
                <th className="p-3 text-right">Total (kIDR)</th>
                <th className="p-3 text-right">Rasio Aktual</th>
                <th className="p-3 text-right">Target Rasio</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <ScrapTableSkeleton />
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Belum ada data scrap yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                filteredRows.map((r, index) => {
                  const isSelected = r.id ? selectedIds.has(r.id) : false;
                  const rasio = r.total_value_kidr && r.total_value_kidr > 0 ? r.scrap_value_kidr / r.total_value_kidr : 0;
                  const isOverTarget = r.target_rasio ? rasio > r.target_rasio : false;

                  return (
                    <tr
                      key={r.id || index}
                      onClick={() => r.id && toggleSelect(r.id)}
                      className={`transition-colors cursor-pointer animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-backwards ${
                        isSelected ? "bg-blue-50/70 dark:bg-blue-950/40" : "hover:bg-muted/30"
                      }`}
                      style={{ animationDelay: `${Math.min(index * 25, 300)}ms` }}
                    >
                      <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(r.id)}
                          aria-label={`Pilih scrap ${r.bulan}/${r.tahun}`}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                        />
                      </td>
                      <td className="p-3 font-semibold text-foreground">
                        {BULAN_OPTIONS[r.bulan - 1]} {r.tahun}
                      </td>
                      <td className="p-3 text-right font-mono">{fmtNum(r.scrap_value_kidr)}</td>
                      <td className="p-3 text-right font-mono">{fmtNum(r.total_value_kidr)}</td>
                      <td className="p-3 text-right font-mono">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${isOverTarget ? "text-rose-600 bg-rose-50 border border-rose-200" : "text-emerald-600 bg-emerald-50 border border-emerald-200"}`}>
                          {(rasio * 100).toFixed(2)}%
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono text-muted-foreground">
                        {r.target_rasio ? `${(r.target_rasio * 100).toFixed(2)}%` : "-"}
                      </td>
                      <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <Button variant="secondary" size="sm" onClick={() => handleOpenEdit(r)} className="h-8 w-8 p-0" title="Edit data scrap">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(r)} className="h-8 w-8 p-0" title="Hapus data scrap">
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

      {/* Modal Edit Scrap */}
      {editTarget && (
        <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open && !isSavingEdit) setEditTarget(null); }}>
          <DialogContent onClose={() => { if (!isSavingEdit) setEditTarget(null); }} maxWidth="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Scrap — {BULAN_OPTIONS[editTarget.bulan - 1]} {editTarget.tahun}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveEdit} className="space-y-4 mt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="field">
                  <label className="text-xs font-semibold block mb-1">Tahun</label>
                  <Input
                    type="number"
                    value={editForm.tahun}
                    onChange={(e) => setEditForm({ ...editForm, tahun: Number(e.target.value) })}
                    required
                  />
                </div>
                <div className="field">
                  <label className="text-xs font-semibold block mb-1">Bulan</label>
                  <Select
                    value={editForm.bulan}
                    onChange={(e) => setEditForm({ ...editForm, bulan: Number(e.target.value) })}
                  >
                    {BULAN_OPTIONS.map((name, idx) => (
                      <option key={idx + 1} value={idx + 1}>{name}</option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="field">
                  <label className="text-xs font-semibold block mb-1">Scrap Value (kIDR)</label>
                  <Input
                    type="number"
                    step="0.001"
                    value={editForm.scrap_value_kidr}
                    onChange={(e) => setEditForm({ ...editForm, scrap_value_kidr: Number(e.target.value) })}
                  />
                </div>
                <div className="field">
                  <label className="text-xs font-semibold block mb-1">Total Value (kIDR)</label>
                  <Input
                    type="number"
                    step="0.001"
                    value={editForm.total_value_kidr}
                    onChange={(e) => setEditForm({ ...editForm, total_value_kidr: Number(e.target.value) })}
                  />
                </div>
                <div className="field">
                  <label className="text-xs font-semibold block mb-1">Target Rasio</label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={editForm.target_rasio}
                    onChange={(e) => setEditForm({ ...editForm, target_rasio: Number(e.target.value) })}
                  />
                </div>
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
                <h3 className="text-lg font-bold text-foreground">Hapus Data Scrap?</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Yakin ingin menghapus data scrap periode <strong className="text-foreground">{BULAN_OPTIONS[deleteTarget.bulan - 1]} {deleteTarget.tahun}</strong>?
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
                <h3 className="text-lg font-bold text-foreground">Hapus {selectedIds.size} Data Scrap?</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Apakah Anda yakin ingin menghapus <strong className="text-foreground">{selectedIds.size} data scrap</strong> yang dipilih?
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
                Kualitas &amp; Scrap
              </span>
              Input Nilai Scrap Bulanan
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Pencatatan data scrap value dan total production value per bulan untuk monitoring rasio scrap top-end.
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

function ScrapTableSkeleton() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <tr key={i} className="animate-pulse select-none">
          <td className="p-3 text-center"><div className="h-4 w-4 bg-muted rounded mx-auto" /></td>
          <td className="p-3"><div className="h-4 bg-muted rounded w-28" /></td>
          <td className="p-3 text-right"><div className="h-4 bg-muted rounded w-16 ml-auto" /></td>
          <td className="p-3 text-right"><div className="h-4 bg-muted rounded w-16 ml-auto" /></td>
          <td className="p-3 text-right"><div className="h-4 bg-muted rounded w-12 ml-auto" /></td>
          <td className="p-3 text-right"><div className="h-4 bg-muted rounded w-12 ml-auto" /></td>
          <td className="p-3 text-center"><div className="h-7 w-20 bg-muted rounded mx-auto" /></td>
        </tr>
      ))}
    </>
  );
}
