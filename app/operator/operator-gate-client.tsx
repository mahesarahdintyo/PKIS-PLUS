"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const MACHINE_STORAGE_KEY = "futaba.operator.selectedMachine";
const VALID_SLUGS = ["tandem", "blanking", "transfer-2000t", "transfer-800t", "pc200t"];

export default function OperatorGateClient() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function checkAndRedirect() {
      // ALWAYS get user from Supabase client-side — never trust props/cache
      const supabase = createClient();
      const { data: { user }, error } = await supabase.auth.getUser();

      if (cancelled) return;

      if (error || !user) {
        // Not authenticated — go to login
        window.location.href = "/";
        return;
      }

      const currentUserId = user.id;

      try {
        const raw = localStorage.getItem(MACHINE_STORAGE_KEY);
        if (raw) {
          let parsed: unknown;
          try {
            parsed = JSON.parse(raw);
          } catch {
            // Corrupt / old plain-string format — clear and fall through to picker
            console.log("[gate] localStorage corrupt/old format, clearing.");
            localStorage.removeItem(MACHINE_STORAGE_KEY);
            router.replace("/operator/machines");
            return;
          }

          if (
            parsed &&
            typeof parsed === "object" &&
            (parsed as Record<string, unknown>).userId === currentUserId &&
            typeof (parsed as Record<string, unknown>).machineSlug === "string" &&
            VALID_SLUGS.includes((parsed as Record<string, unknown>).machineSlug as string)
          ) {
            const slug = (parsed as Record<string, unknown>).machineSlug as string;
            console.log(
              `[gate] match — currentUserId=${currentUserId}, storedUserId=${(parsed as Record<string, unknown>).userId}, slug=${slug}`
            );
            router.replace(`/operator/machines/${slug}`);
            return;
          }

          // Mismatch: stored for a different user — clear and send to picker
          console.log(
            `[gate] userId mismatch — currentUserId=${currentUserId}, storedUserId=${(parsed as Record<string, unknown>).userId ?? "?"}`
          );
          localStorage.removeItem(MACHINE_STORAGE_KEY);
        } else {
          console.log(`[gate] no stored machine — currentUserId=${currentUserId}`);
        }
      } catch {
        // localStorage unavailable (private mode, etc.)
      }

      router.replace("/operator/machines");
    }

    checkAndRedirect();

    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
        <p className="text-sm text-muted-foreground">Mengarahkan ke line produksi...</p>
      </div>
    </main>
  );
}
