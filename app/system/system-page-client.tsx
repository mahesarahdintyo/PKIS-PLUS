"use client";

import { Activity, Clock, Database, HardDrive, Monitor, RefreshCw, Server } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

interface DisplayStatus {
  id: string;
  name: string;
  online: boolean;
  lastSeenAt: string | null;
}

interface HealthStatus {
  checkedAt: string;
  version: string;
  database: {
    connected: boolean;
    error: string | null;
  };
  storage: {
    connected: boolean;
    error: string | null;
  };
  displays: DisplayStatus[];
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      className={`h-3 w-3 rounded-full ${active ? "bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.14)]" : "bg-red-500 shadow-[0_0_0_4px_rgba(239,68,68,0.12)]"
        }`}
      aria-hidden="true"
    />
  );
}

function StatusRow({
  icon,
  label,
  active,
  activeText,
  inactiveText,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  activeText: string;
  inactiveText: string;
  detail?: string | null;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-200 py-4 last:border-b-0">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{label}</p>
          {detail && <p className="mt-1 truncate text-xs text-slate-500">{detail}</p>}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5">
        <StatusDot active={active} />
        <span className={`text-sm font-semibold ${active ? "text-emerald-700" : "text-red-700"}`}>
          {active ? activeText : inactiveText}
        </span>
      </div>
    </div>
  );
}

export default function SystemPageClient() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [error, setError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const allSystemsOk = useMemo(() => {
    if (!health) return false;

    return (
      health.database.connected &&
      health.storage.connected &&
      health.displays.every((display) => display.online)
    );
  }, [health]);

  const systemAlerts = useMemo(() => {
    const alerts: string[] = [];

    if (error) {
      if (typeof window !== "undefined" && !navigator.onLine) {
        alerts.push("Koneksi Internet Terputus: Browser Anda terdeteksi offline. Pastikan koneksi Wi-Fi atau kabel LAN terhubung.");
      } else {
        alerts.push(`Koneksi Server Gagal: Tidak dapat mengambil status dari server (${error}).`);
      }
      return alerts;
    }

    if (!health) return alerts;

    if (!health.database.connected) {
      alerts.push("Database Supabase Terputus: Aplikasi tidak dapat membaca/menyimpan data lands, folders, dan documents.");
    }

    if (!health.storage.connected) {
      alerts.push("Supabase Storage Terputus: Berkas dokumen (PDF/Gambar) tidak dapat diunggah atau diakses.");
    }

    const offlineDisplays = health.displays.filter((d) => !d.online).map((d) => d.name);
    if (offlineDisplays.length > 0) {
      alerts.push(`TV Display Offline: Layar TV pada Land [ ${offlineDisplays.join(", ")} ] terdeteksi tidak aktif.`);
    }

    return alerts;
  }, [health, error]);

  const loadHealth = async () => {
    try {
      setIsRefreshing(true);
      setError("");

      const response = await fetch("/api/system/health", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Koneksi HTTP bermasalah (status: ${response.status})`);
      }

      const data = await response.json();
      setHealth(data);
    } catch (error) {
      console.error("System health load error:", error);
      setError(
        error instanceof Error
          ? error.message === "Failed to fetch" || error.message.includes("fetch failed")
            ? "Koneksi jaringan gagal"
            : error.message
          : "Gagal memuat status sistem"
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    let timeoutId: number;
    let isMounted = true;

    const pollHealth = async () => {
      if (!isMounted) return;
      await loadHealth();
      if (isMounted) {
        timeoutId = window.setTimeout(pollHealth, 5000);
      }
    };

    timeoutId = window.setTimeout(pollHealth, 5000);
    loadHealth();

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-8">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              System Monitor
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-normal text-slate-950">
              Server Status
            </h1>
          </div>

          <button
            type="button"
            onClick={loadHealth}
            disabled={isRefreshing}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </header>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div className="flex items-center gap-3">
              <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${allSystemsOk ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                }`}>
                <Server className="h-5 w-5" />
              </div>
              <div>
                <p className="text-base font-bold text-slate-950">
                  {allSystemsOk ? "Semua Sistem Berjalan Normal" : "Sistem Memerlukan Perhatian"}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Terakhir diperiksa: {formatDateTime(health?.checkedAt)}
                </p>
              </div>
            </div>
          </div>

          {systemAlerts.length > 0 && (
            <div className="mb-6 space-y-2.5">
              {systemAlerts.map((alertText, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 shadow-sm animate-pulse-slow"
                >
                  <Activity className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
                  <div>
                    <span className="font-bold">Masalah Terdeteksi: </span>
                    {alertText}
                  </div>
                </div>
              ))}
            </div>
          )}

          <StatusRow
            icon={<Database className="h-5 w-5" />}
            label="Database"
            active={Boolean(health?.database.connected)}
            activeText="Terkoneksi"
            inactiveText="Terputus"
            detail={health?.database.error}
          />

          <StatusRow
            icon={<HardDrive className="h-5 w-5" />}
            label="Supabase Storage"
            active={Boolean(health?.storage.connected)}
            activeText="Terkoneksi"
            inactiveText="Terputus"
            detail={health?.storage.error}
          />

          {health?.displays.length ? (
            health.displays.map((display) => (
              <StatusRow
                key={display.id}
                icon={<Monitor className="h-5 w-5" />}
                label={`Display ${display.name}`}
                active={display.online}
                activeText="Online"
                inactiveText="Offline"
                detail={display.lastSeenAt ? `Terakhir aktif: ${formatDateTime(display.lastSeenAt)}` : "Belum pernah aktif"}
              />
            ))
          ) : (
            <StatusRow
              icon={<Monitor className="h-5 w-5" />}
              label="Display"
              active={false}
              activeText="Online"
              inactiveText="Tidak ada display terdeteksi"
            />
          )}
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-emerald-700" />
              <h2 className="text-sm font-bold text-slate-900">Versi Aplikasi</h2>
            </div>
            <p className="mt-4 text-2xl font-bold text-slate-950">
              {health?.version ?? "v1.0.0"}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-slate-600" />
              <h2 className="text-sm font-bold text-slate-900">Pembaruan Otomatis</h2>
            </div>
            <p className="mt-4 text-sm font-medium text-slate-600">
              Status monitor ini diperbarui otomatis setiap 5 detik.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
