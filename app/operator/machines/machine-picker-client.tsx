"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/ui/app-header";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LogoutButton } from "@/components/ui/logout-button";
import { createClient } from "@/lib/supabase/client";
import type { Line } from "@/lib/services/line";
import { Loader2, AlertCircle } from "lucide-react";
import "@/app/admin/(produksi)/produksi.css";

export default function MachinePickerClient() {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const channelNameRef = useRef(
    `lines_picker_watch_${Math.random().toString(36).slice(2)}`
  );

  const fetchLines = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from("lines")
        .select("*")
        .eq("is_active", true)
        .eq("hidden_from_operator", false)
        .not("machine_type", "is", null)
        .order("name");

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setLines((data as Line[]) ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat daftar line produksi");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLines(true);

    const supabase = createClient();
    const channel = supabase
      .channel(channelNameRef.current)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lines" },
        () => {
          fetchLines(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLines]);

  const handleSelectLine = (lineId: string) => {
    router.push(`/operator/machines/${lineId}`);
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AppHeader
        disableLogoLink
        logoAside={
          <div className="flex flex-col border-slate-200 sm:border-l sm:pl-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Pilih Mesin
            </span>
            <span className="text-base font-bold text-emerald-700">
              Line Produksi
            </span>
          </div>
        }
      >
        <ThemeToggle variant="icon" />
        <LogoutButton variant="header" />
      </AppHeader>

      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
        <div className="page-header">
          <h1 className="page-title text-2xl font-bold font-display">
            <span className="eyebrow block text-xs font-semibold text-blue-400 uppercase tracking-wider mb-0.5">
              Input
            </span>
            Pilih Line Produksi
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Pilih line / mesin produksi untuk mulai mencatat dan melihat data operasional.
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[200px] gap-3 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm">Memuat daftar line produksi...</p>
          </div>
        ) : error ? (
          <div className="flex items-center gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : lines.length === 0 ? (
          <div className="text-center py-12 border border-dashed rounded-xl p-6 text-muted-foreground">
            <p className="text-base font-semibold">Tidak ada line produksi yang aktif</p>
            <p className="text-xs mt-1">Hubungi admin untuk mengaktifkan line produksi.</p>
          </div>
        ) : (
          <div className="machine-cards-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
            {lines.map((line) => (
              <button
                key={line.id}
                type="button"
                onClick={() => handleSelectLine(line.id)}
                className="machine-card card-glow-info text-left cursor-pointer w-full min-h-[90px] sm:min-h-[100px] p-4 sm:p-5 rounded-xl sm:rounded-2xl transition-all duration-200 active:scale-[0.98] touch-manipulation"
              >
                <div className="machine-card-top flex items-center justify-between gap-2 mb-2">
                  <span className="machine-card-name text-base sm:text-lg font-bold">{line.name}</span>
                  <span className="text-2xl sm:text-3xl shrink-0">⚙️</span>
                </div>
                <div className="hint text-xs sm:text-sm text-muted-foreground">
                  {line.description || "Line Produksi"}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
