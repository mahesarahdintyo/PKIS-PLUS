import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "@/components/ui/login-form";
import { LogoutButton } from "@/components/ui/logout-button";
import Link from "next/link";
import Image from "next/image";
import { AppHeader } from "@/components/ui/app-header";
import { ArrowRight, ShieldCheck, User, Tv, Activity } from "lucide-react";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let profile = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    profile = data;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col justify-between">
      {/* Header */}
      <AppHeader disableLogoLink />

      <main className="flex-1 flex flex-col items-center justify-center p-6 bg-gradient-to-b from-slate-50 to-slate-100 select-none">
        {!user ? (
          <LoginForm />
        ) : (
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200/80 shadow-xl p-8 transition-all hover:shadow-2xl text-center">
            {/* Logged In Info */}
            <Image
              src="/pkis-logo-wordmark(final).png"
              alt="PKIS Logo"
              width={180}
              height={60}
              className="h-auto w-44 object-contain mx-auto mb-4 select-none"
              priority
            />
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">
              Anda Sudah Masuk
            </h2>
            <p className="text-xs text-slate-400 mt-1 mb-6 font-medium">
              Username: <span className="text-slate-600 font-semibold">{user.email ? user.email.split("@")[0] : ""}</span>
            </p>

            <div className="space-y-3 text-left">
              {profile?.role === "admin" ? (
                <>
                  <Link
                    href="/admin"
                    className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-md hover:shadow-lg"
                  >
                    <ShieldCheck className="h-5 w-5" />
                    <span>Ke Dashboard Admin</span>
                    <ArrowRight className="h-4 w-4 ml-auto" />
                  </Link>

                  <Link
                    href="/operator"
                    className="w-full h-11 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition duration-200 flex items-center justify-center gap-2 cursor-pointer border border-slate-200"
                  >
                    <User className="h-5 w-5 text-slate-500" />
                    <span>Akses Sebagai Operator</span>
                    <ArrowRight className="h-4 w-4 ml-auto text-slate-400" />
                  </Link>

                  <Link
                    href="/system"
                    className="w-full h-11 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition duration-200 flex items-center justify-center gap-2 cursor-pointer border border-slate-200"
                  >
                    <Activity className="h-5 w-5 text-slate-500" />
                    <span>Status & Monitoring Sistem</span>
                    <ArrowRight className="h-4 w-4 ml-auto text-slate-400" />
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/operator"
                    className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl transition duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-md hover:shadow-lg"
                  >
                    <User className="h-5 w-5" />
                    <span>Ke Dashboard Operator</span>
                    <ArrowRight className="h-4 w-4 ml-auto" />
                  </Link>

                  <Link
                    href="/display"
                    className="w-full h-11 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition duration-200 flex items-center justify-center gap-2 cursor-pointer border border-slate-200"
                  >
                    <Tv className="h-5 w-5 text-slate-500" />
                    <span>Lihat Status Display</span>
                    <ArrowRight className="h-4 w-4 ml-auto text-slate-400" />
                  </Link>
                </>
              )}

              <div className="pt-4 mt-2 border-t border-slate-100">
                <LogoutButton />
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-gray-200 py-6 text-center text-gray-500 text-sm">
        © 2026 PKIS. Semua hak dilindungi.
      </footer>
    </div>
  );
}
