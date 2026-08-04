"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Log error ke console untuk debugging
    console.error("[App Error]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col items-center justify-center p-6 select-none animate-fadeIn">
      <div className="bg-white rounded-2xl border border-red-100 shadow-xl p-8 max-w-md w-full text-center space-y-6">
        {/* Icon */}
        <div className="flex items-center justify-center">
          <div className="h-16 w-16 rounded-full bg-red-50 border border-red-100 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Terjadi Kesalahan
          </h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            Halaman mengalami kendala yang tidak terduga. Coba muat ulang
            halaman atau kembali ke halaman sebelumnya.
          </p>
          {process.env.NODE_ENV === "development" && error?.message && (
            <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 p-3 text-left">
              <p className="text-xs font-mono text-slate-600 break-all">
                {error.message}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            onClick={() => window.history.back()}
            className="flex-1 h-10 flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </button>
          <button
            onClick={reset}
            className="flex-1 h-10 flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" />
            Muat Ulang
          </button>
        </div>

        {/* Error digest */}
        {error?.digest && (
          <p className="text-[11px] text-slate-400 font-mono">
            Kode: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
