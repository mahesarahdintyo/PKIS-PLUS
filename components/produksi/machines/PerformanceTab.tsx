"use client";

import React, { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye } from "lucide-react";
import type { ProdMachineConfig } from "@/types/produksi";

interface PerformanceTabProps {
  config: ProdMachineConfig;
  activePerfSection: "tahunan" | "bulanan" | "harian";
  setActivePerfSection: (v: "tahunan" | "bulanan" | "harian") => void;
  perfYear: number;
  setPerfYear: (y: number) => void;
  perfMonth: string;
  setPerfMonth: (m: string) => void;
  perfDate: string;
  setPerfDate: (d: string) => void;
  perfLoading: boolean;
  perfData: any;
  perfDayRows: any[];
  perfChartRef: React.RefObject<HTMLCanvasElement | null>;
  perfPieRef: React.RefObject<HTMLCanvasElement | null>;
  downtimeKesimpulan: () => string;
  fmtNum: (n: number | null | undefined) => string;
}

export default function PerformanceTab({
  config,
  activePerfSection,
  setActivePerfSection,
  perfYear,
  setPerfYear,
  perfMonth,
  setPerfMonth,
  perfDate,
  setPerfDate,
  perfLoading,
  perfData,
  perfDayRows,
  perfChartRef,
  perfPieRef,
  downtimeKesimpulan,
  fmtNum,
}: PerformanceTabProps) {
  const [selectedProblemDetail, setSelectedProblemDetail] = useState<{
    kategori: string;
    problem: string;
    totalMenit: number;
    count: number;
    items: any[];
  } | null>(null);

  const categoryTablesData = useMemo(() => {
    const raw: any[] = perfData?.rawDowntimes || [];
    const categories = ["MESIN", "DIES", "OTHER"] as const;

    const result: Record<"MESIN" | "DIES" | "OTHER", {
      totalMenit: number;
      totalCount: number;
      problems: Array<{
        problem: string;
        totalMenit: number;
        count: number;
        items: any[];
      }>;
    }> = {
      MESIN: { totalMenit: 0, totalCount: 0, problems: [] },
      DIES: { totalMenit: 0, totalCount: 0, problems: [] },
      OTHER: { totalMenit: 0, totalCount: 0, problems: [] },
    };

    const problemMaps: Record<"MESIN" | "DIES" | "OTHER", Record<string, { problem: string; totalMenit: number; count: number; items: any[] }>> = {
      MESIN: {},
      DIES: {},
      OTHER: {},
    };

    raw.forEach((d: any) => {
      const rawCat = (d.kategori || "").toUpperCase().trim();
      let targetCat: "MESIN" | "DIES" | "OTHER" = "OTHER";
      if (rawCat === "MESIN") targetCat = "MESIN";
      else if (rawCat === "DIES") targetCat = "DIES";
      else targetCat = "OTHER";

      let m = 0;
      if (d.waktu_awal && d.waktu_akhir) {
        m = Math.round((new Date(d.waktu_akhir).getTime() - new Date(d.waktu_awal).getTime()) / 60000);
      } else if (d.durasi_menit || d.durasi) {
        m = Number(d.durasi_menit || d.durasi || 0);
      }
      m = Math.max(0, m);

      const prob = (d.problem || d.deskripsi || "Tanpa Keterangan").trim();
      const pMap = problemMaps[targetCat];

      if (!pMap[prob]) {
        pMap[prob] = {
          problem: prob,
          totalMenit: 0,
          count: 0,
          items: [],
        };
      }
      pMap[prob].totalMenit += m;
      pMap[prob].count += 1;
      pMap[prob].items.push({
        ...d,
        calcMenit: m,
      });

      result[targetCat].totalMenit += m;
      result[targetCat].totalCount += 1;
    });

    categories.forEach((cat) => {
      const sorted = Object.values(problemMaps[cat]).sort((a, b) => {
        if (b.totalMenit !== a.totalMenit) return b.totalMenit - a.totalMenit;
        return b.count - a.count;
      });
      result[cat].problems = sorted;
    });

    return result;
  }, [perfData?.rawDowntimes]);
  return (
    <div className="perf-fullwidth-container">
      {/* Section Toggle Chips */}
      <div className="perf-toggle-row flex gap-2 mb-4">
        <button
          type="button"
          className={`chip chip-lg ${activePerfSection === "tahunan" ? "chip-active" : ""}`}
          onClick={() => setActivePerfSection("tahunan")}
        >
          Tahunan
        </button>
        <button
          type="button"
          className={`chip chip-lg ${activePerfSection === "bulanan" ? "chip-active" : ""}`}
          onClick={() => setActivePerfSection("bulanan")}
        >
          Bulanan
        </button>
        <button
          type="button"
          className={`chip chip-lg ${activePerfSection === "harian" ? "chip-active" : ""}`}
          onClick={() => setActivePerfSection("harian")}
        >
          Harian
        </button>
      </div>

      {/* Performance Main Panel */}
      <Card className="dash-panel card-glow-info">
        <div className="perf-header flex justify-between items-center mb-4">
          <p className="dash-panel-title font-bold text-lg m-0">
            Performance {activePerfSection === "tahunan" ? "Tahunan" : activePerfSection === "bulanan" ? "Bulanan" : "Harian"}
          </p>
          <div className="perf-nav flex items-center gap-2">
            {activePerfSection === "tahunan" && (
              <Input
                type="number"
                min="2000"
                max="2100"
                className="h-8 w-20 text-sm font-mono"
                value={perfYear}
                onChange={(e) => setPerfYear(Number(e.target.value))}
              />
            )}
            {activePerfSection === "bulanan" && (
              <Input
                type="month"
                className="h-8 text-sm font-mono"
                value={perfMonth}
                onChange={(e) => setPerfMonth(e.target.value)}
              />
            )}
            {activePerfSection === "harian" && (
              <Input
                type="date"
                className="h-8 text-sm font-mono"
                value={perfDate}
                onChange={(e) => setPerfDate(e.target.value)}
              />
            )}
            <span className="perf-period-label font-bold text-sm text-[var(--amber)]">
              {activePerfSection === "tahunan"
                ? perfYear
                : activePerfSection === "bulanan"
                  ? new Date(perfMonth + "-01T00:00:00").toLocaleDateString("id-ID", { month: "long", year: "numeric" })
                  : new Date(perfDate + "T00:00:00").toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}
            </span>
          </div>
        </div>

        {perfLoading ? (
          <p className="empty-state">Menghitung performance...</p>
        ) : !perfData.data ? (
          <p className="empty-state">Belum ada data performance.</p>
        ) : (
          <div>
            {/* Top Grid */}
            <div className="perf-top-grid">
              {/* Cards Column */}
              <div className="perf-cards-col">
                <Card className={`perf-card perf-card-oee ${perfData.data.oee >= 75 ? "card-glow-good" : perfData.data.oee >= 50 ? "card-glow-warn" : "card-glow-bad"}`}>
                  <span className="perf-label">OEE</span>
                  <span className="perf-value perf-value-xl">{fmtNum(perfData.data.oee)}%</span>
                  <span className="perf-oee-breakdown text-xs text-muted-foreground block mt-1">
                    A <b>{fmtNum(perfData.data.availability)}</b>% · P <b>{fmtNum(perfData.data.performanceFactor)}</b>% · Q <b>{fmtNum(perfData.data.quality)}</b>%
                  </span>
                </Card>
                <Card className={`perf-card perf-card-accent ${perfData.data.performanceFactor >= 95 ? "card-glow-good" : perfData.data.performanceFactor >= 80 ? "card-glow-warn" : "card-glow-bad"}`}>
                  <span className="perf-label">GSPH Aktual</span>
                  <span className="perf-value">{fmtNum(perfData.data.gsph)}</span>
                </Card>
                <Card className="perf-card card-glow-info">
                  <span className="perf-label">GSPH Target</span>
                  <span className="perf-value">{fmtNum(perfData.data.targetGsph)}</span>
                </Card>
                <Card className="perf-card card-glow-info">
                  <span className="perf-label">Stroke (Qty)</span>
                  <span className="perf-value">{fmtNum(perfData.data.stroke)}</span>
                </Card>
                <Card className={`perf-card ${perfData.data.stroke > 0 && (perfData.data.ng / perfData.data.stroke) <= 0.005 ? "card-glow-good" : "card-glow-warn"}`}>
                  <span className="perf-label">NG</span>
                  <span className="perf-value">{fmtNum(perfData.data.ng)}</span>
                </Card>
                <Card className="perf-card card-glow-info">
                  <span className="perf-label">Downtime</span>
                  <span className="perf-value">{fmtNum(perfData.data.downtimeMenit)} mnt</span>
                </Card>
                <Card className="perf-card card-glow-info">
                  <span className="perf-label">Dandori</span>
                  <span className="perf-value">{fmtNum(perfData.data.dandoriMenit)} mnt</span>
                </Card>
                <Card className="perf-card card-glow-info">
                  <span className="perf-label">Break</span>
                  <span className="perf-value">{fmtNum(perfData.data.breakMenit)} mnt</span>
                </Card>
                <Card className="perf-card card-glow-info">
                  <span className="perf-label">Jam Kerja</span>
                  <span className="perf-value">{fmtNum(perfData.data.whJam)} jam</span>
                </Card>
              </div>

              {/* Chart Column */}
              <div className="perf-chart-col">
                {activePerfSection !== "harian" ? (
                  <div className="perf-chart-wrap">
                    <canvas ref={perfChartRef} />
                  </div>
                ) : (
                  <div className="perf-daily-split grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="perf-daily-chart">
                      <p className="panel-subtitle font-bold text-sm mb-2">GSPH Target vs Aktual</p>
                      <div style={{ height: 140, position: "relative" }}>
                        <canvas ref={perfChartRef} />
                      </div>
                    </div>
                    <div className="perf-daily-list">
                      <p className="panel-subtitle font-bold text-sm mb-2">
                        Produksi Hari Itu <span className="count font-mono text-muted-foreground">({perfDayRows.length} baris)</span>
                      </p>
                      <div className="table-wrap" style={{ maxHeight: 230 }}>
                        <table className="table-compact text-sm">
                          <thead>
                            <tr>
                              {config.stationConfig.mode !== "none" && <th>Stasiun</th>}
                              <th>Mulai</th>
                              <th>Selesai</th>
                              <th>Part Number</th>
                              <th>Qty</th>
                              <th>Dandori</th>
                              <th>DT</th>
                              <th>Break</th>
                            </tr>
                          </thead>
                          <tbody>
                            {perfDayRows.length > 0 ? (
                              perfDayRows.map((row: any) => (
                                <tr key={row.id}>
                                  {config.stationConfig.mode !== "none" && (
                                    <td className="mono">{row.stasiun || "-"}</td>
                                  )}
                                  <td className="mono">{row.waktu_awal ? new Date(row.waktu_awal).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-"}</td>
                                  <td className="mono">{row.waktu_akhir ? new Date(row.waktu_akhir).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "-"}</td>
                                  <td>{row.part_number || "-"}</td>
                                  <td className="mono">{fmtNum(row.qty)}</td>
                                  <td className="mono">{fmtNum(row.dandori_menit || 0)}</td>
                                  <td className="mono">{fmtNum(row.downtime_menit || 0)}</td>
                                  <td className="mono">{fmtNum(row.break_menit || 0)}</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={config.stationConfig.mode !== "none" ? 8 : 7} className="empty-state text-center py-4">
                                  Tidak ada produksi di tanggal ini.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3 Downtime Tables per Category (Mesin, Dies, Other) - Compact under GSPH Chart */}
                <div className="perf-cat-tables-compact mt-2 pt-2 border-t border-dashed border-border/60">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="panel-subtitle font-bold text-xs uppercase tracking-wider text-muted-foreground m-0">
                      Downtime per Kategori
                    </p>
                    <span className="text-xs text-muted-foreground">
                      Klik baris untuk rincian
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {(["MESIN", "DIES", "OTHER"] as const).map((cat) => {
                      const catData = categoryTablesData[cat];
                      const badgeColor =
                        cat === "MESIN"
                          ? "bg-rose-500/15 text-rose-500 border-rose-500/40 shadow-xs shadow-rose-500/20"
                          : cat === "DIES"
                          ? "bg-amber-500/15 text-amber-500 border-amber-500/40 shadow-xs shadow-amber-500/20"
                          : "bg-sky-500/15 text-sky-500 border-sky-500/40 shadow-xs shadow-sky-500/20";

                      const catCardClass =
                        cat === "MESIN"
                          ? "perf-cat-card perf-cat-card-mesin"
                          : cat === "DIES"
                          ? "perf-cat-card perf-cat-card-dies"
                          : "perf-cat-card perf-cat-card-other";

                      const borderBottomColor =
                        cat === "MESIN"
                          ? "border-rose-500/30"
                          : cat === "DIES"
                          ? "border-amber-500/30"
                          : "border-sky-500/30";

                      const hoverRowColor =
                        cat === "MESIN"
                          ? "hover:bg-rose-500/10"
                          : cat === "DIES"
                          ? "hover:bg-amber-500/10"
                          : "hover:bg-sky-500/10";

                      const actionBtnHover =
                        cat === "MESIN"
                          ? "hover:bg-rose-500/20 hover:text-rose-500"
                          : cat === "DIES"
                          ? "hover:bg-amber-500/20 hover:text-amber-500"
                          : "hover:bg-sky-500/20 hover:text-sky-500";

                      return (
                        <div
                          key={cat}
                          className={`p-2.5 flex flex-col justify-between ${catCardClass}`}
                        >
                          <div>
                            <div className={`flex items-center justify-between pb-1.5 mb-1.5 border-b ${borderBottomColor}`}>
                              <div className="flex items-center gap-1.5">
                                <span className={`px-2 py-0.5 rounded text-sm font-bold border ${badgeColor}`}>
                                  {cat}
                                </span>
                                <span className="text-sm text-muted-foreground font-mono">
                                  ({catData.problems.length})
                                </span>
                              </div>
                              <span className="font-mono text-sm font-bold text-foreground">
                                {fmtNum(catData.totalMenit)}{" "}
                                <span className="text-xs font-normal text-muted-foreground">mnt</span>
                              </span>
                            </div>

                            <div className="table-wrap" style={{ maxHeight: 210, overflowY: "auto" }}>
                              <table className="table-compact text-sm w-full">
                                <thead>
                                  <tr>
                                    <th className="w-5 text-center px-1.5 py-1 text-xs">#</th>
                                    <th className="px-1.5 py-1 text-xs">Problem</th>
                                    <th className="w-8 text-center px-1.5 py-1 text-xs">Freq</th>
                                    <th className="w-12 text-right px-1.5 py-1 text-xs">Menit</th>
                                    <th className="w-5 text-center px-0 py-1"></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {catData.problems.length > 0 ? (
                                    catData.problems.map((row, idx) => (
                                      <tr
                                        key={idx}
                                        className={`cursor-pointer transition-colors group ${hoverRowColor}`}
                                        onClick={() => setSelectedProblemDetail({ ...row, kategori: cat })}
                                        title="Klik untuk melihat detail log downtime"
                                      >
                                        <td className="text-center text-muted-foreground font-mono text-xs px-1.5 py-1.5">
                                          {idx + 1}
                                        </td>
                                        <td
                                          className="font-medium text-foreground group-hover:text-primary transition-colors px-1.5 py-1.5 text-sm"
                                          style={{
                                            maxWidth: 85,
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            whiteSpace: "nowrap",
                                          }}
                                          title={row.problem}
                                        >
                                          {row.problem}
                                        </td>
                                        <td className="text-center font-mono text-muted-foreground text-sm px-1.5 py-1.5">
                                          {row.count}x
                                        </td>
                                        <td className="text-right font-mono font-semibold text-foreground text-sm px-1.5 py-1.5">
                                          {fmtNum(row.totalMenit)}
                                        </td>
                                        <td className="text-center p-0">
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className={`h-5 w-5 p-0 opacity-60 group-hover:opacity-100 rounded cursor-pointer ${actionBtnHover}`}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedProblemDetail({ ...row, kategori: cat });
                                            }}
                                            title="Lihat Detail Log"
                                          >
                                            <Eye className="h-3.5 w-3.5" />
                                          </Button>
                                        </td>
                                      </tr>
                                    ))
                                  ) : (
                                    <tr>
                                      <td
                                        colSpan={5}
                                        className="empty-state text-center py-2.5 text-muted-foreground text-sm"
                                      >
                                        Tidak ada downtime {cat.toLowerCase()}.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Lower Grid */}
            <div className="perf-lower-grid">
              <div className="perf-lower-col">
                <p className="panel-subtitle font-bold text-sm mb-2">5 Downtime Terburuk</p>
                <div className="table-wrap">
                  <table className="table-compact text-sm">
                    <thead>
                      <tr>
                        <th>Kategori</th>
                        <th>Problem</th>
                        <th>Menit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {perfData.top5.length > 0 ? (
                        perfData.top5.map((row: any, idx: number) => (
                          <tr key={idx}>
                            <td title={row.kategori}><span className="badge">{row.kategori}</span></td>
                            <td title={row.problem} style={{ minWidth: 100, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.problem}</td>
                            <td className="mono">{fmtNum(row.menit)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="empty-state text-center py-4">
                            Tidak ada downtime.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="perf-lower-col">
                <p className="panel-subtitle font-bold text-sm mb-2">
                  Downtime per Kategori
                  <span className="ml-1 text-muted-foreground font-mono font-normal">({config.kategoriOptions.join(" / ")})</span>
                </p>
                <div className="perf-pie-wrap">
                  <canvas ref={perfPieRef} />
                </div>
                {perfData.byCategory.length > 0 && (
                  <p className="perf-pie-summary text-sm text-muted-foreground mt-2">
                    {downtimeKesimpulan()}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Detail Dialog Downtime Log (Opsi B) */}
      <Dialog
        open={Boolean(selectedProblemDetail)}
        onOpenChange={(open) => !open && setSelectedProblemDetail(null)}
      >
        <DialogContent maxWidth="max-w-5xl" className="max-h-[88vh] flex flex-col p-6 sm:p-7">
          <DialogHeader className="pb-4 border-b border-border/50">
            <div className="flex items-center gap-2.5">
              <span
                className={`px-2.5 py-1 rounded text-sm font-bold border ${
                  selectedProblemDetail?.kategori === "MESIN"
                    ? "bg-rose-500/10 text-rose-500 border-rose-500/30"
                    : selectedProblemDetail?.kategori === "DIES"
                    ? "bg-amber-500/10 text-amber-500 border-amber-500/30"
                    : "bg-sky-500/10 text-sky-500 border-sky-500/30"
                }`}
              >
                {selectedProblemDetail?.kategori}
              </span>
              <DialogTitle className="text-xl sm:text-2xl font-bold text-foreground">
                {selectedProblemDetail?.problem}
              </DialogTitle>
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm text-muted-foreground mt-2">
              <span>
                Total Durasi:{" "}
                <b className="text-foreground font-mono text-base">{fmtNum(selectedProblemDetail?.totalMenit)} menit</b>
              </span>
              <span>•</span>
              <span>
                Frekuensi:{" "}
                <b className="text-foreground font-mono text-base">{selectedProblemDetail?.count} kejadian</b>
              </span>
              <span>•</span>
              <span>
                Periode:{" "}
                <b className="text-[var(--amber)] font-medium">
                  {activePerfSection === "tahunan"
                    ? perfYear
                    : activePerfSection === "bulanan"
                    ? new Date(perfMonth + "-01T00:00:00").toLocaleDateString("id-ID", {
                        month: "long",
                        year: "numeric",
                      })
                    : new Date(perfDate + "T00:00:00").toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                </b>
              </span>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto mt-4 pr-1">
            <div className="table-wrap">
              <table className="table-compact perf-dialog-table text-sm sm:text-base w-full">
                <thead>
                  <tr>
                    <th className="w-12 text-center py-3 text-xs sm:text-sm">#</th>
                    <th className="py-3 text-xs sm:text-sm">Waktu / Jam</th>
                    {config.stationConfig.mode !== "none" && <th className="py-3 text-xs sm:text-sm">Stasiun</th>}
                    <th className="py-3 text-xs sm:text-sm">Penyebab / Indikasi</th>
                    <th className="py-3 text-xs sm:text-sm">Tindakan / Countermeasure</th>
                    <th className="text-right w-28 py-3 text-xs sm:text-sm">Durasi</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedProblemDetail?.items && selectedProblemDetail.items.length > 0 ? (
                    [...selectedProblemDetail.items]
                      .sort((a, b) => {
                        const ta = a.waktu_awal ? new Date(a.waktu_awal).getTime() : 0;
                        const tb = b.waktu_awal ? new Date(b.waktu_awal).getTime() : 0;
                        return tb - ta;
                      })
                      .map((item: any, idx: number) => {
                        const dateStr = item.waktu_awal
                          ? new Date(item.waktu_awal).toLocaleDateString("id-ID", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })
                          : "-";
                        const timeStart = item.waktu_awal
                          ? new Date(item.waktu_awal).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "-";
                        const timeEnd = item.waktu_akhir
                          ? new Date(item.waktu_akhir).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "-";

                        return (
                          <tr key={item.id || idx}>
                            <td className="text-center font-mono text-muted-foreground text-sm sm:text-base">{idx + 1}</td>
                            <td className="mono whitespace-nowrap text-sm sm:text-base">
                              {activePerfSection !== "harian" && (
                                <span className="text-muted-foreground mr-1.5 text-xs sm:text-sm">[{dateStr}]</span>
                              )}
                              <span className="font-semibold">
                                {timeStart} - {timeEnd}
                              </span>
                            </td>
                            {config.stationConfig.mode !== "none" && (
                              <td className="mono font-semibold text-sm sm:text-base">{item.stasiun || "-"}</td>
                            )}
                            <td className="max-w-[260px] break-words text-sm sm:text-base leading-relaxed" title={item.penyebab || "-"}>
                              {item.penyebab || "-"}
                            </td>
                            <td className="max-w-[300px] break-words text-sm sm:text-base leading-relaxed" title={item.countermeasure || "-"}>
                              {item.countermeasure || "-"}
                            </td>
                            <td className="text-right font-mono font-bold text-foreground text-sm sm:text-base">
                              {fmtNum(item.calcMenit)}{" "}
                              <span className="text-xs sm:text-sm font-normal text-muted-foreground">mnt</span>
                            </td>
                          </tr>
                        );
                      })
                  ) : (
                    <tr>
                      <td
                        colSpan={config.stationConfig.mode !== "none" ? 6 : 5}
                        className="text-center py-8 text-muted-foreground text-base"
                      >
                        Tidak ada log detail yang ditemukan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
