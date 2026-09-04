"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, Bell, PhoneCall, Volume2, VolumeX, CheckCircle, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAndonAlerts, AndonCall } from "@/hooks/produksi/useAndon";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const MESIN_LABELS: Record<string, string> = {
  blanking: "Blanking",
  pc200t: "PC200t",
  tandem: "Tandem",
  transfer_2000t: "Transfer 2000t",
  transfer_800t: "Transfer 800t",
};

// Web Audio API Synthesizer untuk nada alarm industri Andon (dual-tone)
function playGlobalAlarmBeep(audioCtx: AudioContext) {
  try {
    const now = audioCtx.currentTime;

    // Tone 1: 880 Hz (A5)
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

    // Tone 2: 1174.66 Hz (D6 darurat)
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
  } catch (e) {
    console.warn("Global audio alarm warning:", e);
  }
}

function triggerGlobalVibration() {
  if (typeof window !== "undefined" && typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate([350, 150, 350]);
    } catch {}
  }
}

function stopGlobalVibration() {
  if (typeof window !== "undefined" && typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(0);
    } catch {}
  }
}

export function GlobalAndonAlert() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Ambil sesi & role user saat ini
  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setUserId(null);
        setUserRole(null);
        return;
      }
      setUserId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      const rawRole = (profile?.role || user.user_metadata?.role || user.app_metadata?.role || "") as string;
      setUserRole(rawRole.trim().toLowerCase());
    }

    loadUser();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      loadUser();
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [supabase]);

  const isLeaderOrAdmin = userRole === "leader" || userRole === "admin";
  const { activeCalls, acknowledgeCall } = useAndonAlerts(isLeaderOrAdmin);

  // Jika sedang di halaman /admin/andon-settings, serahkan audio dan visual ke halaman tersebut
  const isAndonSettingsPage = pathname?.startsWith("/admin/andon-settings");
  const shouldAlert = isLeaderOrAdmin && activeCalls.length > 0 && !isAndonSettingsPage;

  // Loop alarm suara dan getaran di semua halaman selain /admin/andon-settings
  useEffect(() => {
    if (!shouldAlert) {
      stopGlobalVibration();
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
      triggerGlobalVibration();

      if (!isMuted && audioCtxRef.current) {
        const ctx = audioCtxRef.current;
        if (ctx.state === "suspended") {
          ctx.resume().then(() => {
            playGlobalAlarmBeep(ctx);
          }).catch(() => {});
        } else if (ctx.state === "running") {
          playGlobalAlarmBeep(ctx);
        }
      }
    };

    fireAlert();
    const interval = setInterval(fireAlert, 1500);

    const unlockAudio = () => {
      if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume().then(() => {
          if (!isMuted && audioCtxRef.current) {
            playGlobalAlarmBeep(audioCtxRef.current);
          }
        }).catch(() => {});
      }
    };
    window.addEventListener("pointerdown", unlockAudio, { passive: true });
    window.addEventListener("keydown", unlockAudio, { passive: true });

    return () => {
      clearInterval(interval);
      stopGlobalVibration();
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, [shouldAlert, isMuted]);

  if (!shouldAlert) return null;

  const currentCall = activeCalls[0];
  const lineLabel = currentCall?.line_name || MESIN_LABELS[currentCall?.mesin] || currentCall?.mesin || "Mesin";

  const handleAcknowledge = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentCall || !userId) return;
    try {
      await acknowledgeCall(currentCall.id, userId);
      toast.success(`Panggilan Andon dari ${lineLabel} berhasil diterima.`);
    } catch (err: any) {
      toast.error(`Gagal menerima panggilan: ${err?.message || err}`);
    }
  };

  return (
    <>
      {/* 1. Layar Berkedip Darurat di Seluruh Layar Tablet */}
      <div className="andon-screen-flasher" aria-hidden="true" />

      {/* 2. Floating Emergency Banner di Bagian Atas Layar */}
      <div className="fixed top-3 inset-x-3 sm:top-5 sm:inset-x-6 z-[99999] max-w-4xl mx-auto animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-auto">
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white shadow-2xl border-2 border-red-300 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 w-full md:w-auto">
            <div className="p-3 rounded-xl bg-white/20 animate-bounce shrink-0 shadow-inner">
              <AlertTriangle className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider bg-white text-red-700 px-2.5 py-0.5 rounded-full shadow-xs">
                  Panggilan Andon!
                </span>
                <span className="font-extrabold text-sm sm:text-base tracking-tight">
                  {activeCalls.length} Panggilan Menunggu Respon
                </span>
              </div>
              <p className="text-xs text-white/95 mt-1 font-medium">
                Line: <strong className="underline underline-offset-2">{lineLabel}</strong>
                {currentCall?.stasiun ? ` • Stasiun ${currentCall.stasiun}` : ""}
                {currentCall?.alasan ? ` • "${currentCall.alasan}"` : " • Operator memanggil leader"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto justify-end shrink-0 flex-wrap">
            {/* Tombol Mute / Unmute */}
            <Button
              size="sm"
              variant="secondary"
              type="button"
              onClick={() => setIsMuted((m) => !m)}
              className="h-10 px-3 text-xs font-bold bg-white/20 hover:bg-white/30 text-white border-0 cursor-pointer backdrop-blur-xs transition-all"
              title={isMuted ? "Bunyikan Alarm" : "Bisukan Suara"}
            >
              {isMuted ? <VolumeX className="h-4 w-4 mr-1" /> : <Volume2 className="h-4 w-4 mr-1" />}
              {isMuted ? "Bisu" : "Bunyi"}
            </Button>

            {/* Tombol Buka Pengaturan Andon */}
            <Link href="/admin/andon-settings">
              <Button
                size="sm"
                variant="secondary"
                type="button"
                className="h-10 px-3.5 text-xs font-bold bg-white/20 hover:bg-white/30 text-white border-0 cursor-pointer backdrop-blur-xs transition-all"
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Halaman Andon
              </Button>
            </Link>

            {/* Tombol Terima Panggilan Cepat */}
            <Button
              size="sm"
              type="button"
              onClick={handleAcknowledge}
              className="h-10 px-5 text-xs font-black bg-white hover:bg-slate-100 text-red-700 cursor-pointer shadow-lg active:scale-95 transition-all ring-2 ring-white/60 animate-pulse"
            >
              <CheckCircle className="h-4 w-4 mr-1.5 text-emerald-600" />
              Terima Panggilan
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
