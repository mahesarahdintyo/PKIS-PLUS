"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ThumbsUp, ArrowLeft } from "lucide-react";
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
  const supabase = createClient();
  const [rows, setRows] = useState<ProdSafetyRecord[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

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

  const fetchRows = async (targetPage = 0) => {
    if (targetPage > 0) setLoadingMore(true);
    else setLoading(true);

    try {
      const from = targetPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const res = await supabase
        .from("prod_safety_log")
        .select("*")
        .eq("is_active", true)
        .order("tanggal", { ascending: false })
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
      fetchRows(0);
    } catch (err: any) {
      flash("Gagal menghapus: " + (err?.message || "Unknown error"), true);
    } finally {
      setIsDeleting(false);
    }
  };

  const badgeKategori = (k: string) => {
    if (k === "ACCIDENT") return { background: "rgba(209,69,75,0.12)", color: "var(--red, #d1454b)" };
    if (k === "NEAR_MISS") return { background: "rgba(201,130,15,0.12)", color: "var(--amber, #c9820f)" };
    return { background: "var(--panel-2, #f8fafc)", color: "var(--muted-foreground, #64748b)" };
  };

  const content = (
    <div className="space-y-6">
      <Card className="dash-panel card-glow-info">
        <p className="dash-panel-title">Catat Insiden</p>
        <p className="hint" style={{ marginBottom: 12 }}>
          Kalau tidak ada insiden, tidak perlu diisi — dashboard otomatis menghitung &quot;hari tanpa kecelakaan&quot;.
        </p>
        <div className="form-grid">
          <div className="field">
            <label>Tanggal</label>
            <Input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} />
          </div>
          <div className="field">
            <label>Kategori</label>
            <Select value={form.kategori} onChange={(e) => setForm({ ...form, kategori: e.target.value })}>
              <option value="ACCIDENT">Accident (kecelakaan kerja)</option>
              <option value="NEAR_MISS">Near Miss (hampir celaka)</option>
              <option value="OTHER">Lainnya</option>
            </Select>
          </div>
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label>Keterangan</label>
            <Input
              type="text"
              placeholder="Kronologi singkat..."
              value={form.keterangan}
              onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
            />
          </div>
        </div>
        <div className="form-actions">
          <Button type="button" onClick={save}>
            Simpan Insiden
          </Button>
        </div>
      </Card>

      <Card className="dash-panel card-glow-info">
        <p className="dash-panel-title">
          Riwayat Insiden{" "}
          <span className="count">{rows.length} baris</span>
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Kategori</th>
                <th>Keterangan</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SafetyTableSkeleton />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="empty-state">
                    Tidak ada insiden tercatat. <ThumbsUp size={14} style={{ display: "inline", verticalAlign: "middle", marginLeft: 4 }} />
                  </td>
                </tr>
              ) : (
                rows.map((r, index) => (
                  <tr
                    key={r.id || index}
                    className="animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-backwards"
                    style={{ animationDelay: `${Math.min(index * 25, 300)}ms` }}
                  >
                    <td className="mono">{r.tanggal}</td>
                    <td>
                      <span className="badge" style={badgeKategori(r.kategori || "")}>
                        {r.kategori}
                      </span>
                    </td>
                    <td>{r.keterangan || "-"}</td>
                    <td>
                      <div className="row-actions flex gap-1">
                        <Button variant="secondary" size="sm" onClick={() => handleOpenEdit(r)}>
                          Edit
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(r)}>
                          Hapus
                        </Button>
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

      {/* Modal Edit Insiden */}
      {editTarget && (
        <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
          <DialogContent onClose={() => setEditTarget(null)} maxWidth="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Insiden — {editTarget.tanggal}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="form-grid">
                <div className="field">
                  <label>Tanggal</label>
                  <Input
                    type="date"
                    value={editForm.tanggal}
                    onChange={(e) => setEditForm({ ...editForm, tanggal: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Kategori</label>
                  <Select
                    value={editForm.kategori}
                    onChange={(e) => setEditForm({ ...editForm, kategori: e.target.value })}
                  >
                    <option value="ACCIDENT">Accident (kecelakaan kerja)</option>
                    <option value="NEAR_MISS">Near Miss (hampir celaka)</option>
                    <option value="OTHER">Lainnya</option>
                  </Select>
                </div>
                <div className="field" style={{ gridColumn: "1 / -1" }}>
                  <label>Keterangan</label>
                  <Input
                    type="text"
                    placeholder="Kronologi singkat..."
                    value={editForm.keterangan || ""}
                    onChange={(e) => setEditForm({ ...editForm, keterangan: e.target.value })}
                    autoFocus
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
              <DialogTitle>Hapus Data Insiden</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground mb-4">
              Yakin ingin menghapus data insiden tanggal{" "}
              <span className="font-semibold text-foreground">
                {deleteTarget.tanggal}
              </span>{" "}
              (Kategori: {deleteTarget.kategori}
              {deleteTarget.keterangan ? `, "${deleteTarget.keterangan}"` : ""})?
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
    </div>
  );

  if (embedded) {
    return (
      <div className="main animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ minHeight: 0 }}>
        <div className="page-header">
          <h1 className="page-title">
            <span className="eyebrow">Input</span>
            Safety / Insiden
          </h1>
        </div>
        {content}
      </div>
    );
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

        <div className="page-header">
          <h1 className="page-title">
            <span className="eyebrow">Input</span>
            Safety / Insiden
          </h1>
        </div>

        {content}
      </main>
    </div>
  );
}

function SafetyTableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="animate-pulse select-none">
          <td><div className="h-4 bg-muted rounded w-24" /></td>
          <td><div className="h-5 bg-muted rounded w-20" /></td>
          <td><div className="h-4 bg-muted rounded w-48" /></td>
          <td><div className="h-7 bg-muted rounded w-16" /></td>
        </tr>
      ))}
    </>
  );
}
