"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ProdAttendanceRecord } from "@/types/produksi";
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
  return Number(n).toLocaleString("en-US", { maximumFractionDigits: 1 });
}

interface Props {
  userId: string;
  embedded?: boolean;
}

const PAGE_SIZE = 60;

export default function InputAttendanceClient({ userId: initialUserId, embedded }: Props) {
  const supabase = createClient();
  const [rows, setRows] = useState<ProdAttendanceRecord[]>([]);
  const [userId] = useState<string | null>(initialUserId || null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // State untuk Dialog Edit
  const [editTarget, setEditTarget] = useState<ProdAttendanceRecord | null>(null);
  const [editForm, setEditForm] = useState<ProdAttendanceRecord>({
    tanggal: new Date().toISOString().split("T")[0],
    shift: 1,
    total_orang: 0,
    hadir: 0,
    cuti: 0,
    absen: 0,
    overtime_jam: 0,
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // State untuk Dialog Hapus
  const [deleteTarget, setDeleteTarget] = useState<ProdAttendanceRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState<ProdAttendanceRecord>({
    tanggal: today,
    shift: 1,
    total_orang: 0,
    hadir: 0,
    cuti: 0,
    absen: 0,
    overtime_jam: 0,
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
        .from("prod_attendance_log")
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
      shift: Number(form.shift),
      total_orang: Number(form.total_orang),
      hadir: Number(form.hadir),
      cuti: Number(form.cuti),
      absen: Number(form.absen),
      overtime_jam: Number(form.overtime_jam),
      updated_by: userId,
      is_active: true,
    };

    try {
      const res = await supabase
        .from("prod_attendance_log")
        .upsert(payload, { onConflict: "tanggal,shift" });
      if (res.error) throw res.error;

      flash("Absensi berhasil disimpan!");
      setForm({ tanggal: today, shift: 1, total_orang: 0, hadir: 0, cuti: 0, absen: 0, overtime_jam: 0 });
      fetchRows(0);
    } catch (err: any) {
      if (isNetworkError(err)) {
        enqueueOffline("prod_attendance_log", payload);
        setRows((prev) => [
          { ...payload, id: "pending_" + Date.now(), _pending: true },
          ...prev,
        ]);
        setForm({ tanggal: today, shift: 1, total_orang: 0, hadir: 0, cuti: 0, absen: 0, overtime_jam: 0 });
      } else {
        flash("Gagal menyimpan: " + (err?.message || "Unknown error"), true);
      }
    }
  };

  const handleOpenEdit = (r: ProdAttendanceRecord) => {
    setEditTarget(r);
    setEditForm({ ...r });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget?.id) return;
    setIsSavingEdit(true);
    const payload = {
      tanggal: editForm.tanggal,
      shift: Number(editForm.shift),
      total_orang: Number(editForm.total_orang),
      hadir: Number(editForm.hadir),
      cuti: Number(editForm.cuti),
      absen: Number(editForm.absen),
      overtime_jam: Number(editForm.overtime_jam),
      updated_by: userId,
    };

    try {
      const res = await supabase
        .from("prod_attendance_log")
        .update(payload)
        .eq("id", editTarget.id)
        .select();
      if (res.error) throw res.error;
      if (!res.data || res.data.length === 0) {
        throw new Error("Tidak ada baris yang diperbarui (data tidak ditemukan atau izin RLS ditolak).");
      }

      flash("Data absensi diperbarui!");
      setEditTarget(null);
      fetchRows(0);
    } catch (err: any) {
      if (isNetworkError(err)) {
        enqueueOffline("prod_attendance_log", { ...payload, id: editTarget.id, is_active: true });
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
      let q = supabase.from("prod_attendance_log").update({ is_active: false }).eq("tanggal", deleteTarget.tanggal);
      if (deleteTarget.shift !== undefined) {
        q = q.eq("shift", deleteTarget.shift);
      }
      const { error } = await q;
      if (error) throw error;

      flash(`Data absensi tanggal ${deleteTarget.tanggal} (Shift ${deleteTarget.shift}) berhasil dihapus.`);
      setDeleteTarget(null);
      fetchRows(0);
    } catch (err: any) {
      flash("Gagal menghapus: " + (err?.message || "Unknown error"), true);
    } finally {
      setIsDeleting(false);
    }
  };

  const innerContent = (
    <div className="space-y-6">
      <Card className="dash-panel card-glow-info">
        <p className="dash-panel-title">Form Absensi</p>
        <div className="form-grid">
          <div className="field">
            <label>Tanggal</label>
            <Input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} />
          </div>
          <div className="field">
            <label>Shift</label>
            <Select value={form.shift} onChange={(e) => setForm({ ...form, shift: Number(e.target.value) })}>
              <option value={1}>Shift 1</option>
              <option value={2}>Shift 2</option>
            </Select>
          </div>
          <div className="field">
            <label>Total Orang</label>
            <Input type="number" value={form.total_orang} onChange={(e) => setForm({ ...form, total_orang: Number(e.target.value) })} />
          </div>
          <div className="field">
            <label>Hadir</label>
            <Input type="number" value={form.hadir} onChange={(e) => setForm({ ...form, hadir: Number(e.target.value) })} />
          </div>
          <div className="field">
            <label>Cuti</label>
            <Input type="number" value={form.cuti} onChange={(e) => setForm({ ...form, cuti: Number(e.target.value) })} />
          </div>
          <div className="field">
            <label>Absen</label>
            <Input type="number" value={form.absen} onChange={(e) => setForm({ ...form, absen: Number(e.target.value) })} />
          </div>
          <div className="field">
            <label>Overtime (jam)</label>
            <Input type="number" step="0.5" value={form.overtime_jam} onChange={(e) => setForm({ ...form, overtime_jam: Number(e.target.value) })} />
          </div>
        </div>
        <div className="form-actions">
          <Button type="button" onClick={save}>
            Simpan Absensi
          </Button>
        </div>
      </Card>

      <Card className="dash-panel card-glow-info">
        <p className="dash-panel-title">
          Riwayat Absensi{" "}
          <span className="count">{rows.length} baris</span>
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Shift</th>
                <th>Total</th>
                <th>Hadir</th>
                <th>Cuti</th>
                <th>Absen</th>
                <th>OT (jam)</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <AttendanceTableSkeleton />
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty-state">Belum ada data absensi.</td>
                </tr>
              ) : (
                rows.map((r, index) => (
                  <tr
                    key={r.id || index}
                    className="animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-backwards"
                    style={{ animationDelay: `${Math.min(index * 25, 300)}ms` }}
                  >
                    <td className="mono">{r.tanggal}</td>
                    <td>Shift {r.shift}</td>
                    <td className="mono">{fmtNum(r.total_orang)}</td>
                    <td className="mono">{fmtNum(r.hadir)}</td>
                    <td className="mono">{fmtNum(r.cuti)}</td>
                    <td className="mono">{fmtNum(r.absen)}</td>
                    <td className="mono">{fmtNum(r.overtime_jam)}</td>
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

      {/* Modal Edit Absensi */}
      {editTarget && (
        <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
          <DialogContent onClose={() => setEditTarget(null)} maxWidth="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Absensi — {editTarget.tanggal} (Shift {editTarget.shift})</DialogTitle>
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
                  <label>Shift</label>
                  <Select
                    value={editForm.shift}
                    onChange={(e) => setEditForm({ ...editForm, shift: Number(e.target.value) })}
                  >
                    <option value={1}>Shift 1</option>
                    <option value={2}>Shift 2</option>
                  </Select>
                </div>
                <div className="field">
                  <label>Total Orang</label>
                  <Input
                    type="number"
                    value={editForm.total_orang}
                    onChange={(e) => setEditForm({ ...editForm, total_orang: Number(e.target.value) })}
                  />
                </div>
                <div className="field">
                  <label>Hadir</label>
                  <Input
                    type="number"
                    value={editForm.hadir}
                    onChange={(e) => setEditForm({ ...editForm, hadir: Number(e.target.value) })}
                  />
                </div>
                <div className="field">
                  <label>Cuti</label>
                  <Input
                    type="number"
                    value={editForm.cuti}
                    onChange={(e) => setEditForm({ ...editForm, cuti: Number(e.target.value) })}
                  />
                </div>
                <div className="field">
                  <label>Absen</label>
                  <Input
                    type="number"
                    value={editForm.absen}
                    onChange={(e) => setEditForm({ ...editForm, absen: Number(e.target.value) })}
                  />
                </div>
                <div className="field">
                  <label>Overtime (jam)</label>
                  <Input
                    type="number"
                    step="0.5"
                    value={editForm.overtime_jam}
                    onChange={(e) => setEditForm({ ...editForm, overtime_jam: Number(e.target.value) })}
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
              <DialogTitle>Hapus Data Absensi</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground mb-4">
              Yakin ingin menghapus data absensi tanggal{" "}
              <span className="font-semibold text-foreground">
                {deleteTarget.tanggal}
              </span>{" "}
              (Shift {deleteTarget.shift}, Hadir: {fmtNum(deleteTarget.hadir)}/{fmtNum(deleteTarget.total_orang)})?
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
            Attendance Harian
          </h1>
        </div>
        {innerContent}
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
            Attendance Harian
          </h1>
        </div>

        {innerContent}
      </main>
    </div>
  );
}

function AttendanceTableSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="animate-pulse select-none">
          <td><div className="h-4 bg-muted rounded w-20" /></td>
          <td><div className="h-4 bg-muted rounded w-14" /></td>
          <td><div className="h-4 bg-muted rounded w-10" /></td>
          <td><div className="h-4 bg-muted rounded w-10" /></td>
          <td><div className="h-4 bg-muted rounded w-10" /></td>
          <td><div className="h-4 bg-muted rounded w-10" /></td>
          <td><div className="h-4 bg-muted rounded w-12" /></td>
          <td><div className="h-7 bg-muted rounded w-24" /></td>
        </tr>
      ))}
    </>
  );
}
