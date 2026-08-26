"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
  const supabase = createClient();
  const [rows, setRows] = useState<ProdProductivityRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

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

  const fetchRows = async (targetPage = 0) => {
    if (targetPage > 0) setLoadingMore(true);
    else setLoading(true);

    try {
      const from = targetPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data } = await supabase
        .from("productivity_daily_reference")
        .select("tanggal, eh_jam")
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
  };

  useEffect(() => {
    fetchRows(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (!editForm.tanggal || editForm.eh_jam === "") {
      flash("Isi tanggal & Earned Hours dulu.", true);
      return;
    }
    setIsSavingEdit(true);
    const { error } = await supabase
      .from("productivity_daily_reference")
      .upsert(
        {
          tanggal: editForm.tanggal,
          eh_jam: Number(editForm.eh_jam),
          is_active: true,
        },
        { onConflict: "tanggal" }
      );
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
    const { error } = await supabase
      .from("productivity_daily_reference")
      .update({ is_active: false })
      .eq("tanggal", deleteTarget.tanggal);
    setIsDeleting(false);
    if (error) {
      flash("Gagal menghapus: " + error.message, true);
      return;
    }
    flash("Data Earned Hours " + deleteTarget.tanggal + " berhasil dihapus.");
    setDeleteTarget(null);
    await fetchRows(0);
  };

  const content = (
    <>
      <div className="page-header">
        <h1 className="page-title">
          <span className="eyebrow">Input</span>
          Earned Hours Harian
        </h1>
      </div>

      <p className="hint" style={{ marginBottom: "16px" }}>
        Working Hours utk Productivity sekarang otomatis dari Attendance + Overtime, tidak perlu diisi manual lagi.
        Earned Hours di sini bisa dipakai gantikan hitungan otomatis sistem selama masa transisi.
        Kalau tanggal tertentu <b>tidak diisi</b> di sini, sistem otomatis pakai rumus (Massprod + Semi + Non) seperti biasa.
      </p>

      <div className="space-y-6">
        <Card className="dash-panel card-glow-info">
          <p className="dash-panel-title">Isi Earned Hours</p>
          <div className="form-grid">
            <div className="field">
              <label>Tanggal</label>
              <Input
                type="date"
                value={form.tanggal}
                onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Earned Hours (jam)</label>
              <Input
                type="number"
                step="0.01"
                placeholder="mis. 154.98"
                value={form.eh_jam}
                onChange={(e) => setForm({ ...form, eh_jam: e.target.value })}
              />
            </div>
          </div>
          <div className="form-actions">
            <Button
              type="button"
              onClick={simpan}
              disabled={saving}
            >
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </Card>

        <Card className="dash-panel card-glow-info">
          <p className="dash-panel-title">
            Riwayat Input <span className="count">{rows.length} baris</span>
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Earned Hours (jam)</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <ProductivityTableSkeleton />
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="empty-state">
                      Belum ada input.
                    </td>
                  </tr>
                ) : (
                  rows.map((r, index) => (
                    <tr
                      key={r.tanggal || index}
                      className="animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-backwards"
                      style={{ animationDelay: `${Math.min(index * 25, 300)}ms` }}
                    >
                      <td className="mono">{fmtTgl(r.tanggal)}</td>
                      <td className="mono">{fmtNum(r.eh_jam)}</td>
                      <td className="flex gap-1">
                        <Button variant="secondary" size="sm" onClick={() => handleOpenEdit(r)}>
                          Edit
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(r)}>
                          Hapus
                        </Button>
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

      {/* Modal Edit Earned Hours */}
      {editTarget && (
        <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
          <DialogContent onClose={() => setEditTarget(null)} maxWidth="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Earned Hours — {fmtTgl(editTarget.tanggal)}</DialogTitle>
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
                  <label>Earned Hours (jam)</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="mis. 154.98"
                    value={editForm.eh_jam}
                    onChange={(e) => setEditForm({ ...editForm, eh_jam: e.target.value })}
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
              <DialogTitle>Hapus Earned Hours</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground mb-4">
              Yakin ingin menghapus data Earned Hours untuk tanggal{" "}
              <span className="font-semibold text-foreground">
                {fmtTgl(deleteTarget.tanggal)}
              </span>{" "}
              ({fmtNum(deleteTarget.eh_jam)} jam)?
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

function ProductivityTableSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="animate-pulse select-none">
          <td><div className="h-4 bg-muted rounded w-28" /></td>
          <td><div className="h-4 bg-muted rounded w-20" /></td>
          <td><div className="h-7 bg-muted rounded w-24" /></td>
        </tr>
      ))}
    </>
  );
}
