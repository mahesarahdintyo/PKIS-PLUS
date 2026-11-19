"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  User,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Building2,
  BadgeCheck,
  ArrowRight,
} from "lucide-react";
import Image from "next/image";

interface LineOption {
  id: string;
  name: string;
}

export function RegisterForm() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [lineId, setLineId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [lines, setLines] = useState<LineOption[]>([]);
  const [isLoadingLines, setIsLoadingLines] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Load daftar line untuk pilihan penugasan
  useEffect(() => {
    let isMounted = true;
    const fetchLines = async () => {
      setIsLoadingLines(true);
      try {
        const res = await fetch("/api/lines?includeHidden=true");
        if (res.ok) {
          const data = await res.json();
          if (isMounted && Array.isArray(data)) {
            setLines(data);
          }
        }
      } catch (err) {
        console.warn("Gagal memuat daftar line:", err);
      } finally {
        if (isMounted) setIsLoadingLines(false);
      }
    };
    fetchLines();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password.trim()) {
      setError("Username dan password wajib diisi.");
      return;
    }

    if (password.length < 6) {
      setError("Password minimal 6 karakter.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Konfirmasi password tidak cocok dengan password.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          fullName: fullName.trim() || username.trim(),
          password,
          lineId: lineId || null,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setIsSuccess(true);
      } else {
        setError(data.error || "Gagal melakukan pendaftaran.");
      }
    } catch (err) {
      console.error("Register error:", err);
      setError("Terjadi kesalahan jaringan atau server. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md animate-fadeIn">
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xl p-8 transition-all hover:shadow-2xl">
        {/* Brand / Logo */}
        <div className="flex flex-col items-center mb-6">
          <Image
            src="/pkis-logo-wordmark(final).png"
            alt="PKIS Logo"
            width={180}
            height={60}
            className="h-auto w-44 object-contain mb-3 select-none"
            priority
          />
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">
            Pendaftaran Akun Baru
          </h2>
          <p className="text-xs text-slate-400 mt-1 text-center font-medium">
            Daftar untuk mengakses sistem PKIS-PLUS
          </p>
        </div>

        {/* Success State */}
        {isSuccess ? (
          <div className="text-center py-6 space-y-4 animate-fadeIn">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                Pendaftaran Berhasil!
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Akun Anda telah berhasil dibuat dengan role default <span className="font-semibold text-slate-700">Operator</span>.
                Anda dapat langsung masuk ke sistem sekarang.
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/"
                className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl transition duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-md hover:shadow-lg"
              >
                <span>Masuk Sekarang</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* Error Alert */}
            {error && (
              <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-800 animate-fadeIn">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <span className="font-medium text-xs leading-relaxed">{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleRegister} className="space-y-4">
              {/* Username field */}
              <div className="space-y-1">
                <label
                  htmlFor="reg-username"
                  className="text-xs font-bold text-slate-500 uppercase tracking-wider block"
                >
                  Username / NPK / Email <span className="text-red-500">*</span>
                </label>
                <div className="relative flex items-center rounded-xl border border-slate-300 bg-white hover:border-slate-400 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition duration-200 px-3.5">
                  <User className="h-5 w-5 text-slate-400 mr-2.5 flex-shrink-0" />
                  <input
                    id="reg-username"
                    name="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Contoh: op_tandem atau npk1234"
                    disabled={isLoading}
                    className="h-10 w-full bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none"
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              {/* Full Name field */}
              <div className="space-y-1">
                <label
                  htmlFor="reg-fullname"
                  className="text-xs font-bold text-slate-500 uppercase tracking-wider block"
                >
                  Nama Lengkap
                </label>
                <div className="relative flex items-center rounded-xl border border-slate-300 bg-white hover:border-slate-400 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition duration-200 px-3.5">
                  <BadgeCheck className="h-5 w-5 text-slate-400 mr-2.5 flex-shrink-0" />
                  <input
                    id="reg-fullname"
                    name="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Contoh: Budi Santoso"
                    disabled={isLoading}
                    className="h-10 w-full bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none"
                    autoComplete="name"
                  />
                </div>
              </div>

              {/* Line Assignment */}
              <div className="space-y-1">
                <label
                  htmlFor="reg-line"
                  className="text-xs font-bold text-slate-500 uppercase tracking-wider block"
                >
                  Penugasan Line (Opsional)
                </label>
                <div className="relative flex items-center rounded-xl border border-slate-300 bg-white hover:border-slate-400 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition duration-200 px-3.5">
                  <Building2 className="h-5 w-5 text-slate-400 mr-2.5 flex-shrink-0" />
                  <select
                    id="reg-line"
                    name="lineId"
                    value={lineId}
                    onChange={(e) => setLineId(e.target.value)}
                    disabled={isLoading || isLoadingLines}
                    className="h-10 w-full bg-transparent text-sm text-slate-800 outline-none cursor-pointer"
                  >
                    <option value="">Pilih Line (Bisa diatur nanti oleh Admin)</option>
                    {lines.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Password field */}
              <div className="space-y-1">
                <label
                  htmlFor="reg-password"
                  className="text-xs font-bold text-slate-500 uppercase tracking-wider block"
                >
                  Password (Minimal 6 karakter) <span className="text-red-500">*</span>
                </label>
                <div className="relative flex items-center rounded-xl border border-slate-300 bg-white hover:border-slate-400 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition duration-200 px-3.5">
                  <Lock className="h-5 w-5 text-slate-400 mr-2.5 flex-shrink-0" />
                  <input
                    id="reg-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={isLoading}
                    className="h-10 w-full bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none pr-8"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                    className="absolute right-3.5 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password field */}
              <div className="space-y-1">
                <label
                  htmlFor="reg-confirm-password"
                  className="text-xs font-bold text-slate-500 uppercase tracking-wider block"
                >
                  Konfirmasi Password <span className="text-red-500">*</span>
                </label>
                <div className="relative flex items-center rounded-xl border border-slate-300 bg-white hover:border-slate-400 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition duration-200 px-3.5">
                  <Lock className="h-5 w-5 text-slate-400 mr-2.5 flex-shrink-0" />
                  <input
                    id="reg-confirm-password"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={isLoading}
                    className="h-10 w-full bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none pr-8"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={isLoading}
                    className="absolute right-3.5 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl transition duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed mt-3"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                    <span>Mendaftarkan...</span>
                  </>
                ) : (
                  <span>Daftar Akun</span>
                )}
              </button>
            </form>

            {/* Link Back to Login */}
            <div className="mt-5 text-center">
              <p className="text-xs text-slate-500 font-medium">
                Sudah memiliki akun?{" "}
                <Link
                  href="/"
                  className="text-blue-600 hover:text-blue-700 font-bold hover:underline transition-colors cursor-pointer"
                >
                  Masuk di sini
                </Link>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
