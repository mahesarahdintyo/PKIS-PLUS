"use client";

import { useEffect, useState, useTransition } from "react";
import { login } from "@/app/actions/auth";
import { User, Lock, Eye, EyeOff, Loader2, AlertCircle, Download } from "lucide-react";
import Image from "next/image";

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [canInstall, setCanInstall] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    const checkPwaStatus = () => {
      const windowWithPwa = window as unknown as { deferredPwaPrompt?: any };
      if (windowWithPwa.deferredPwaPrompt) {
        setCanInstall(true);
      }
      const isIosDevice =
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        ("standalone" in navigator && (navigator as unknown as { standalone: boolean }).standalone);
      setIsIos(isIosDevice && !isStandalone);
    };

    checkPwaStatus();

    const handlePwaAvailable = () => {
      setCanInstall(true);
    };

    window.addEventListener("pwa-install-available", handlePwaAvailable);
    return () => {
      window.removeEventListener("pwa-install-available", handlePwaAvailable);
    };
  }, []);

  const handleInstallPwa = async () => {
    if (isIos) {
      setShowIosGuide(!showIosGuide);
      return;
    }
    const windowWithPwa = window as unknown as { deferredPwaPrompt?: any };
    if (windowWithPwa.deferredPwaPrompt) {
      windowWithPwa.deferredPwaPrompt.prompt();
      const choiceResult = await windowWithPwa.deferredPwaPrompt.userChoice;
      if (choiceResult.outcome === "accepted") {
        console.log("User accepted PWA installation");
      }
      windowWithPwa.deferredPwaPrompt = null;
      setCanInstall(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;

    if (!username.trim() || !password.trim()) {
      setError("Silakan masukkan username dan password Anda.");
      return;
    }

    startTransition(async () => {
      try {
        const result = await login(null, formData);

        if (result?.error) {
          setError(result.error);
        } else if (result?.success && result?.redirectUrl) {
          // Redirect using window.location for a full reload/redirect to ensure session is active
          window.location.href = result.redirectUrl;
        }
      } catch (err) {
        setError("Terjadi kesalahan sistem. Silakan coba lagi.");
        console.error(err);
      }
    });
  };

  return (
    <div className="w-full max-w-md animate-fadeIn">
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xl p-8 transition-all hover:shadow-2xl">
        {/* Brand / Logo */}
        <div className="flex flex-col items-center mb-8">
          <Image
            src="/pkis-logo-wordmark(final).png"
            alt="PKIS Logo"
            width={180}
            height={60}
            className="h-auto w-44 object-contain mb-3 select-none"
            priority
          />
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">
            Digital Document System
          </h2>
          <p className="text-xs text-slate-400 mt-1 text-center font-medium">
            Masuk untuk mengakses Dashboard Admin & Operator
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 animate-fadeIn">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <span className="font-medium leading-relaxed">{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Username field */}
          <div className="space-y-1.5">
            <label
              htmlFor="username"
              className="text-xs font-bold text-slate-500 uppercase tracking-wider block"
            >
              Username
            </label>
            <div className="relative flex items-center rounded-xl border border-slate-300 bg-white hover:border-slate-400 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition duration-200 px-3.5">
              <User className="h-5 w-5 text-slate-400 mr-2.5 flex-shrink-0" />
              <input
                id="username"
                name="username"
                type="text"
                placeholder="operator1"
                disabled={isPending}
                className="h-11 w-full bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none"
                autoComplete="username"
                required
              />
            </div>
          </div>

          {/* Password field */}
          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="text-xs font-bold text-slate-500 uppercase tracking-wider block"
            >
              Password
            </label>
            <div className="relative flex items-center rounded-xl border border-slate-300 bg-white hover:border-slate-400 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition duration-200 px-3.5">
              <Lock className="h-5 w-5 text-slate-400 mr-2.5 flex-shrink-0" />
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                disabled={isPending}
                className="h-11 w-full bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none pr-8"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isPending}
                className="absolute right-3.5 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isPending}
            className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl transition duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-white" />
                <span>Memproses...</span>
              </>
            ) : (
              <span>Masuk Ke Sistem</span>
            )}
          </button>
        </form>

        {/* PWA Install Button (Cleanly integrated inside login card) */}
        {(canInstall || isIos) && (
          <div className="pt-4 border-t border-slate-100 mt-5 animate-fadeIn">
            <button
              type="button"
              onClick={handleInstallPwa}
              className="w-full h-10 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 font-semibold text-xs rounded-xl transition duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-[0.99]"
            >
              <Download className="h-4 w-4 text-emerald-600 flex-shrink-0" />
              <span>Install Aplikasi Futaba PKIS</span>
            </button>
            {showIosGuide && (
              <p className="text-[11px] text-slate-500 mt-2 text-center bg-slate-50 p-2.5 rounded-xl border border-slate-200 leading-relaxed animate-fadeIn">
                Untuk iOS Safari: Tekan tombol <span className="font-bold text-slate-700">Share ⎋</span> lalu pilih <span className="font-bold text-slate-700">&apos;Add to Home Screen&apos;</span>.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
