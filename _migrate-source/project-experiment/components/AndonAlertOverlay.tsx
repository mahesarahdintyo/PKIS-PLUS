"use client";

// =========================================================
// AndonAlertOverlay — alert FULL-SCREEN, berkedip, bunyi beep berulang
// tiap 2.5 detik + getar, wajib tekan "TERIMA" (tidak bisa diklik-tembus).
// Cuma muncul ke leader yang terdaftar (andon_leaders) utk mesin
// bersangkutan — bukan ke semua admin/leader. Port dari vanilla
// assets/andon.js (_andonShowAlert). Dipasang global di HeaderNav.
// =========================================================

import { useEffect, useRef } from "react";
import Image from "next/image";
import { useAndonLeaderAlerts } from "@/hooks/useAndon";
import { CheckCircle } from "lucide-react";

const MESIN_LABELS: Record<string, string> = {
  blanking: "Blanking",
  pc200t: "PC200t",
  tandem: "Tandem",
  transfer_2000t: "Transfer 2000t",
  transfer_800t: "Transfer 800t",
};

function playBeep(ctx: AudioContext) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0.25, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.5);
  // beep kedua susul supaya lebih mendesak
  setTimeout(() => {
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "square";
    osc2.frequency.value = 660;
    gain2.gain.setValueAtTime(0.25, ctx.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc2.connect(gain2).connect(ctx.destination);
    osc2.start();
    osc2.stop(ctx.currentTime + 0.5);
  }, 300);
}

export default function AndonAlertOverlay({ userId }: { userId?: string | null }) {
  const { current, acknowledge } = useAndonLeaderAlerts(userId);
  const audioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (!current) return;

    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      playBeep(audioCtxRef.current);
    } catch {
      /* audio tidak tersedia, abaikan */
    }
    if (navigator.vibrate) navigator.vibrate([400, 150, 400, 150, 400, 150, 400]);

    const interval = setInterval(() => {
      try {
        if (audioCtxRef.current) playBeep(audioCtxRef.current);
      } catch {
        /* abaikan */
      }
      if (navigator.vibrate) navigator.vibrate([400, 150, 400]);
    }, 2500);

    return () => clearInterval(interval);
  }, [current?.id]);

  if (!current) return null;

  return (
    <div className="andon-alert-overlay">
      <div className="andon-alert-box">
        <div className="andon-alert-icon">
          <Image
            src="/icons/emoji-3d/alert-light.png"
            alt="Andon Alert"
            width={48}
            height={48}
            className="w-12 h-12 object-contain"
          />
        </div>
        <div className="andon-alert-title">
          {current.status === "escalated" ? "ESKALASI ANDON" : "PANGGILAN ANDON"}
        </div>
        <div className="andon-alert-line">{MESIN_LABELS[current.mesin] || current.mesin}</div>
        <div className="andon-alert-reason">{current.alasan || "Operator memanggil leader"}</div>
        <button
          type="button"
          className="andon-alert-btn"
          onClick={() => acknowledge(current.id)}
        >
          <CheckCircle size={18} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} />
          TERIMA
        </button>
      </div>
    </div>
  );
}
