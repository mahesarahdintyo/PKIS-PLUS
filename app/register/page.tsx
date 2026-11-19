import { getCurrentUserProfile } from "@/lib/services/auth-server";
import { RegisterForm } from "@/components/ui/register-form";
import { AppHeader } from "@/components/ui/app-header";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Pendaftaran Akun | PKIS-PLUS",
  description: "Daftar akun baru untuk mengakses sistem digital document PKIS-PLUS",
};

export default async function RegisterPage() {
  const { user } = await getCurrentUserProfile();

  // Jika user sudah login, arahkan ke halaman utama
  if (user) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col justify-between">
      {/* Header */}
      <AppHeader disableLogoLink />

      <main className="flex-1 flex flex-col items-center justify-center p-6 bg-gradient-to-b from-slate-50 to-slate-100 select-none">
        <RegisterForm />
      </main>

      <footer className="py-4 text-center text-xs text-slate-400 border-t border-slate-200/60 bg-white">
        &copy; {new Date().getFullYear()} PT Futaba Industrial Indonesia. All rights reserved.
      </footer>
    </div>
  );
}
