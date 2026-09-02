'use client'

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Monitor, Tv, ArrowRight, Activity, Loader2, Maximize, Minimize } from "lucide-react";
import { getLines, type Line } from "@/lib/services/line";

export default function DisplayPage() {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    let timerId: NodeJS.Timeout;

    async function fetchLines() {
      try {
        const data = await getLines();
        if (isMounted) {
          setLines(data);
          setError("");
          if (data.length === 1 && data[0]?.id) {
            router.replace(`/display/${data[0].id}`);
          }
        }
      } catch (err) {
        console.error("Error loading lines on display page:", err);
        if (isMounted) {
          setError("Gagal memuat line produksi.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchLines();
    timerId = setInterval(fetchLines, 3000);

    return () => {
      isMounted = false;
      clearInterval(timerId);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-zinc-950 text-white flex flex-col justify-between select-none">
      {/* Header khusus untuk Layar TV Select */}
      <header className="border-b border-slate-800/80 bg-slate-950/90 px-8 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center">
            <Tv className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
              FUTABA PKIS
            </h1>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              TV Display Selector
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleFullscreen}
            className="flex items-center justify-center p-2 rounded-lg border border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white transition cursor-pointer"
            title={isFullscreen ? "Exit Fullscreen (F11)" : "Fullscreen (F11)"}
          >
            {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
          <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/50 px-4 py-2 text-xs text-slate-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Sistem Online</span>
          </div>
        </div>
      </header>

      {/* Main Grid Section */}
      <main className="flex-1 flex flex-col items-center justify-center p-8 md:p-16 max-w-7xl mx-auto w-full">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-white mb-4">
            Pilih Line Produksi
          </h2>
          <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto">
            Pilih line produksi di bawah ini untuk menampilkan dashboard dokumen kerja digital di layar TV Display secara realtime.
          </p>
        </div>

        {isLoading && lines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="h-10 w-10 text-emerald-400 animate-spin mb-4" />
            <p className="text-slate-400 text-sm">Memuat daftar line produksi...</p>
          </div>
        ) : error && lines.length === 0 ? (
          <div className="bg-red-950/20 border border-red-900/30 rounded-2xl p-8 text-center max-w-md w-full">
            <Activity className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-red-400">Terjadi Kesalahan</h3>
            <p className="text-slate-400 text-sm mt-2">{error}</p>
          </div>
        ) : lines.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-12 text-center max-w-md w-full">
            <Activity className="h-12 w-12 text-slate-600 mx-auto mb-4 animate-pulse" />
            <h3 className="text-xl font-bold text-slate-300">Tidak ada Line produksi aktif</h3>
            <p className="text-slate-500 text-sm mt-2">
              Silakan tambahkan atau aktifkan Line produksi terlebih dahulu melalui dashboard admin.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 w-full">
            {lines.map((line) => (
              <Link
                key={line.id}
                href={`/display/${line.id}`}
                className="group relative bg-slate-900/90 hover:bg-slate-800/95 border border-slate-800/60 hover:border-emerald-500/50 rounded-3xl p-8 transition-colors duration-200 flex flex-col justify-between min-h-[220px]"
              >
                <div className="flex items-start justify-between">
                  <div className="h-14 w-14 rounded-2xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center group-hover:bg-emerald-950/30 group-hover:border-emerald-500/30 transition-colors duration-200">
                    <Monitor className="h-7 w-7 text-slate-400 group-hover:text-emerald-400 transition-colors duration-200" />
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full bg-emerald-950/40 border border-emerald-500/20 px-3 py-1 text-[11px] font-medium text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Ready
                  </div>
                </div>

                <div className="mt-6">
                  <h3 className="text-3xl font-black text-white group-hover:text-emerald-400 transition-colors duration-200 uppercase tracking-wide">
                    {line.name}
                  </h3>
                  <p className="text-slate-400 text-sm mt-2 line-clamp-2">
                    {line.description || "Tidak ada deskripsi untuk line ini."}
                  </p>
                </div>

                <div className="mt-8 pt-4 border-t border-slate-800/60 flex items-center justify-between text-xs font-semibold text-slate-500 group-hover:text-emerald-400 transition-colors duration-200">
                  <span>Buka Layar TV Display</span>
                  <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform duration-200" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-slate-900 bg-slate-950/40 py-6 text-center text-xs text-slate-600">
        © 2026 PT FUTABA. Production & Knowledge Information System.
      </footer>
    </div>
  );
}
