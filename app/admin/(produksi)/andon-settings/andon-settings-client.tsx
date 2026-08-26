"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ProdProfile } from "@/types/produksi";
import { useAndonAlerts, useAndonLeaders, andonSubscribePush, AndonCall } from "@/hooks/produksi/useAndon";
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

const MESIN_LABELS: Record<string, string> = {
  blanking: "Blanking",
  pc200t: "PC200t",
  tandem: "Tandem",
  transfer_2000t: "Transfer 2000t",
  transfer_800t: "Transfer 800t",
};

const MESIN_OPTIONS: [string, string][] = [
  ["blanking", "Blanking"],
  ["pc200t", "PC200t"],
  ["tandem", "Tandem"],
  ["transfer_2000t", "Transfer 2000t"],
  ["transfer_800t", "Transfer 800t"],
];

interface Props {
  userId: string;
  role: string;
  embedded?: boolean;
}

export default function AndonSettingsClient({ userId, role, embedded }: Props) {
  const supabase = createClient();
  const isLeaderOrAdmin = ["admin", "leader"].includes(role);

  const { activeCalls, acknowledgeCall } = useAndonAlerts(!!isLeaderOrAdmin);
  const { myLeaders, daftarLeader, hapusLeader } = useAndonLeaders(userId);
  const [leaderForm, setLeaderForm] = useState<{ mesin: string; tier: 1 | 2 }>({ mesin: "tandem", tier: 1 });

  const handleDaftarLeader = async () => {
    const { error } = await daftarLeader(leaderForm.mesin, leaderForm.tier);
    if (error) toast.error(`Gagal: ${error}`);
    else toast.success("Berhasil didaftarkan sebagai leader.");
  };

  const [loadingPush, setLoadingPush] = useState(false);

  const handleDaftarkanHp = async () => {
    setLoadingPush(true);
    const result = await andonSubscribePush(userId);
    if (result.ok) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
    setLoadingPush(false);
  };

  const [history, setHistory] = useState<AndonCall[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // State untuk Dialog Edit Riwayat Panggilan
  const [editTarget, setEditTarget] = useState<AndonCall | null>(null);
  const [editForm, setEditForm] = useState<{
    mesin: string;
    stasiun: string;
    alasan: string;
    status: "pending" | "acknowledged" | "escalated";
  }>({
    mesin: "tandem",
    stasiun: "",
    alasan: "",
    status: "pending",
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // State untuk Dialog Hapus Riwayat Panggilan
  const [deleteTarget, setDeleteTarget] = useState<AndonCall | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const PAGE_SIZE = 100;

  const fetchHistory = useCallback(async (targetPage = 0) => {
    if (targetPage > 0) setLoadingMore(true);
    else setLoadingHistory(true);

    const from = targetPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data } = await supabase
      .from("andon_calls")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (data) {
      if (targetPage === 0) {
        setHistory((data as AndonCall[]) || []);
      } else {
        setHistory((prev) => [...prev, ...((data as AndonCall[]) || [])]);
      }
      setHasMore(data.length === PAGE_SIZE);
    }
    setPage(targetPage);
    if (targetPage > 0) setLoadingMore(false);
    else setLoadingHistory(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isLeaderOrAdmin) fetchHistory(0);
  }, [isLeaderOrAdmin, fetchHistory]);

  // Refresh riwayat setiap ada panggilan aktif berubah
  useEffect(() => {
    if (isLeaderOrAdmin) fetchHistory(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCalls.length]);

  const handleOpenEdit = (c: AndonCall) => {
    setEditTarget(c);
    setEditForm({
      mesin: c.mesin || "tandem",
      stasiun: c.stasiun || "",
      alasan: c.alasan || "",
      status: c.status || "pending",
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget?.id) return;
    setIsSavingEdit(true);
    const payload = {
      mesin: editForm.mesin,
      stasiun: editForm.stasiun.trim() || null,
      alasan: editForm.alasan.trim() || null,
      status: editForm.status,
    };
    try {
      const { error } = await supabase
        .from("andon_calls")
        .update(payload)
        .eq("id", editTarget.id);
      if (error) throw error;
      toast.success("Riwayat panggilan diperbarui!");
      setEditTarget(null);
      fetchHistory(0);
    } catch (err: any) {
      toast.error("Gagal menyimpan: " + (err?.message || "Unknown error"));
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from("andon_calls")
        .delete()
        .eq("id", deleteTarget.id);
      if (error) throw error;
      toast.success("Riwayat panggilan berhasil dihapus.");
      setDeleteTarget(null);
      fetchHistory(0);
    } catch (err: any) {
      toast.error("Gagal menghapus: " + (err?.message || "Unknown error"));
    } finally {
      setIsDeleting(false);
    }
  };

  const andonContent = (
    <>
      <div className="page-header">
        <h1 className="page-title">
          <span className="eyebrow">Andon</span>
          Panggilan Leader
        </h1>
      </div>

      {!isLeaderOrAdmin && (
        <div className="error-msg">Halaman ini khusus admin/leader.</div>
      )}

      {isLeaderOrAdmin && (
        <div className="space-y-6">
          <Card className="dash-panel card-glow-info">
            <p className="dash-panel-title">1. Aktifkan Notifikasi di HP ini</p>
            <p className="hint" style={{ marginBottom: 14 }}>
              Wajib dilakukan di TIAP HP yang mau menerima panggilan Andon (getar + bunyi walau app tertutup).
              Kalau ganti HP, ulangi langkah ini di HP yang baru.
            </p>
            <Button type="button" onClick={handleDaftarkanHp} disabled={loadingPush}>
              {loadingPush ? "Mendaftarkan..." : "🔔 Aktifkan Notifikasi di HP ini"}
            </Button>
          </Card>

          <Card className="dash-panel card-glow-info">
            <p className="dash-panel-title">2. Line yang Saya Lead</p>
            <p className="hint" style={{ marginBottom: 14 }}>
              Pilih line yang Anda tanggung jawab. <b>Tier 1</b> = dipanggil pertama kali.
              <b> Tier 2</b> = eskalasi, dipanggil kalau tier 1 tidak merespon dalam 5 menit.
            </p>
            <div className="form-grid">
              <div className="field">
                <label>Line</label>
                <Select
                  value={leaderForm.mesin}
                  onChange={(e) => setLeaderForm((f) => ({ ...f, mesin: e.target.value }))}
                >
                  {MESIN_OPTIONS.map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </Select>
              </div>
              <div className="field">
                <label>Tier</label>
                <Select
                  value={leaderForm.tier}
                  onChange={(e) => setLeaderForm((f) => ({ ...f, tier: Number(e.target.value) as 1 | 2 }))}
                >
                  <option value={1}>Tier 1 (utama)</option>
                  <option value={2}>Tier 2 (eskalasi)</option>
                </Select>
              </div>
            </div>
            <div className="form-actions">
              <Button type="button" onClick={handleDaftarLeader}>
                Tambah Pendaftaran
              </Button>
            </div>

            <div className="table-wrap" style={{ marginTop: 16 }}>
              <table>
                <thead>
                  <tr><th>Line</th><th>Tier</th><th>Aksi</th></tr>
                </thead>
                <tbody>
                  {myLeaders.map((r, rIdx) => (
                    <tr
                      key={r.id}
                      className="animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-backwards"
                      style={{ animationDelay: `${Math.min(rIdx * 25, 300)}ms` }}
                    >
                      <td>{MESIN_LABELS[r.mesin] || r.mesin}</td>
                      <td><span className="badge">Tier {r.tier}</span></td>
                      <td>
                        <Button variant="destructive" size="sm" onClick={() => hapusLeader(r.id)}>Hapus</Button>
                      </td>
                    </tr>
                  ))}
                  {myLeaders.length === 0 && (
                    <tr>
                      <td colSpan={3} className="empty-state">Belum terdaftar sebagai leader line manapun.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="dash-panel card-glow-info">
            <p className="dash-panel-title">
              Panggilan Aktif <span className="count">{activeCalls.length} baris</span>
            </p>
            <p className="hint" style={{ marginBottom: 12 }}>
              Notifikasi realtime muncul otomatis di semua halaman selama app terbuka.
              Push notification browser (saat app tertutup) belum aktif.
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Waktu</th>
                    <th>Line / Mesin</th>
                    <th>Stasiun</th>
                    <th>Alasan</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {activeCalls.map((c, cIdx) => (
                    <tr
                      key={c.id}
                      className="animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-backwards"
                      style={{ animationDelay: `${Math.min(cIdx * 25, 300)}ms` }}
                    >
                      <td className="mono">{new Date(c.created_at).toLocaleString("id-ID")}</td>
                      <td>{c.line_name || MESIN_LABELS[c.mesin] || c.mesin}</td>
                      <td>{c.stasiun || "-"}</td>
                      <td>{c.alasan || "-"}</td>
                      <td>
                        <span className={`badge ${c.status === "escalated" ? "role-admin" : ""}`}>
                          {c.status === "escalated" ? "Eskalasi" : "Menunggu"}
                        </span>
                      </td>
                      <td>
                        <Button size="sm" onClick={() => acknowledgeCall(c.id, userId)}>
                          Terima
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {activeCalls.length === 0 && (
                    <tr>
                      <td colSpan={6} className="empty-state">
                        Tidak ada panggilan aktif. 👍
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="dash-panel card-glow-info">
            <p className="dash-panel-title">
              Riwayat Panggilan <span className="count">{history.length} baris</span>
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Waktu</th>
                    <th>Line / Mesin</th>
                    <th>Stasiun</th>
                    <th>Alasan</th>
                    <th>Status</th>
                    <th>Diterima</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingHistory ? (
                    <AndonHistoryTableSkeleton />
                  ) : history.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="empty-state">
                        Belum ada riwayat panggilan.
                      </td>
                    </tr>
                  ) : (
                    history.map((c, hIdx) => (
                      <tr
                        key={c.id}
                        className="animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-backwards"
                        style={{ animationDelay: `${Math.min(hIdx * 20, 300)}ms` }}
                      >
                        <td className="mono">{new Date(c.created_at).toLocaleString("id-ID")}</td>
                        <td>{c.line_name || MESIN_LABELS[c.mesin] || c.mesin}</td>
                        <td>{c.stasiun || "-"}</td>
                        <td>{c.alasan || "-"}</td>
                        <td>
                          <span className={`badge ${c.status !== "acknowledged" ? "role-admin" : ""}`}>
                            {c.status === "pending" ? "Menunggu" : c.status === "escalated" ? "Eskalasi" : "Diterima"}
                          </span>
                        </td>
                        <td className="mono">
                          {c.acknowledged_at ? new Date(c.acknowledged_at).toLocaleString("id-ID") : "-"}
                        </td>
                        <td>
                          <div className="row-actions flex gap-1">
                            <Button variant="secondary" size="sm" onClick={() => handleOpenEdit(c)}>
                              Edit
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => setDeleteTarget(c)}>
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
                  onClick={() => fetchHistory(page + 1)}
                >
                  {loadingMore ? "Memuat..." : "Muat Lebih Banyak"}
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Modal Edit Riwayat Panggilan */}
      {editTarget && (
        <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
          <DialogContent onClose={() => setEditTarget(null)} maxWidth="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Riwayat Panggilan — {new Date(editTarget.created_at).toLocaleString("id-ID")}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="form-grid">
                <div className="field">
                  <label>Line / Mesin</label>
                  <Select
                    value={editForm.mesin}
                    onChange={(e) => setEditForm({ ...editForm, mesin: e.target.value })}
                  >
                    {MESIN_OPTIONS.map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </Select>
                </div>
                <div className="field">
                  <label>Status</label>
                  <Select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value as any })}
                  >
                    <option value="pending">Menunggu</option>
                    <option value="escalated">Eskalasi</option>
                    <option value="acknowledged">Diterima</option>
                  </Select>
                </div>
                <div className="field">
                  <label>Stasiun</label>
                  <Input
                    type="text"
                    placeholder="mis. PA-1 / PC-1 (opsional)"
                    value={editForm.stasiun}
                    onChange={(e) => setEditForm({ ...editForm, stasiun: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Alasan / Keterangan</label>
                  <Input
                    type="text"
                    placeholder="mis. Dies macet, Butuh bantuan"
                    value={editForm.alasan}
                    onChange={(e) => setEditForm({ ...editForm, alasan: e.target.value })}
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

      {/* Modal Konfirmasi Hapus Riwayat Panggilan */}
      {deleteTarget && (
        <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
          <DialogContent onClose={() => setDeleteTarget(null)} maxWidth="max-w-md">
            <DialogHeader>
              <DialogTitle>Hapus Riwayat Panggilan</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground mb-4">
              Yakin ingin menghapus panggilan Andon untuk line{" "}
              <span className="font-semibold text-foreground">
                {deleteTarget.line_name || MESIN_LABELS[deleteTarget.mesin] || deleteTarget.mesin}
              </span>{" "}
              pada {new Date(deleteTarget.created_at).toLocaleString("id-ID")}
              {deleteTarget.alasan ? ` (Alasan: "${deleteTarget.alasan}")` : ""}?
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
    return <div className="main animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ minHeight: 0 }}>{andonContent}</div>;
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

        {andonContent}
      </main>
    </div>
  );
}

function AndonHistoryTableSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="animate-pulse select-none">
          <td><div className="h-4 bg-muted rounded w-28" /></td>
          <td><div className="h-4 bg-muted rounded w-24" /></td>
          <td><div className="h-4 bg-muted rounded w-16" /></td>
          <td><div className="h-4 bg-muted rounded w-32" /></td>
          <td><div className="h-5 bg-muted rounded w-16" /></td>
          <td><div className="h-4 bg-muted rounded w-28" /></td>
          <td><div className="h-7 bg-muted rounded w-24" /></td>
        </tr>
      ))}
    </>
  );
}
