"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  return (
    <div>
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
          <p className="dash-panel-title font-bold text-base m-0">
            Performance {activePerfSection === "tahunan" ? "Tahunan" : activePerfSection === "bulanan" ? "Bulanan" : "Harian"}
          </p>
          <div className="perf-nav flex items-center gap-2">
            {activePerfSection === "tahunan" && (
              <Input
                type="number"
                min="2000"
                max="2100"
                className="h-8 w-20 text-xs font-mono"
                value={perfYear}
                onChange={(e) => setPerfYear(Number(e.target.value))}
              />
            )}
            {activePerfSection === "bulanan" && (
              <Input
                type="month"
                className="h-8 text-xs font-mono"
                value={perfMonth}
                onChange={(e) => setPerfMonth(e.target.value)}
              />
            )}
            {activePerfSection === "harian" && (
              <Input
                type="date"
                className="h-8 text-xs font-mono"
                value={perfDate}
                onChange={(e) => setPerfDate(e.target.value)}
              />
            )}
            <span className="perf-period-label font-bold text-xs text-[var(--amber)]">
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
                      <p className="panel-subtitle font-bold text-xs mb-2">GSPH Target vs Aktual</p>
                      <div style={{ height: 140, position: "relative" }}>
                        <canvas ref={perfChartRef} />
                      </div>
                    </div>
                    <div className="perf-daily-list">
                      <p className="panel-subtitle font-bold text-xs mb-2">
                        Produksi Hari Itu <span className="count font-mono text-muted-foreground">({perfDayRows.length} baris)</span>
                      </p>
                      <div className="table-wrap" style={{ maxHeight: 230 }}>
                        <table className="table-compact text-xs">
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
              </div>
            </div>

            {/* Lower Grid */}
            <div className="perf-lower-grid">
              <div className="perf-lower-col">
                <p className="panel-subtitle font-bold text-xs mb-2">5 Downtime Terburuk</p>
                <div className="table-wrap">
                  <table className="table-compact text-xs">
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
                <p className="panel-subtitle font-bold text-xs mb-2">
                  Downtime per Kategori
                  <span className="ml-1 text-muted-foreground font-mono font-normal">({config.kategoriOptions.join(" / ")})</span>
                </p>
                <div className="perf-pie-wrap">
                  <canvas ref={perfPieRef} />
                </div>
                {perfData.byCategory.length > 0 && (
                  <p className="perf-pie-summary text-xs text-muted-foreground mt-2">
                    {downtimeKesimpulan()}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
