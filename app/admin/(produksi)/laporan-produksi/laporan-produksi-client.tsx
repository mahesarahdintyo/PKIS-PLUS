"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ProductionReportsDashboard from "@/components/admin/ProductionReportsDashboard";

export default function LaporanProduksiClient() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3 py-2 text-xs font-semibold rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors touch-manipulation"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            Kembali ke Admin
          </Link>
        </div>
        <ProductionReportsDashboard />
      </main>
    </div>
  );
}
