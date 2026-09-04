"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, Plus, Pencil, Trash2, Search, Filter, AlertTriangle, Bell, PhoneCall, Volume2, VolumeX } from "lucide-react";
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

// Web Audio API Synthesizer untuk nada alarm industri Andon (dual-tone beeps)
function playAndonAlarmBeep(audioCtx: AudioContext) {
  try {
    const now = audioCtx.currentTime;

    // Beep 1 (Frekuensi 880 Hz - nada A5 tegas)
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.0001, now);
    gain1.gain.exponentialRampToValueAtTime(0.35, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc1.start(now);
    osc1.stop(now + 0.17);

    // Beep 2 (Frekuensi 1174.66 Hz - nada D6 darurat lebih tinggi)
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1174.66, now + 0.18);
    gain2.gain.setValueAtTime(0.0001, now + 0.18);
    gain2.gain.exponentialRampToValueAtTime(0.4, now + 0.20);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    osc2.start(now + 0.18);
    osc2.stop(now + 0.39);
  } catch (err) {
    console.warn("Audio alarm warning:", err);
  }
}

// Getaran perangkat jika didukung oleh browser/OS (smartphone/tablet Android)
function triggerAndonVibration() {
  if (typeof window !== "undefined" && typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate([350, 150, 350]);
    } catch {
      // Abaikan jika ditolak oleh OS/browser
    }
  }
}

function stopAndonVibration() {
  if (typeof window !== "undefined" && typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(0);
    } catch {}
  }
}

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
  const supabase = useMemo(() => createClient(), []);
  const isLeaderOrAdmin = ["admin", "leader"].includes(role);

  const { activeCalls, acknowledgeCall } = useAndonAlerts(!!isLeaderOrAdmin);
  const { myLeaders, daftarLeader, hapusLeader } = useAndonLeaders(userId);
  const [leaderForm, setLeaderForm] = useState<{ mesin: string; tier: 1 | 2 }>({ mesin: "tandem", tier: 1 });

  // Alarm State (Loop audio & getaran terus-menerus sampai leader menekan tombol terima panggilan)
  const [isAlarmMuted, setIsAlarmMuted] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    // Jika tidak ada panggilan aktif yang pending/escalated, pastikan getaran berhenti
    if (activeCalls.length === 0) {
      stopAndonVibration();
      return;
    }

    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass && !audioCtxRef.current) {
        audioCtxRef.current = new AudioCtxClass();
      }
    } catch (e) {
      console.warn("Web Audio API not supported:", e);
    }

    const fireAlert = () => {
      // 1. Getaran berulang
      triggerAndonVibration();

      // 2. Suara alarm berulang
      if (!isAlarmMuted && audioCtxRef.current) {
        const ctx = audioCtxRef.current;
        if (ctx.state === "suspended") {
          ctx.resume().then(() => {
            playAndonAlarmBeep(ctx);
          }).catch(() => {});
        } else if (ctx.state === "running") {
          playAndonAlarmBeep(ctx);
        }
      }
    };

    // Bunyikan langsung saat panggilan aktif masuk
    fireAlert();

    // Loop berulang setiap 1.5 detik sampai leader menekan terima panggilan
    const intervalId = setInterval(fireAlert, 1500);

    // Auto-resume AudioContext saat pengguna mengklik/menyentuh layar jika dibatasi autoplay policy browser
    const handleUnlockAudio = () => {
      if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume().then(() => {
          if (!isAlarmMuted && audioCtxRef.current) {
            playAndonAlarmBeep(audioCtxRef.current);
          }
        }).catch(() => {});
      }
    };
    window.addEventListener("pointerdown", handleUnlockAudio, { passive: true });
    window.addEventListener("keydown", handleUnlockAudio, { passive: true });

    return () => {
      clearInterval(intervalId);
      stopAndonVibration();
      window.removeEventListener("pointerdown", handleUnlockAudio);
      window.removeEventListener("keydown", handleUnlockAudio);
    };
  }, [activeCalls.length, isAlarmMuted]);

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

  // Riwayat State
  const [history, setHistory] = useState<AndonCall[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filters & Search
  const [filterMesin, setFilterMesin] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Bulk Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState("");

  // Create Manual Call Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<{
    mesin: string;
    stasiun: string;
    alasan: string;
  }>({
    mesin: "tandem",
    stasiun: "",
    alasan: "",
  });
  const [isSavingCreate, setIsSavingCreate] = useState(false);
  const [createError, setCreateError] = useState("");

  // Edit Modal State
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
  const [editError, setEditError] = useState("");

  // Delete Single Modal State
  const [deleteTarget, setDeleteTarget] = useState<AndonCall | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const PAGE_SIZE = 100;

  const fetchHistory = useCallback(async (targetPage = 0) => {
    if (targetPage > 0) setLoadingMore(true);
    else setLoadingHistory(true);

    const from = targetPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let q = supabase
      .from("andon_calls")
      .select("*")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (filterMesin !== "all") {
      q = q.eq("mesin", filterMesin);
    }
    if (filterStatus !== "all") {
      q = q.eq("status", filterStatus);
    }

    const { data } = await q;

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
  }, [filterMesin, filterStatus, supabase]);

  useEffect(() => {
    if (isLeaderOrAdmin) fetchHistory(0);
  }, [isLeaderOrAdmin, fetchHistory]);

  // Refresh riwayat saat ada panggilan aktif berubah
  useEffect(() => {
    if (isLeaderOrAdmin) fetchHistory(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCalls.length]);

  // Client-side search filtering
  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return history;
    const q = searchQuery.toLowerCase();
    return history.filter((c) => {
      const mesin = (MESIN_LABELS[c.mesin] || c.mesin || "").toLowerCase();
      const stasiun = (c.stasiun || "").toLowerCase();
      const alasan = (c.alasan || "").toLowerCase();
      const status = (c.status || "").toLowerCase();
      return (
        mesin.includes(q) ||
        stasiun.includes(q) ||
        alasan.includes(q) ||
        status.includes(q)
      );
    });
  }, [history, searchQuery]);

  // Bulk Selection helpers
  const isAllSelected = useMemo(() => {
    return filteredHistory.length > 0 && filteredHistory.every((c) => selectedIds.has(c.id));
  }, [filteredHistory, selectedIds]);

  const isIndeterminate = useMemo(() => {
    return filteredHistory.some((c) => selectedIds.has(c.id)) && !isAllSelected;
  }, [filteredHistory, selectedIds, isAllSelected]);

  const toggleSelect = (id: string) => {
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
      setSelectedIds(new Set(filteredHistory.map((c) => c.id)));
    }
  };

  // ─── Create Manual Call Handler ─────────────────────────────────────────────
  const handleOpenCreate = () => {
    setCreateForm({ mesin: "tandem", stasiun: "", alasan: "" });
    setCreateError("");
    setShowCreateModal(true);
  };

  const handleSaveCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.mesin) {
      setCreateError("Pilih mesin terlebih dahulu.");
      return;
    }

    try {
      setIsSavingCreate(true);
      setCreateError("");

      const payload = {
        mesin: createForm.mesin,
        line_name: MESIN_LABELS[createForm.mesin] || createForm.mesin,
        stasiun: createForm.stasiun.trim() || null,
        alasan: createForm.alasan.trim() || "Panggilan manual admin",
        status: "pending",
        triggered_by: userId || null,
      };

      const { error } = await supabase.from("andon_calls").insert(payload);
      if (error) throw error;

      toast.success("Panggilan Andon berhasil dibuat!");
      setShowCreateModal(false);
      fetchHistory(0);
    } catch (err: any) {
      setCreateError(err?.message || "Gagal membuat panggilan Andon.");
    } finally {
      setIsSavingCreate(false);
    }
  };

  // ─── Edit Handler ────────────────────────────────────────────────────────────
  const handleOpenEdit = (c: AndonCall) => {
    setEditTarget(c);
    setEditForm({
      mesin: c.mesin || "tandem",
      stasiun: c.stasiun || "",
      alasan: c.alasan || "",
      status: c.status || "pending",
    });
    setEditError("");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget?.id) return;

    try {
      setIsSavingEdit(true);
      setEditError("");

      const payload = {
        mesin: editForm.mesin,
        line_name: MESIN_LABELS[editForm.mesin] || editForm.mesin,
        stasiun: editForm.stasiun.trim() || null,
        alasan: editForm.alasan.trim() || null,
        status: editForm.status,
      };

      const { data, error } = await supabase
        .from("andon_calls")
        .update(payload)
        .eq("id", editTarget.id)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Tidak ada data yang diperbarui. Periksa izin role Anda.");
      }

      toast.success("Riwayat panggilan berhasil diperbarui!");
      setEditTarget(null);
      fetchHistory(0);
    } catch (err: any) {
      setEditError(err?.message || "Gagal menyimpan perubahan.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  // ─── Single Delete Handler ───────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget?.id) return;
    try {
      setIsDeleting(true);
      setDeleteError("");

      const { data, error } = await supabase
        .from("andon_calls")
        .delete()
        .eq("id", deleteTarget.id)
        .select();

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Tidak ada data yang dihapus. Periksa izin role Anda.");
      }

      toast.success("Riwayat panggilan berhasil dihapus.");
      setDeleteTarget(null);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteTarget.id);
        return next;
      });
      fetchHistory(0);
    } catch (err: any) {
      setDeleteError(err?.message || "Gagal menghapus riwayat.");
    } finally {
      setIsDeleting(false);
    }
  };

  // ─── Bulk Delete Handler ─────────────────────────────────────────────────────
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      setIsBulkDeleting(true);
      setBulkDeleteError("");

      const ids = Array.from(selectedIds);
      const { data, error } = await supabase
        .from("andon_calls")
        .delete()
        .in("id", ids)
        .select();

      if (error) throw error;

      const n = data?.length ?? ids.length;
      toast.success(`${n} riwayat panggilan berhasil dihapus.`);
      setSelectedIds(new Set());
      setShowBulkDeleteModal(false);
      fetchHistory(0);
    } catch (err: any) {
      setBulkDeleteError(err?.message || "Gagal menghapus data terpilih.");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const andonContent = (
    <>
      {/* Layar Berkedip Darurat saat ada panggilan operator masuk */}
      {activeCalls.length > 0 && <div className="andon-screen-flasher" aria-hidden="true" />}

      {/* Emergency Alert Banner saat ada panggilan aktif */}
      {activeCalls.length > 0 && (
        <div className="andon-emergency-banner mb-6 p-4 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 border-2 border-red-300 animate-in fade-in zoom-in-95 duration-300">
          <div className="flex items-center gap-3.5 w-full md:w-auto">
            <div className="p-3 rounded-xl bg-white/20 animate-bounce shrink-0">
              <AlertTriangle className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider bg-white text-red-700 px-2.5 py-0.5 rounded-full shadow-xs">
                  Panggilan Masuk!
                </span>
                <span className="font-extrabold text-sm sm:text-base tracking-tight">
                  {activeCalls.length} Panggilan Operator Menunggu Respon
                </span>
              </div>
              <p className="text-xs text-white/95 mt-1 font-medium">
                Line: <strong className="underline underline-offset-2">{activeCalls[0]?.line_name || MESIN_LABELS[activeCalls[0]?.mesin] || activeCalls[0]?.mesin}</strong>
                {activeCalls[0]?.stasiun ? ` • Stasiun ${activeCalls[0].stasiun}` : ""}
                {activeCalls[0]?.alasan ? ` • "${activeCalls[0].alasan}"` : " • Operator memanggil leader"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 w-full md:w-auto justify-end shrink-0">
            <Button
              size="sm"
              variant="secondary"
              type="button"
              onClick={() => setIsAlarmMuted((m) => !m)}
              className="h-10 px-3.5 text-xs font-bold bg-white/20 hover:bg-white/30 text-white border-0 cursor-pointer backdrop-blur-xs transition-all"
              title={isAlarmMuted ? "Bunyikan Alarm" : "Bisukan Suara Alarm"}
            >
              {isAlarmMuted ? <VolumeX className="h-4 w-4 mr-1.5" /> : <Volume2 className="h-4 w-4 mr-1.5" />}
              {isAlarmMuted ? "Suara Bisu" : "Bunyi Aktif"}
            </Button>
            <Button
              size="sm"
              type="button"
              onClick={() => acknowledgeCall(activeCalls[0].id, userId)}
              className="h-10 px-5 text-xs font-black bg-white hover:bg-slate-100 text-red-700 cursor-pointer shadow-lg active:scale-95 transition-all ring-2 ring-white/50"
            >
              Terima Panggilan Sekarang
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="page-header mb-0">
          <h1 className="page-title text-2xl font-bold font-display">
            <span className="eyebrow block text-xs font-semibold text-blue-500 uppercase tracking-wider mb-0.5">
              Sistem Notifikasi
            </span>
            Andon — Panggilan Leader
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Pengaturan pendaftaran leader per line, push notification, serta pemantauan dan riwayat panggilan Andon.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchHistory(0)}
            disabled={loadingHistory}
            className="inline-flex items-center gap-2 min-h-[40px] px-3.5 py-2 text-xs font-bold rounded-xl border border-border bg-card text-foreground hover:bg-muted active:scale-95 transition-all cursor-pointer touch-manipulation shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingHistory ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          <Button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white active:scale-95 transition-all cursor-pointer shadow-sm"
          >
            <PhoneCall className="h-4 w-4" />
            <span>Panggil Andon Manual</span>
          </Button>
        </div>
      </div>

      {!isLeaderOrAdmin && (
        <div className="p-4 rounded-xl bg-red-50 text-red-600 border border-red-200 text-sm font-semibold">
          Halaman ini khusus untuk role Admin atau Leader.
        </div>
      )}

      {isLeaderOrAdmin && (
        <div className="space-y-6">
          {/* Card 1: Notifikasi HP */}
          <Card className="dash-panel card-glow-info p-5">
            <p className="dash-panel-title font-bold text-base mb-1">1. Aktifkan Notifikasi di HP ini</p>
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              Wajib dilakukan di TIAP HP yang mau menerima panggilan Andon (getar + bunyi walau app tertutup).
              Kalau ganti HP, ulangi langkah ini di HP yang baru.
            </p>
            <Button
              type="button"
              onClick={handleDaftarkanHp}
              disabled={loadingPush}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
            >
              <Bell className="h-4 w-4 mr-1.5" />
              {loadingPush ? "Mendaftarkan..." : "Aktifkan Notifikasi di HP ini"}
            </Button>
          </Card>

          {/* Card 2: Line yang Saya Lead */}
          <Card className="dash-panel card-glow-info p-5">
            <p className="dash-panel-title font-bold text-base mb-1">2. Line yang Saya Lead</p>
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              Pilih line yang Anda tanggung jawab. <strong>Tier 1</strong> = dipanggil pertama kali.
              <strong> Tier 2</strong> = eskalasi, dipanggil kalau tier 1 tidak merespon dalam 5 menit.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div className="field">
                <label className="text-xs font-semibold block mb-1">Line / Mesin</label>
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
                <label className="text-xs font-semibold block mb-1">Tier Panggilan</label>
                <Select
                  value={leaderForm.tier}
                  onChange={(e) => setLeaderForm((f) => ({ ...f, tier: Number(e.target.value) as 1 | 2 }))}
                >
                  <option value={1}>Tier 1 (Utama)</option>
                  <option value={2}>Tier 2 (Eskalasi)</option>
                </Select>
              </div>
            </div>
            <div>
              <Button type="button" onClick={handleDaftarLeader} className="font-bold">
                <Plus className="h-4 w-4 mr-1" /> Tambah Pendaftaran
              </Button>
            </div>

            <div className="table-wrap mt-4 overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50 font-semibold text-muted-foreground">
                    <th className="p-3">Line</th>
                    <th className="p-3">Tier</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {myLeaders.map((r, rIdx) => (
                    <tr
                      key={r.id}
                      className="hover:bg-muted/30 transition-colors animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-backwards"
                      style={{ animationDelay: `${Math.min(rIdx * 25, 300)}ms` }}
                    >
                      <td className="p-3 font-semibold text-foreground">{MESIN_LABELS[r.mesin] || r.mesin}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${r.tier === 1 ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-purple-50 text-purple-700 border border-purple-200"}`}>
                          Tier {r.tier}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <Button variant="destructive" size="sm" onClick={() => hapusLeader(r.id)} className="h-8">
                          Hapus
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {myLeaders.length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-6 text-center text-muted-foreground">
                        Belum terdaftar sebagai leader line manapun.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Card 3: Panggilan Aktif */}
          <Card className={`dash-panel card-glow-info p-5 transition-all ${activeCalls.length > 0 ? "border-rose-500 ring-2 ring-rose-500/60 shadow-xl shadow-rose-500/20" : ""}`}>
            <div className="flex items-center justify-between mb-3">
              <p className="dash-panel-title font-bold text-base flex items-center gap-2">
                <span>Panggilan Aktif Saat Ini</span>
                <span className={`text-xs font-mono px-2 py-0.5 rounded-full font-bold border ${activeCalls.length > 0 ? "bg-rose-500 text-white border-rose-600 animate-pulse" : "bg-rose-500/15 text-rose-600 border-rose-500/30"}`}>
                  {activeCalls.length} aktif
                </span>
              </p>
            </div>
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              Notifikasi berulang (alarm, getaran, layar berkedip) beroperasi otomatis sampai tombol <strong>Terima Panggilan</strong> ditekan.
            </p>
            <div className="table-wrap overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50 font-semibold text-muted-foreground">
                    <th className="p-3">Waktu</th>
                    <th className="p-3">Line / Mesin</th>
                    <th className="p-3">Stasiun</th>
                    <th className="p-3">Alasan</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {activeCalls.map((c, cIdx) => (
                    <tr
                      key={c.id}
                      className="hover:bg-muted/30 transition-colors animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-backwards"
                      style={{ animationDelay: `${Math.min(cIdx * 25, 300)}ms` }}
                    >
                      <td className="p-3 font-mono text-xs">{new Date(c.created_at).toLocaleString("id-ID")}</td>
                      <td className="p-3 font-semibold text-foreground">{c.line_name || MESIN_LABELS[c.mesin] || c.mesin}</td>
                      <td className="p-3">{c.stasiun || "-"}</td>
                      <td className="p-3">{c.alasan || "-"}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${c.status === "escalated" ? "bg-red-50 text-red-700 border border-red-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                          {c.status === "escalated" ? "Eskalasi" : "Menunggu"}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          size="sm"
                          onClick={() => acknowledgeCall(c.id, userId)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold h-9 px-4 shadow-md ring-2 ring-emerald-400/60 hover:ring-emerald-400 active:scale-95 transition-all animate-pulse"
                        >
                          Terima Panggilan
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {activeCalls.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-muted-foreground">
                        Tidak ada panggilan aktif saat ini. 👍
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Card 4: Riwayat Panggilan dengan Filter, Search & Bulk Actions */}
          <Card className="dash-panel card-glow-info p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <p className="dash-panel-title font-bold text-base flex items-center gap-2">
                <span>Riwayat Panggilan Andon</span>
                <span className="text-xs font-mono font-normal px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {filteredHistory.length} baris
                </span>
              </p>
            </div>

            {/* Filter & Search Toolbar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div className="field">
                <label className="text-xs font-semibold block mb-1 text-muted-foreground">Filter Mesin</label>
                <Select
                  value={filterMesin}
                  onChange={(e) => setFilterMesin(e.target.value)}
                  className="w-full text-xs"
                >
                  <option value="all">Semua Mesin</option>
                  {MESIN_OPTIONS.map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </Select>
              </div>

              <div className="field">
                <label className="text-xs font-semibold block mb-1 text-muted-foreground">Filter Status</label>
                <Select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full text-xs"
                >
                  <option value="all">Semua Status</option>
                  <option value="pending">Menunggu</option>
                  <option value="escalated">Eskalasi</option>
                  <option value="acknowledged">Diterima</option>
                </Select>
              </div>

              <div className="field">
                <label className="text-xs font-semibold block mb-1 text-muted-foreground">Cari Cepat</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Cari alasan, stasiun, status..."
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
                  <span className="text-xs sm:text-sm font-semibold">Riwayat Dipilih</span>
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
                        aria-label="Pilih semua baris riwayat"
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                      />
                    </th>
                    <th className="p-3">Waktu</th>
                    <th className="p-3">Line / Mesin</th>
                    <th className="p-3">Stasiun</th>
                    <th className="p-3">Alasan</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Diterima</th>
                    <th className="p-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loadingHistory ? (
                    <AndonHistoryTableSkeleton />
                  ) : filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        Belum ada riwayat panggilan yang cocok dengan filter.
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((c, hIdx) => {
                      const isSelected = selectedIds.has(c.id);
                      return (
                        <tr
                          key={c.id}
                          onClick={() => toggleSelect(c.id)}
                          className={`transition-colors cursor-pointer animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-backwards ${
                            isSelected ? "bg-blue-50/70 dark:bg-blue-950/40" : "hover:bg-muted/30"
                          }`}
                          style={{ animationDelay: `${Math.min(hIdx * 20, 300)}ms` }}
                        >
                          {/* Checkbox */}
                          <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(c.id)}
                              aria-label={`Pilih panggilan ${c.id}`}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer accent-blue-600"
                            />
                          </td>
                          <td className="p-3 font-mono text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString("id-ID")}</td>
                          <td className="p-3 font-semibold text-foreground">{c.line_name || MESIN_LABELS[c.mesin] || c.mesin}</td>
                          <td className="p-3">{c.stasiun || "-"}</td>
                          <td className="p-3 max-w-[200px] truncate" title={c.alasan || ""}>{c.alasan || "-"}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              c.status === "pending"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : c.status === "escalated"
                                ? "bg-red-50 text-red-700 border border-red-200"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            }`}>
                              {c.status === "pending" ? "Menunggu" : c.status === "escalated" ? "Eskalasi" : "Diterima"}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-xs text-muted-foreground">
                            {c.acknowledged_at ? new Date(c.acknowledged_at).toLocaleString("id-ID") : "-"}
                          </td>
                          <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1.5">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleOpenEdit(c)}
                                className="h-8 w-8 p-0"
                                title="Edit riwayat panggilan"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  setDeleteError("");
                                  setDeleteTarget(c);
                                }}
                                className="h-8 w-8 p-0"
                                title="Hapus riwayat panggilan"
                              >
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
                  onClick={() => fetchHistory(page + 1)}
                >
                  {loadingMore ? "Memuat..." : "Muat Lebih Banyak"}
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Modal Tambah Panggilan Andon Manual */}
      {showCreateModal && (
        <Dialog open={showCreateModal} onOpenChange={(open) => { if (!open && !isSavingCreate) setShowCreateModal(false); }}>
          <DialogContent onClose={() => { if (!isSavingCreate) setShowCreateModal(false); }} maxWidth="max-w-lg">
            <DialogHeader>
              <DialogTitle>Panggil Andon Manual</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveCreate} className="space-y-4 mt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="field">
                  <label className="text-xs font-semibold block mb-1">Line / Mesin *</label>
                  <Select
                    value={createForm.mesin}
                    onChange={(e) => setCreateForm({ ...createForm, mesin: e.target.value })}
                    required
                  >
                    {MESIN_OPTIONS.map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </Select>
                </div>
                <div className="field">
                  <label className="text-xs font-semibold block mb-1">Stasiun (Opsional)</label>
                  <Input
                    type="text"
                    placeholder="mis. PA-1 / PC-1"
                    value={createForm.stasiun}
                    onChange={(e) => setCreateForm({ ...createForm, stasiun: e.target.value })}
                  />
                </div>
              </div>
              <div className="field">
                <label className="text-xs font-semibold block mb-1">Alasan Panggilan *</label>
                <Input
                  type="text"
                  placeholder="mis. Dies macet, Butuh bantuan leader"
                  value={createForm.alasan}
                  onChange={(e) => setCreateForm({ ...createForm, alasan: e.target.value })}
                  required
                />
              </div>

              {createError && (
                <div className="p-3 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs">
                  {createError}
                </div>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isSavingCreate}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={isSavingCreate}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
                >
                  {isSavingCreate ? "Memanggil..." : "Kirim Panggilan"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal Edit Riwayat Panggilan */}
      {editTarget && (
        <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open && !isSavingEdit) setEditTarget(null); }}>
          <DialogContent onClose={() => { if (!isSavingEdit) setEditTarget(null); }} maxWidth="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Riwayat Panggilan</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveEdit} className="space-y-4 mt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="field">
                  <label className="text-xs font-semibold block mb-1">Line / Mesin *</label>
                  <Select
                    value={editForm.mesin}
                    onChange={(e) => setEditForm({ ...editForm, mesin: e.target.value })}
                    required
                  >
                    {MESIN_OPTIONS.map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </Select>
                </div>
                <div className="field">
                  <label className="text-xs font-semibold block mb-1">Status</label>
                  <Select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value as any })}
                  >
                    <option value="pending">Menunggu</option>
                    <option value="escalated">Eskalasi</option>
                    <option value="acknowledged">Diterima</option>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="field">
                  <label className="text-xs font-semibold block mb-1">Stasiun</label>
                  <Input
                    type="text"
                    placeholder="mis. PA-1 / PC-1"
                    value={editForm.stasiun}
                    onChange={(e) => setEditForm({ ...editForm, stasiun: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label className="text-xs font-semibold block mb-1">Alasan / Keterangan</label>
                  <Input
                    type="text"
                    placeholder="mis. Dies macet, Butuh bantuan"
                    value={editForm.alasan}
                    onChange={(e) => setEditForm({ ...editForm, alasan: e.target.value })}
                  />
                </div>
              </div>

              {editError && (
                <div className="p-3 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs">
                  {editError}
                </div>
              )}

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

      {/* Modal Konfirmasi Hapus Riwayat Panggilan */}
      {deleteTarget && (
        <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open && !isDeleting) setDeleteTarget(null); }}>
          <DialogContent onClose={() => { if (!isDeleting) setDeleteTarget(null); }} maxWidth="max-w-md">
            <div className="flex items-start gap-4 mb-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-50 border border-red-100 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-foreground">Hapus Riwayat Panggilan?</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Yakin ingin menghapus panggilan Andon untuk line{" "}
                  <strong className="text-foreground">
                    {deleteTarget.line_name || MESIN_LABELS[deleteTarget.mesin] || deleteTarget.mesin}
                  </strong>{" "}
                  pada {new Date(deleteTarget.created_at).toLocaleString("id-ID")}
                  {deleteTarget.alasan ? ` (Alasan: "${deleteTarget.alasan}")` : ""}?
                </p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Tindakan ini akan menghapus data riwayat secara permanen.
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs">
                {deleteError}
              </div>
            )}

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

      {/* Modal Konfirmasi Bulk Delete Riwayat Panggilan */}
      {showBulkDeleteModal && (
        <Dialog open={showBulkDeleteModal} onOpenChange={(open) => { if (!open && !isBulkDeleting) setShowBulkDeleteModal(false); }}>
          <DialogContent onClose={() => { if (!isBulkDeleting) setShowBulkDeleteModal(false); }} maxWidth="max-w-md">
            <div className="flex items-start gap-4 mb-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-50 border border-red-100 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-foreground">Hapus {selectedIds.size} Riwayat Panggilan?</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Apakah Anda yakin ingin menghapus <strong className="text-foreground">{selectedIds.size} riwayat panggilan</strong> yang dipilih?
                </p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Tindakan ini akan menghapus data riwayat secara permanen.
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
    </>
  );

  if (embedded) {
    return <div className="main animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ minHeight: 0 }}>{andonContent}</div>;
  }

  return (
    <div className="app-shell">
      <main className="main max-w-6xl mx-auto w-full animate-in fade-in slide-in-from-bottom-2 duration-500 pb-16">
        <Link
          href={role === "leader" ? "/operator" : "/admin"}
          className="inline-flex items-center gap-1.5 self-start min-h-[40px] px-3 py-2 mb-4 text-xs font-semibold rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors touch-manipulation shadow-xs"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          {role === "leader" ? "Kembali ke Operator" : "Kembali ke Admin"}
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
          <td className="p-3 text-center"><div className="h-4 w-4 bg-muted rounded mx-auto" /></td>
          <td className="p-3"><div className="h-4 bg-muted rounded w-28" /></td>
          <td className="p-3"><div className="h-4 bg-muted rounded w-24" /></td>
          <td className="p-3"><div className="h-4 bg-muted rounded w-16" /></td>
          <td className="p-3"><div className="h-4 bg-muted rounded w-32" /></td>
          <td className="p-3"><div className="h-5 bg-muted rounded w-16" /></td>
          <td className="p-3"><div className="h-4 bg-muted rounded w-28" /></td>
          <td className="p-3 text-center"><div className="h-7 w-20 bg-muted rounded mx-auto" /></td>
        </tr>
      ))}
    </>
  );
}
