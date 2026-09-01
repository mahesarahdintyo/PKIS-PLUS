"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { ThumbsUp, ArrowLeft, RefreshCw, Pencil, Trash2, Search, Filter, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ProdSafetyRecord } from "@/types/produksi";
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

const PAGE_SIZE = 60;

export default function InputSafetyClient({ embedded }: { embedded?: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<ProdSafetyRecord[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filter & Search
  const [filterKategori, setFilterKategori] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState("");

  // State untuk Dialog Edit
  const [editTarget, setEditTarget] = useState<ProdSafetyRecord | null>(null);
  const [editForm, setEditForm] = useState<ProdSafetyRecord>({
    tanggal: "",
    kategori: "ACCIDENT",
    keterangan: "",
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // State untuk Dialog Hapus
  const [deleteTarget, setDeleteTarget] = useState<ProdSafetyRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState<ProdSafetyRecord>({
    tanggal: today,
    kategori: "ACCIDENT",
    keterangan: "",
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
        .from("prod_safety_log")
        .select("*")
        .eq("is_active", true)
        .order("tanggal", { ascending: false })
        .range(from, to);

      if (filterKategori !== "all") {
        q = q.eq("kategori", filterKategori);
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
  }, [filterKategori, supabase]);

  useEffect(() => {
    fetchRows(0);
  }, [fetchRows]);

  const save = async () => {
    const payload = {
      tanggal: form.tanggal,
      kategori: form.kategori,
      keterangan: form.keterangan || null,
      is_active: true,
    };

    try {
      const res = await supabase.from("prod_safety_log").insert(payload);
      if (res.error) throw res.error;

      flash("Insiden berhasil dicatat!");
      setForm({ tanggal: today, kategori: "ACCIDENT", keterangan: "" });
      fetchRows(0);
    } catch (err: any) {
      if (isNetworkError(err)) {
        enqueueOffline("prod_safety_log", payload);
        setRows((prev) => [
          { ...payload, id: "pending_" + Date.now(), _pending: true } as ProdSafetyRecord,
          ...prev,
        ]);
        setForm({ tanggal: today, kategori: "ACCIDENT", keterangan: "" });
      } else {
        flash("Gagal menyimpan: " + (err?.message || "Unknown error"), true);
      }
    }
  };

  const handleOpenEdit = (r: ProdSafetyRecord) => {
    setEditTarget(r);
    setEditForm({
      tanggal: r.tanggal,
      kategori: r.kategori || "ACCIDENT",
      keterangan: r.keterangan || "",
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget?.id) return;
    if (!editForm.tanggal) {
      flash("Tanggal harus diisi.", true);
      return;
    }
    setIsSavingEdit(true);
    const payload = {
      tanggal: editForm.tanggal,
      kategori: editForm.kategori,
      keterangan: editForm.keterangan || null,
    };
    try {
      const { error } = await supabase
        .from("prod_safety_log")
        .update(payload)
        .eq("id", editTarget.id);
      if (error) throw error;

      flash("Data insiden diperbarui!");
      setEditTarget(null);
      fetchRows(0);
    } catch (err: any) {
      flash("Gagal menyimpan: " + (err?.message || "Unknown error"), true);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("prod_safety_log")
        .update({ is_active: false })
        .eq("id", deleteTarget.id);
      if (error) throw error;

      flash("Data insiden berhasil dihapus.");
      setDeleteTarget(null);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteTarget.id!);
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
      const tgl = (r.tanggal || "").toLowerCase();
      const kat = (r.kategori || "").toLowerCase();
      const ket = (r.keterangan || "").toLowerCase();
      return tgl.includes(q) || kat.includes(q) || ket.includes(q);
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
        .from("prod_safety_log")
        .update({ is_active: false })
        .in("id", ids);

      if (error) throw error;

      flash(`${ids.length} data insiden berhasil dipindahkan ke Tempat Sampah.`);
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
        <p className="dash-panel-title font-bold text-base mb-1">Pencatatan Insiden Safety</p>
        <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
          Catat insiden keselamatan kerja (Near Miss, Accident, First Aid). Jika tidak ada insiden, sistem otomatis mencatat zero accident.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="field">
            <label className="text-xs font-semibold block mb-1">Tanggal</label>
            <Input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} />
          </div>
          <div className="field">
            <label className="text-xs font-semibold block mb-1">Kategori Insiden</label>
            <Select value={form.kategori} onChange={(e) => setForm({ ...form, kategori: e.target.value })}>
              <option value="ACCIDENT">Accident (Kecelakaan Kerja)</option>
              <option value="NEAR_MISS">Near Miss (Hampir Celaka)</option>
              <option value="FIRST_AID">First Aid (P3K)</option>
            </Select>
          </div>
          <div className="field">
            <label className="text-xs font-semibold block mb-1">Keterangan / Kronologi</label>
            <Input
              type="text"
              placeholder="Deskripsi singkat insiden..."
              value={form.keterangan || ""}
              onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="button" onClick={save} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
            Catat Insiden
          </Button>
        </div>
      </Card>

      <Card className="dash-panel card-glow-info p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <p className="dash-panel-title font-bold text-base flex items-center gap-2">
            <span>Riwayat Insiden Safety</span>
            <span className="text-xs font-mono font-normal px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {filteredRows.length} baris
            </span>
          </p>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div className="field">
            <label className="text-xs font-semibold block mb-1 text-muted-foreground">Filter Kategori</label>
            <Select
              value={filterKategori}
              onChange={(e) => setFilterKategori(e.target.value)}
              className="w-full text-xs"
            >
              <option value="all">Semua Kategori</option>
              <option value="ACCIDENT">Accident</option>
              <option value="NEAR_MISS">Near Miss</option>
              <option value="FIRST_AID">First Aid</option>
            </Select>
          </div>

          <div className="field">
            <label className="text-xs font-semibold block mb-1 text-muted-foreground">Cari Tanggal / Keterangan</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Cari deskripsi, tanggal..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full !pl-9 pr-3 text-xs min-h-[38px]"
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
              <span className="text-xs sm:text-sm font-semibold">Data Insiden Dipilih</span>
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
                    aria-label="Pilih semua baris insiden"
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                  />
                </th>
                <th className="p-3">Tanggal</th>
                <th className="p-3">Kategori</th>
                <th className="p-3">Keterangan</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <SafetyTableSkeleton />
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    <ThumbsUp className="h-6 w-6 text-emerald-500 mx-auto mb-1" />
                    Belum ada catatan insiden (Zero Accident).
                  </td>
                </tr>
              ) : (
                filteredRows.map((r, index) => {
                  const isSelected = r.id ? selectedIds.has(r.id) : false;
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
                          aria-label={`Pilih insiden ${r.tanggal}`}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                        />
                      </td>
                      <td className="p-3 font-mono font-medium text-foreground">{r.tanggal}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          r.kategori === "ACCIDENT"
                            ? "bg-red-50 text-red-700 border border-red-200"
                            : r.kategori === "NEAR_MISS"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-blue-50 text-blue-700 border border-blue-200"
                        }`}>
                          {r.kategori}
                        </span>
                      </td>
                      <td className="p-3 text-foreground">{r.keterangan || "-"}</td>
                      <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <Button variant="secondary" size="sm" onClick={() => handleOpenEdit(r)} className="h-8 w-8 p-0" title="Edit insiden">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(r)} className="h-8 w-8 p-0" title="Hapus insiden">
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

      {/* Modal Edit Insiden */}
      {editTarget && (
        <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open && !isSavingEdit) setEditTarget(null); }}>
          <DialogContent onClose={() => { if (!isSavingEdit) setEditTarget(null); }} maxWidth="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Catatan Insiden — {editTarget.tanggal}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveEdit} className="space-y-4 mt-2">
              <div className="field">
                <label className="text-xs font-semibold block mb-1">Tanggal</label>
                <Input
                  type="date"
                  value={editForm.tanggal}
                  onChange={(e) => setEditForm({ ...editForm, tanggal: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label className="text-xs font-semibold block mb-1">Kategori Insiden</label>
                <Select
                  value={editForm.kategori}
                  onChange={(e) => setEditForm({ ...editForm, kategori: e.target.value })}
                >
                  <option value="ACCIDENT">Accident (Kecelakaan Kerja)</option>
                  <option value="NEAR_MISS">Near Miss (Hampir Celaka)</option>
                  <option value="FIRST_AID">First Aid (P3K)</option>
                </Select>
              </div>
              <div className="field">
                <label className="text-xs font-semibold block mb-1">Keterangan / Kronologi</label>
                <Input
                  type="text"
                  value={editForm.keterangan || ""}
                  onChange={(e) => setEditForm({ ...editForm, keterangan: e.target.value })}
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
                <h3 className="text-lg font-bold text-foreground">Hapus Catatan Insiden?</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Yakin ingin menghapus insiden safety tanggal <strong className="text-foreground">{deleteTarget.tanggal}</strong> ({deleteTarget.kategori})?
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
                <h3 className="text-lg font-bold text-foreground">Hapus {selectedIds.size} Catatan Insiden?</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Apakah Anda yakin ingin menghapus <strong className="text-foreground">{selectedIds.size} catatan insiden</strong> yang dipilih?
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
                K3 &amp; Keselamatan
              </span>
              Input Insiden Safety
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Pencatatan data insiden keselamatan kerja, accident, near miss, dan first aid di area produksi.
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

function SafetyTableSkeleton() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <tr key={i} className="animate-pulse select-none">
          <td className="p-3 text-center"><div className="h-4 w-4 bg-muted rounded mx-auto" /></td>
          <td className="p-3"><div className="h-4 bg-muted rounded w-24" /></td>
          <td className="p-3"><div className="h-5 bg-muted rounded w-20" /></td>
          <td className="p-3"><div className="h-4 bg-muted rounded w-48" /></td>
          <td className="p-3 text-center"><div className="h-7 w-20 bg-muted rounded mx-auto" /></td>
        </tr>
      ))}
    </>
  );
}
