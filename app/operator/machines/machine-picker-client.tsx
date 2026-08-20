"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { AppHeader } from "@/components/ui/app-header";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LogoutButton } from "@/components/ui/logout-button";
import "@/app/admin/dashboard/produksi.css";

const MACHINE_CARDS = [
  { slug: "tandem", label: "Tandem", hint: "PA-1 s/d PA-10", icon: "⚙️" },
  { slug: "blanking", label: "Blanking", hint: "Blanking 500t", icon: "⚙️" },
  { slug: "transfer-2000t", label: "Transfer 2000t", hint: "PT-1", icon: "⚙️" },
  { slug: "transfer-800t", label: "Transfer 800t", hint: "PT-2", icon: "⚙️" },
  { slug: "pc200t", label: "PC200t", hint: "PC-1, PC-2", icon: "⚙️" },
];

export default function MachinePickerClient() {
  const router = useRouter();

  const handleSelectMachine = (slug: string) => {
    router.push(`/operator/machines/${slug}`);
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <AppHeader
        disableLogoLink
        logoAside={
          <div className="flex flex-col border-slate-200 sm:border-l sm:pl-4">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Pilih Mesin
            </span>
            <span className="text-base font-bold text-emerald-700">
              Line Produksi
            </span>
          </div>
        }
      >
        <ThemeToggle variant="icon" />
        <LogoutButton variant="header" />
      </AppHeader>

      <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
        <div className="page-header">
          <h1 className="page-title text-2xl font-bold font-display">
            <span className="eyebrow block text-xs font-semibold text-blue-400 uppercase tracking-wider mb-0.5">
              Input
            </span>
            Pilih Line Produksi
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Pilih line / mesin produksi untuk mulai mencatat dan melihat data operasional.
          </p>
        </div>

        <div className="machine-cards-grid">
          {MACHINE_CARDS.map((m) => (
            <button
              key={m.slug}
              type="button"
              onClick={() => handleSelectMachine(m.slug)}
              className="machine-card card-glow-info text-left cursor-pointer w-full"
            >
              <div className="machine-card-top">
                <span className="machine-card-name">{m.label}</span>
                <span style={{ fontSize: 22 }}>{m.icon}</span>
              </div>
              <div className="hint text-xs text-muted-foreground">{m.hint}</div>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}
