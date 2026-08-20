"use client";

import { useState } from "react";
import { LogOut, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface LogoutButtonProps {
  className?: string;
  variant?: "header" | "default";
}

export function LogoutButton({ className = "", variant = "default" }: LogoutButtonProps) {
  const [isPending, setIsPending] = useState(false);

  const handleLogout = async () => {
    setIsPending(true);
    try {
      localStorage.removeItem("futaba.operator.selectedMachine");
      localStorage.removeItem("futaba.operator.location");
    } catch {}

    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (err) {
      console.error("SignOut error:", err);
    } finally {
      window.location.href = "/";
    }
  };

  if (variant === "header") {
    return (
      <button
        onClick={handleLogout}
        disabled={isPending}
        className={`h-9 px-4 bg-rose-50 hover:bg-rose-100 text-rose-600 font-medium text-sm rounded-lg transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 border border-rose-100 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        title="Keluar"
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin text-rose-600" />
        ) : (
          <LogOut className="h-4 w-4" />
        )}
        <span>Keluar</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleLogout}
      disabled={isPending}
      className={`w-full h-11 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 font-bold text-sm rounded-xl transition duration-200 flex items-center justify-center gap-2 cursor-pointer border border-rose-100 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin text-rose-600" />
      ) : (
        <LogOut className="h-4 w-4" />
      )}
      <span>Keluar dari Akun</span>
    </button>
  );
}
