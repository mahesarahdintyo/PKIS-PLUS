"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ProdProfile } from "@/types/produksi";
import { useAndonAlerts, useAndonLeaders, andonSubscribePush, AndonCall } from "@/hooks/produksi/useAndon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
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

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    const { data } = await supabase
      .from("andon_calls")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setHistory((data as AndonCall[]) || []);
    setLoadingHistory(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isLeaderOrAdmin) fetchHistory();
  }, [isLeaderOrAdmin, fetchHistory]);

  // Refresh riwayat setiap ada panggilan aktif berubah
  useEffect(() => {
    if (isLeaderOrAdmin) fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCalls.length]);

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
        <div>
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
                  {myLeaders.map((r) => (
                    <tr key={r.id}>
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
                    <th>Mesin</th>
                    <th>Stasiun</th>
                    <th>Alasan</th>
                    <th>Status</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {activeCalls.map((c) => (
                    <tr key={c.id}>
                      <td className="mono">{new Date(c.created_at).toLocaleString("id-ID")}</td>
                      <td>{MESIN_LABELS[c.mesin] || c.mesin}</td>
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
                    <th>Mesin</th>
                    <th>Stasiun</th>
                    <th>Alasan</th>
                    <th>Status</th>
                    <th>Diterima</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((c) => (
                    <tr key={c.id}>
                      <td className="mono">{new Date(c.created_at).toLocaleString("id-ID")}</td>
                      <td>{MESIN_LABELS[c.mesin] || c.mesin}</td>
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
                    </tr>
                  ))}
                  {!loadingHistory && history.length === 0 && (
                    <tr>
                      <td colSpan={6} className="empty-state">
                        Belum ada riwayat panggilan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </>
  );

  if (embedded) {
    return <div className="main" style={{ minHeight: 0 }}>{andonContent}</div>;
  }

  return (
    <div className="app-shell">
      <main className="main">
        {/* Tombol Kembali ke Admin */}
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 mb-3 text-xs font-semibold rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors touch-manipulation"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          Kembali ke Admin
        </Link>

        {andonContent}
      </main>
    </div>
  );
}
