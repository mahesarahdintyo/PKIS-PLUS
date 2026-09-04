"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import {
  andonSubscribePush,
  useAndonLeaders,
} from "@/hooks/produksi/useAndon";
import { toast } from "sonner";
import {
  Bell,
  Smartphone,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Loader2,
  Layers,
} from "lucide-react";

const MESIN_OPTIONS: [string, string][] = [
  ["blanking", "Blanking"],
  ["pc200t", "PC200t"],
  ["tandem", "Tandem"],
  ["transfer_2000t", "Transfer 2000t"],
  ["transfer_800t", "Transfer 800t"],
];

const MESIN_LABELS: Record<string, string> = {
  blanking: "Blanking",
  pc200t: "PC200t",
  tandem: "Tandem",
  transfer_2000t: "Transfer 2000t",
  transfer_800t: "Transfer 800t",
};

interface AndonNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
}

export default function AndonNotificationModal({
  isOpen,
  onClose,
  userId: initialUserId,
}: AndonNotificationModalProps) {
  const [userId, setUserId] = useState<string>(initialUserId || "");
  const [loadingPush, setLoadingPush] = useState(false);
  const [isPushSubscribed, setIsPushSubscribed] = useState<boolean | null>(null);
  const [leaderForm, setLeaderForm] = useState<{ mesin: string; tier: 1 | 2 }>({
    mesin: "blanking",
    tier: 1,
  });

  const { myLeaders, loading: loadingLeaders, daftarLeader, hapusLeader } =
    useAndonLeaders(userId || null);

  // Ambil user ID jika belum ada
  useEffect(() => {
    if (!userId) {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) setUserId(user.id);
      });
    }
  }, [userId]);

  // Cek apakah browser/HP ini sudah subscribe push
  const checkSubscription = useCallback(async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      setIsPushSubscribed(false);
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setIsPushSubscribed(Boolean(sub));
    } catch {
      setIsPushSubscribed(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      checkSubscription();
    }
  }, [isOpen, checkSubscription]);

  const handleDaftarkanHp = async () => {
    if (!userId) {
      toast.error("Gagal mendeteksi identitas akun. Silakan refresh halaman.");
      return;
    }

    setLoadingPush(true);
    try {
      const result = await andonSubscribePush(userId);
      if (result.ok) {
        toast.success(result.message);
        setIsPushSubscribed(true);
      } else {
        toast.error(result.message);
      }
    } catch (err: any) {
      toast.error(err?.message || "Terjadi kesalahan saat mendaftarkan notifikasi.");
    } finally {
      setLoadingPush(false);
    }
  };

  const handleTambahLeader = async () => {
    if (!userId) {
      toast.error("Belum terautentikasi.");
      return;
    }
    const { error } = await daftarLeader(leaderForm.mesin, leaderForm.tier);
    if (error) {
      toast.error(`Gagal: ${error}`);
    } else {
      toast.success(
        `Berhasil mendaftarkan line ${MESIN_LABELS[leaderForm.mesin] || leaderForm.mesin} (Tier ${leaderForm.tier}).`
      );
    }
  };

  const handleHapusLeader = async (id: string, mesinName: string) => {
    try {
      await hapusLeader(id);
      toast.success(`Line ${mesinName} dihapus dari daftar tugas Anda.`);
    } catch {
      toast.error("Gagal menghapus penugasan line.");
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent onClose={onClose} maxWidth="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold">
                Notifikasi Panggilan Andon
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Konfigurasi notifikasi HP dan line tugas Leader
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm text-foreground">
          {/* Section 1: Pendaftaran HP */}
          <div className="rounded-xl border border-border bg-card p-3.5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-primary" />
                <span className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                  Perangkat HP Ini
                </span>
              </div>
              {isPushSubscribed ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="h-3 w-3" />
                  Aktif
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  Belum Aktif
                </span>
              )}
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Daftarkan HP ini agar notifikasi panggilan langsung berdering saat operator menekan tombol panggil.
            </p>

            <Button
              type="button"
              onClick={handleDaftarkanHp}
              disabled={loadingPush}
              className="w-full min-h-[42px] bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-xs gap-2 rounded-lg touch-manipulation cursor-pointer"
            >
              {loadingPush ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Bell className="h-4 w-4" />
              )}
              <span>{isPushSubscribed ? "Perbarui / Daftarkan Ulang HP Ini" : "Aktifkan Notifikasi di HP Ini"}</span>
            </Button>
          </div>

          {/* Section 2: Line / Mesin Tugas Leader */}
          <div className="rounded-xl border border-border bg-card p-3.5 space-y-3 shadow-xs">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              <span className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                Line Yang Anda Pimpin
              </span>
            </div>

            <p className="text-xs text-muted-foreground">
              Notifikasi hanya akan dikirimkan ke Anda jika panggilan berasal dari line yang Anda daftarkan di bawah:
            </p>

            {/* Form Tambah Line */}
            <div className="flex items-center gap-2">
              <select
                value={leaderForm.mesin}
                onChange={(e) =>
                  setLeaderForm((prev) => ({ ...prev, mesin: e.target.value }))
                }
                className="flex-1 min-h-[38px] rounded-lg border border-border bg-background px-2.5 text-xs font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary/20"
              >
                {MESIN_OPTIONS.map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>

              <select
                value={leaderForm.tier}
                onChange={(e) =>
                  setLeaderForm((prev) => ({
                    ...prev,
                    tier: Number(e.target.value) as 1 | 2,
                  }))
                }
                className="w-24 min-h-[38px] rounded-lg border border-border bg-background px-2 text-xs font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value={1}>Tier 1</option>
                <option value={2}>Tier 2</option>
              </select>

              <Button
                type="button"
                size="sm"
                onClick={handleTambahLeader}
                className="min-h-[38px] px-3 text-xs font-bold gap-1 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg touch-manipulation cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Tambah</span>
              </Button>
            </div>

            {/* List Line Terdaftar */}
            <div className="space-y-1.5 pt-1">
              {loadingLeaders ? (
                <div className="py-3 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Memuat line...
                </div>
              ) : myLeaders.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-2.5 text-center text-xs text-muted-foreground">
                  <AlertCircle className="h-4 w-4 mx-auto mb-1 opacity-60" />
                  Anda belum mendaftarkan line tugas. Pilih mesin dan klik Tambah.
                </div>
              ) : (
                myLeaders.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">
                        {MESIN_LABELS[item.mesin] || item.mesin}
                      </span>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                        Tier {item.tier}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        handleHapusLeader(
                          item.id,
                          MESIN_LABELS[item.mesin] || item.mesin
                        )
                      }
                      className="text-muted-foreground hover:text-red-600 transition-colors p-1 rounded-md touch-manipulation cursor-pointer"
                      title="Hapus penugasan line"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-border flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="min-h-[38px] px-4 text-xs font-semibold"
          >
            Tutup
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
