"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function OperatorGateClient() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function checkAndRedirect() {
      const supabase = createClient();
      const { data: { user }, error } = await supabase.auth.getUser();

      if (cancelled) return;

      if (error || !user) {
        window.location.href = "/";
        return;
      }

      router.replace("/operator/machines");
    }

    checkAndRedirect();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
        <p className="text-sm text-muted-foreground">Mengarahkan ke line produksi...</p>
      </div>
    </main>
  );
}
