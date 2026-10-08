"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { User, Lock, Eye, EyeOff, Loader2, AlertCircle, Download } from "lucide-react";
import Image from "next/image";

export function LoginForm() {
  const router = useRouter();

  // State form
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // State PWA
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

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    // 1. Mencegah perilaku default submit form HTML
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password.trim()) {
      const msg = "Username/Email dan password wajib diisi.";
      setError(msg);
      alert(msg);
      return;
    }

    setIsLoading(true);

    try {
      // Menangani format input jika user memasukkan email lengkap atau sekadar username
      const emailValue = username.includes("@")
        ? username.trim().toLowerCase()
        : username.trim().toLowerCase() === "admin"
        ? "admin@pabrik.local"
        : username.trim().toLowerCase() === "operator"
        ? "operator@pabrik.local"
        : `${username.trim().toLowerCase()}@futaba.co.id`;

      // 2 & 3. POST request ke endpoint /api/auth/login dengan body email/username dan password
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: emailValue,
          username: username.trim(),
          password,
        }),
      });

      const data = await res.json();

      // 4. Jika response berhasil (res.ok)
      if (res.ok) {
        // Simpan session ke localStorage untuk sinkronisasi client helper
        if (typeof window !== "undefined" && data?.user) {
          localStorage.setItem(
            "pkis_user_session",
            JSON.stringify({ user: data.user, access_token: data.token })
          );
        }

        // Arahkan ke rute dashboard yang sesuai berdasarkan role pengguna
        const role = data?.role || data?.user?.app_metadata?.role || data?.user?.user_metadata?.role;
        let targetUrl = "/operator";
        if (role === "admin") {
          targetUrl = "/admin";
        } else if (role === "leader") {
          targetUrl = "/admin/andon-settings";
        }
        
        // Gunakan full page navigation agar cookie session langsung terkirim dan terbaca oleh Server Component
        window.location.href = targetUrl;
        return;
      } else {
        // 5. Jika gagal, munculkan peringatan (alert/toast) bahwa password salah
        const errorMessage = data?.error || "Password salah atau kredensial tidak valid.";
        setError(errorMessage);
        alert(errorMessage);
      }
    } catch (err: any) {
      console.error("[Login] Network or server error:", err);
      const networkError = "Terjadi kesalahan jaringan atau server. Silakan coba lagi.";
      setError(networkError);
      alert(networkError);
    } finally {
      setIsLoading(false);
    }
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
        <form
          action="javascript:void(0);"
          onSubmit={(e) => {
            e.preventDefault();
            handleLogin(e);
          }}
          className="space-y-5"
        >
          {/* Username / Email field */}
          <div className="space-y-1.5">
            <label
              htmlFor="username"
              className="text-xs font-bold text-slate-500 uppercase tracking-wider block"
            >
              Username / Email
            </label>
            <div className="relative flex items-center rounded-xl border border-slate-300 bg-white hover:border-slate-400 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition duration-200 px-3.5">
              <User className="h-5 w-5 text-slate-400 mr-2.5 flex-shrink-0" />
              <input
                id="username"
                name="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="operator@pabrik.local atau operator1"
                disabled={isLoading}
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={isLoading}
                className="h-11 w-full bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none pr-8"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
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
            disabled={isLoading}
            className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl transition duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {isLoading ? (
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
