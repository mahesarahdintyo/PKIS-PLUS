"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, Filter, RefreshCw, AlertTriangle, Activity } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "sonner";
import "@/app/admin/(produksi)/produksi.css";

const PAGE_SIZE = 1000;

const MACHINES = [
  { key: "all", label: "Semua Mesin" },
  { key: "tandem", label: "Tandem" },
  { key: "blanking", label: "Blanking" },
  { key: "transfer_2000t", label: "Transfer 2000t" },
  { key: "transfer_800t", label: "Transfer 800t" },
  { key: "pc200t", label: "PC200t" },
];

const CATEGORY_OPTIONS = [
  { value: "all", label: "Semua Kategori" },
  { value: "MESIN", label: "MESIN" },
  { value: "DIES", label: "DIES" },
  { value: "FINGER", label: "FINGER" },
  { value: "LINE STOP", label: "LINE STOP" },
  { value: "SMALL STOP", label: "SMALL STOP" },
  { value: "OTHER", label: "OTHER" },
];

function getMachineLabel(key: string): string {
  const m = MACHINES.find((item) => item.key === key);
  return m ? m.label : key;
}

function formatDate(iso?: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(iso?: string | null): string {
  if (!iso) return "--:--";
  return new Date(iso).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function DowntimeLogClient() {
  const supabase = useMemo(() => createClient(), []);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const sevenDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  }, []);

  const [filterMesin, setFilterMesin] = useState<string>("all");
  const [filterTanggalDari, setFilterTanggalDari] = useState<string>(sevenDaysAgo);
  const [filterTanggalSampai, setFilterTanggalSampai] = useState<string>(today);
  const [filterKategori, setFilterKategori] = useState<string>("all");

  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [page, setPage] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [downtimeRows, setDowntimeRows] = useState<any[]>([]);

  const channelNameRef = useRef<string>(
    "downtime_log_watch_" + Math.random().toString(36).slice(2)
  );

  const fetchDowntime = useCallback(async (targetPage = 0) => {
    if (targetPage > 0) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const from = targetPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let q = supabase
        .from("prod_downtime_log" as any)
        .select("*")
        .eq("is_active", true)
        .order("waktu_awal", { ascending: false })
        .range(from, to);

      if (filterMesin !== "all") {
        q = q.eq("mesin", filterMesin);
      }

      if (filterKategori !== "all") {
        q = q.eq("kategori", filterKategori);
      }

      if (filterTanggalDari) {
        const startIso = new Date(`${filterTanggalDari}T00:00:00`).toISOString();
        q = q.gte("waktu_awal", startIso);
      }

      if (filterTanggalSampai) {
        const endIso = new Date(`${filterTanggalSampai}T23:59:59.999`).toISOString();
        q = q.lte("waktu_awal", endIso);
      }

      const { data, error } = await q;
      if (error) throw error;

      const rows = (data || []).map((r: any) => {
        let durasi = r.durasi_menit || r.durasi;
        if (!durasi && r.waktu_awal && r.waktu_akhir) {
          durasi = Math.round(
            (new Date(r.waktu_akhir).getTime() - new Date(r.waktu_awal).getTime()) / 60000
          );
        }
        return {
          ...r,
          durasi_menit: durasi || 0,
        };
      });

      if (targetPage === 0) {
        setDowntimeRows(rows);
      } else {
        setDowntimeRows((prev) => [...prev, ...rows]);
      }
      setHasMore((data?.length ?? 0) === PAGE_SIZE);
      setPage(targetPage);
    } catch (err: any) {
      console.error("Downtime fetch error:", err?.message || err);
      toast.error("Gagal memuat log downtime: " + (err?.message || ""));
    } finally {
      if (targetPage > 0) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  }, [filterMesin, filterKategori, filterTanggalDari, filterTanggalSampai, supabase]);

  useEffect(() => {
    fetchDowntime(0);
  }, [fetchDowntime]);

  // Supabase Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(channelNameRef.current)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "prod_downtime_log" },
        () => {
          fetchDowntime(0);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDowntime, supabase]);

  const resetFilters = () => {
    setFilterMesin("all");
    setFilterTanggalDari(sevenDaysAgo);
    setFilterTanggalSampai(today);
    setFilterKategori("all");
  };

  const totalKejadian = downtimeRows.length;
  const totalDurasiMenit = useMemo(() => {
    return downtimeRows.reduce((acc, row) => acc + (Number(row.durasi_menit) || 0), 0);
  }, [downtimeRows]);
  const avgDurasiMenit = totalKejadian > 0 ? Math.round(totalDurasiMenit / totalKejadian) : 0;

  return (
    <div className="app-shell machine-hub-container">
      <main className="main max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 text-xs font-semibold rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors touch-manipulation"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            Kembali ke Admin
          </Link>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="page-header mb-0">
            <h1 className="page-title text-2xl font-bold font-display flex items-center gap-3">
              <span className="eyebrow block text-xs font-semibold text-rose-500 uppercase tracking-wider mb-0.5">
                Monitoring Produksi
              </span>
              <span>Downtime Log Konsolidasi</span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Pantau riwayat downtime seluruh mesin produksi secara real-time lintas lini.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchDowntime(0)}
              disabled={loading}
              className="inline-flex items-center gap-2 min-h-[40px] px-3.5 py-2 text-xs font-bold rounded-xl border border-border bg-card text-foreground hover:bg-muted active:scale-95 transition-all cursor-pointer touch-manipulation"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Filter Panel */}
        <Card className="dash-panel card-glow-info p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3 border-b border-border pb-2.5">
            <div className="flex items-center gap-2 text-sm font-bold">
              <Filter className="h-4 w-4 text-primary" />
              <span>Filter Log Downtime</span>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={resetFilters}
              className="h-8 text-xs px-3"
            >
              Reset Filter
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="field">
              <label className="text-xs font-semibold block mb-1">Mesin</label>
              <Select
                value={filterMesin}
                onChange={(e) => setFilterMesin(e.target.value)}
                className="w-full min-h-[44px]"
              >
                {MACHINES.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="field">
              <label className="text-xs font-semibold block mb-1">Dari Tanggal</label>
              <Input
                type="date"
                value={filterTanggalDari}
                onChange={(e) => setFilterTanggalDari(e.target.value)}
                className="w-full min-h-[44px]"
              />
            </div>

            <div className="field">
              <label className="text-xs font-semibold block mb-1">Sampai Tanggal</label>
              <Input
                type="date"
                value={filterTanggalSampai}
                onChange={(e) => setFilterTanggalSampai(e.target.value)}
                className="w-full min-h-[44px]"
              />
            </div>

            <div className="field">
              <label className="text-xs font-semibold block mb-1">Kategori</label>
              <Select
                value={filterKategori}
                onChange={(e) => setFilterKategori(e.target.value)}
                className="w-full min-h-[44px]"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </Card>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
          <Card className="dash-panel p-4 flex items-center gap-3.5 border-l-4 border-l-rose-500">
            <div className="h-11 w-11 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500 shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                Total Kejadian
              </span>
              <span className="text-xl sm:text-2xl font-bold font-display">
                {totalKejadian}{" "}
                <span className="text-xs font-normal text-muted-foreground font-sans">kali</span>
              </span>
            </div>
          </Card>

          <Card className="dash-panel p-4 flex items-center gap-3.5 border-l-4 border-l-amber-500">
            <div className="h-11 w-11 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                Total Durasi Downtime
              </span>
              <span className="text-xl sm:text-2xl font-bold font-display">
                {totalDurasiMenit}{" "}
                <span className="text-xs font-normal text-muted-foreground font-sans">
                  menit ({(totalDurasiMenit / 60).toFixed(1)} jam)
                </span>
              </span>
            </div>
          </Card>

          <Card className="dash-panel p-4 flex items-center gap-3.5 border-l-4 border-l-blue-500">
            <div className="h-11 w-11 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                Rata-rata Durasi
              </span>
              <span className="text-xl sm:text-2xl font-bold font-display">
                {avgDurasiMenit}{" "}
                <span className="text-xs font-normal text-muted-foreground font-sans">
                  menit / kejadian
                </span>
              </span>
            </div>
          </Card>
        </div>

        {/* Data Table */}
        <Card className="dash-panel card-glow-info overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="font-bold text-base flex items-center gap-2">
              <span>Data Riwayat Downtime</span>
              <span className="text-xs font-mono font-normal px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {downtimeRows.length} baris
              </span>
            </h3>
          </div>

          <div className="table-wrap">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 font-semibold text-muted-foreground">
                  <th className="p-3">Mesin</th>
                  <th className="p-3">Tanggal</th>
                  <th className="p-3">Waktu</th>
                  <th className="p-3 text-right">Durasi</th>
                  <th className="p-3">Kategori</th>
                  <th className="p-3">Problem</th>
                  <th className="p-3">Penyebab</th>
                  <th className="p-3">Countermeasure</th>
                  <th className="p-3">Stasiun</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                        <span>Memuat data downtime...</span>
                      </div>
                    </td>
                  </tr>
                ) : downtimeRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-muted-foreground">
                      Tidak ada data downtime yang sesuai dengan filter yang dipilih.
                    </td>
                  </tr>
                ) : (
                  downtimeRows.map((row, idx) => (
                    <tr key={row.id || idx} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-bold whitespace-nowrap">
                        <span className="px-2 py-1 rounded-md bg-card border border-border text-foreground font-mono text-xs">
                          {getMachineLabel(row.mesin)}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap font-medium text-foreground">
                        {formatDate(row.waktu_awal)}
                      </td>
                      <td className="p-3 whitespace-nowrap font-mono text-xs text-muted-foreground">
                        {formatTime(row.waktu_awal)} - {formatTime(row.waktu_akhir)}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap font-mono font-bold text-rose-500">
                        {row.durasi_menit} m
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                            row.kategori === "MESIN"
                              ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30"
                              : row.kategori === "DIES"
                              ? "bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30"
                              : row.kategori === "FINGER"
                              ? "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30"
                              : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                          }`}
                        >
                          {row.kategori || "-"}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-foreground max-w-[200px] truncate">
                        {row.problem || "-"}
                      </td>
                      <td className="p-3 text-muted-foreground max-w-[200px] truncate">
                        {row.penyebab || "-"}
                      </td>
                      <td className="p-3 text-muted-foreground max-w-[200px] truncate">
                        {row.countermeasure || "-"}
                      </td>
                      <td className="p-3 whitespace-nowrap font-mono text-xs">
                        {row.stasiun ? (
                          <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {row.stasiun}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <div className="p-3 border-t border-border text-center">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={loadingMore}
                onClick={() => fetchDowntime(page + 1)}
              >
                {loadingMore ? "Memuat..." : "Muat Lebih Banyak"}
              </Button>
            </div>
          )}
        </Card>
      </main>
    </div>
  );
}
