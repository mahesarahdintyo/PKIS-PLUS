"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, History } from "lucide-react";
import ProductionReportsDashboard from "@/components/admin/ProductionReportsDashboard";
import ProductionLogDashboard from "@/components/admin/ProductionLogDashboard";

export default function LaporanProduksiClient() {
  const [activeTab, setActiveTab] = useState<"laporan" | "log">("laporan");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-2 text-xs font-semibold rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors touch-manipulation self-start"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            Kembali ke Admin
          </Link>

          {/* Tab Switcher */}
          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setActiveTab("laporan")}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                activeTab === "laporan"
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <FileText className="h-4 w-4" />
              Laporan Produksi
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("log")}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer ${
                activeTab === "log"
                  ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <History className="h-4 w-4" />
              Riwayat Produksi (All Lines)
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "laporan" ? (
          <ProductionReportsDashboard />
        ) : (
          <ProductionLogDashboard />
        )}
      </main>
    </div>
  );
}

