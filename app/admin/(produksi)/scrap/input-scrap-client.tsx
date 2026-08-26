"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
  const supabase = createClient();
  const [rows, setRows] = useState<ProdScrapRecord[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

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

  const fetchRows = async (targetPage = 0) => {
    if (targetPage > 0) setLoadingMore(true);
    else setLoading(true);

    try {
      const from = targetPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const res = await supabase
        .from("prod_scrap_top_end")
        .select("*")
        .eq("is_active", true)
        .order("tahun", { ascending: false })
        .order("bulan", { ascending: false })
        .range(from, to);
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
  };

  useEffect(() => {
    fetchRows(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setIsSavingEdit(true);
    const payload = {
      tahun: Number(editForm.tahun),
      bulan: Number(editForm.bulan),
      scrap_value_kidr: Number(editForm.scrap_value_kidr),
      total_value_kidr: Number(editForm.total_value_kidr),
      target_rasio: Number(editForm.target_rasio),
      is_active: true,
    };

    try {
      const res = await supabase
        .from("prod_scrap_top_end")
        .upsert(payload, { onConflict: "tahun,bulan" });
      if (res.error) throw res.error;

      flash("Data scrap diperbarui!");
      setEditTarget(null);
      fetchRows(0);
    } catch (err: any) {
      if (isNetworkError(err)) {
        enqueueOffline("prod_scrap_top_end", payload);
        setRows((prev) => [
          { ...payload, id: "pending_" + Date.now(), _pending: true },
          ...prev,
        ]);
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

      flash(`Data scrap periode ${deleteTarget.tahun}-${String(deleteTarget.bulan).padStart(2, "0")} berhasil dihapus.`);
      setDeleteTarget(null);
      fetchRows(0);
    } catch (err: any) {
      flash("Gagal menghapus: " + (err?.message || "Unknown error"), true);
    } finally {
      setIsDeleting(false);
    }
  };

  const content = (
    <>
      <div className="page-header">
        <h1 className="page-title">
          <span className="eyebrow">Input</span>
          Scrap Top End (Bulanan)
        </h1>
      </div>

      <div className="space-y-6">
        <Card className="dash-panel card-glow-info">
          <p className="dash-panel-title">Form Scrap Top End</p>
          <p className="hint" style={{ marginBottom: 12 }}>
            Satuan mengikuti laporan asli: <b>K IDR</b> (ribuan Rupiah).
          </p>
          <div className="form-grid">
            <div className="field">
              <label>Tahun</label>
              <Input type="number" min="2000" max="2100" value={form.tahun} onChange={(e) => setForm({ ...form, tahun: Number(e.target.value) })} />
            </div>
            <div className="field">
              <label>Bulan</label>
              <Select value={form.bulan} onChange={(e) => setForm({ ...form, bulan: Number(e.target.value) })}>
                {BULAN_OPTIONS.map((b, idx) => (
                  <option key={b} value={idx + 1}>{b}</option>
                ))}
              </Select>
            </div>
            <div className="field">
              <label>Scrap Value (K IDR)</label>
              <Input type="number" step="0.001" value={form.scrap_value_kidr} onChange={(e) => setForm({ ...form, scrap_value_kidr: Number(e.target.value) })} />
            </div>
            <div className="field">
              <label>Total Value (K IDR)</label>
              <Input type="number" step="0.001" value={form.total_value_kidr} onChange={(e) => setForm({ ...form, total_value_kidr: Number(e.target.value) })} />
            </div>
            <div className="field">
              <label>Target Rasio (mis. 0.0046)</label>
              <Input type="number" step="0.0001" value={form.target_rasio} onChange={(e) => setForm({ ...form, target_rasio: Number(e.target.value) })} />
            </div>
          </div>
          <div className="form-actions">
            <Button type="button" onClick={save}>
              Simpan Scrap
            </Button>
          </div>
        </Card>

        <Card className="dash-panel card-glow-info">
          <p className="dash-panel-title">
            Riwayat Scrap{" "}
            <span className="count">{rows.length} baris</span>
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Periode</th>
                  <th>Scrap (K IDR)</th>
                  <th>Total (K IDR)</th>
                  <th>Rasio</th>
                  <th>Target</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <ScrapTableSkeleton />
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="empty-state">Belum ada data scrap.</td>
                  </tr>
                ) : (
                  rows.map((r, index) => (
                    <tr
                      key={r.id || index}
                      className="animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-backwards"
                      style={{ animationDelay: `${Math.min(index * 25, 300)}ms` }}
                    >
                      <td className="mono">{r.tahun}-{String(r.bulan).padStart(2, "0")}</td>
                      <td className="mono">{fmtNum(r.scrap_value_kidr)}</td>
                      <td className="mono">{fmtNum(r.total_value_kidr)}</td>
                      <td className="mono">
                        {(r.total_value_kidr || 0) > 0
                          ? fmtNum(((r.scrap_value_kidr || 0) / r.total_value_kidr!) * 100) + "%"
                          : "-"}
                      </td>
                      <td className="mono">{fmtNum((r.target_rasio || 0) * 100)}%</td>
                      <td>
                        <div className="row-actions flex gap-1">
                          <Button variant="secondary" size="sm" onClick={() => handleOpenEdit(r)}>Edit</Button>
                          <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(r)}>Hapus</Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <div className="mt-3 text-center">
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
      </div>

      {/* Modal Edit Scrap */}
      {editTarget && (
        <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
          <DialogContent onClose={() => setEditTarget(null)} maxWidth="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Scrap — Periode {editTarget.tahun}-{String(editTarget.bulan).padStart(2, "0")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="form-grid">
                <div className="field">
                  <label>Tahun</label>
                  <Input
                    type="number"
                    min="2000"
                    max="2100"
                    value={editForm.tahun}
                    onChange={(e) => setEditForm({ ...editForm, tahun: Number(e.target.value) })}
                  />
                </div>
                <div className="field">
                  <label>Bulan</label>
                  <Select
                    value={editForm.bulan}
                    onChange={(e) => setEditForm({ ...editForm, bulan: Number(e.target.value) })}
                  >
                    {BULAN_OPTIONS.map((b, idx) => (
                      <option key={b} value={idx + 1}>{b}</option>
                    ))}
                  </Select>
                </div>
                <div className="field">
                  <label>Scrap Value (K IDR)</label>
                  <Input
                    type="number"
                    step="0.001"
                    value={editForm.scrap_value_kidr}
                    onChange={(e) => setEditForm({ ...editForm, scrap_value_kidr: Number(e.target.value) })}
                  />
                </div>
                <div className="field">
                  <label>Total Value (K IDR)</label>
                  <Input
                    type="number"
                    step="0.001"
                    value={editForm.total_value_kidr}
                    onChange={(e) => setEditForm({ ...editForm, total_value_kidr: Number(e.target.value) })}
                  />
                </div>
                <div className="field">
                  <label>Target Rasio (mis. 0.0046)</label>
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
                >
                  {isSavingEdit ? "Menyimpan..." : "Simpan Perubahan"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal Konfirmasi Hapus */}
      {deleteTarget && (
        <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
          <DialogContent onClose={() => setDeleteTarget(null)} maxWidth="max-w-md">
            <DialogHeader>
              <DialogTitle>Hapus Data Scrap</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground mb-4">
              Yakin ingin menghapus data Scrap periode{" "}
              <span className="font-semibold text-foreground">
                {deleteTarget.tahun}-{String(deleteTarget.bulan).padStart(2, "0")}
              </span>{" "}
              (Scrap: {fmtNum(deleteTarget.scrap_value_kidr)} K IDR, Total: {fmtNum(deleteTarget.total_value_kidr)} K IDR)?
              <br />
              <span className="text-red-400 text-xs mt-1 block">Tindakan ini tidak bisa dibatalkan.</span>
            </p>
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
              >
                {isDeleting ? "Menghapus…" : "Ya, Hapus"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );

  if (embedded) {
    return <div className="main animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ minHeight: 0 }}>{content}</div>;
  }

  return (
    <div className="app-shell">
      <main className="main max-w-6xl mx-auto w-full animate-in fade-in slide-in-from-bottom-2 duration-500">
        {/* Tombol Kembali ke Admin */}
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 self-start min-h-[44px] px-3 py-2 mb-3 text-xs font-semibold rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors touch-manipulation"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          Kembali ke Admin
        </Link>

        {content}
      </main>
    </div>
  );
}

function ScrapTableSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="animate-pulse select-none">
          <td><div className="h-4 bg-muted rounded w-20" /></td>
          <td><div className="h-4 bg-muted rounded w-20" /></td>
          <td><div className="h-4 bg-muted rounded w-20" /></td>
          <td><div className="h-4 bg-muted rounded w-16" /></td>
          <td><div className="h-4 bg-muted rounded w-16" /></td>
          <td><div className="h-7 bg-muted rounded w-24" /></td>
        </tr>
      ))}
    </>
  );
}
