"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const MACHINE_STORAGE_KEY = "futaba.operator.selectedMachine";
const VALID_SLUGS = ["tandem", "blanking", "transfer-2000t", "transfer-800t", "pc200t"];

export default function OperatorGateClient() {
  const router = useRouter();

  useEffect(() => {
    try {
      const savedSlug = localStorage.getItem(MACHINE_STORAGE_KEY);
      if (savedSlug && VALID_SLUGS.includes(savedSlug)) {
        router.replace(`/operator/machines/${savedSlug}`);
        return;
      }
    } catch {}
    router.replace("/operator/machines");
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
