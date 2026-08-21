"use client";

import React, { useEffect, useRef } from "react";
import Image from "next/image";
import Chart from "chart.js/auto";
import { Card } from "@/components/ui/card";
import { useThemeListener } from "@/hooks/produksi/useThemeListener";
import {
  Users,
  User,
  Palmtree,
  UserX,
  Clock,
  Info,
} from "lucide-react";

interface SQCPMProps {
  safety: {
    hariTanpaAccident: number;
    accident: number;
  };
  ngRatePct: number;
  totalNG: number;
  oee: number;
  performanceFactor: number;
  gsph: number;
  targetGsph: number;
  ngValueRp: number;
  scrapValueRp: number;
  scrapRasio?: number;
  scrapTargetRasio?: number;
  attendance: {
    pctExclCuti: number;
    pctExclCutiFromDenom?: number;
    total_orang: number;
    hadir: number;
    cuti: number;
    absen: number;
    overtime_jam: number;
    totalHadir?: number;
    totalCuti?: number;
    totalAbsen?: number;
    totalOvertimeJam?: number;
  };
  attendanceByShift?: {
    shift1: { hadir: number; total: number };
    shift2: { hadir: number; total: number };
  };
  periodMode?: "harian" | "bulanan" | "tahunan";
  miniTrend?: {
    labels: string[];
    safety: number[];
    quality: number[];
    productivity: number[];
    cost: number[];
    moral: number[];
  };
}

function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(Number(n))) return "0";
  return Number(n).toLocaleString("en-US", { maximumFractionDigits: 1 });
}

function fmtRupiahShort(rp: number): string {
  if (!rp) return "Rp 0";
  if (rp >= 1_000_000_000) return `Rp ${(rp / 1_000_000_000).toFixed(1)}M`;
  if (rp >= 1_000_000) return `Rp ${(rp / 1_000_000).toFixed(1)}Jt`;
  if (rp >= 1_000) return `Rp ${(rp / 1_000).toFixed(0)}K`;
  return `Rp ${rp}`;
}

/** Port of cardStatus(val, greenAt, amberAt) from vanilla */
function cardStatus(val: number, greenAt: number, amberAt: number): "good" | "warn" | "bad" {
  const v = Number(val) || 0;
  if (v >= greenAt) return "good";
  if (v >= amberAt) return "warn";
  return "bad";
}

export default function SQCDMPPanel({
  safety,
  ngRatePct,
  totalNG,
  oee,
  performanceFactor,
  gsph,
  targetGsph,
  ngValueRp,
  scrapValueRp,
  scrapRasio = 0,
  scrapTargetRasio = 0,
  attendance,
  attendanceByShift,
  periodMode = "harian",
  miniTrend,
}: SQCPMProps) {
  const chartRefs = {
    miniSafety:       useRef<HTMLCanvasElement | null>(null),
    miniQuality:      useRef<HTMLCanvasElement | null>(null),
    miniProductivity: useRef<HTMLCanvasElement | null>(null),
    miniCost:         useRef<HTMLCanvasElement | null>(null),
  };

  const chartInstances = useRef<Record<string, Chart>>({});

  // ─── Dynamic card colors & light-mode neon glow (reuse existing status) ───
  const safetyStatus = safety.accident === 0 ? "good" : "bad";
  const safetyColClass  = `col-${safetyStatus} card-glow-${safetyStatus}`;

  // Quality: treat NG Rate inversely — 100-ngRate*2 vs thresholds 90/80
  const qualityStatus = cardStatus(100 - ngRatePct * 2, 90, 80);
  const qualityColClass = `col-${qualityStatus} card-glow-${qualityStatus}`;

  // Productivity: performanceFactor vs 95/80 (nilai yang ditampilkan tetap OEE)
  const prodStatus = cardStatus(performanceFactor, 95, 80);
  const productivityColClass = `col-${prodStatus} card-glow-${prodStatus}`;

  // Cost: if scrap target set, compare rasio; if no scrap (0), it is good; else warn
  const costStatus = scrapTargetRasio > 0
    ? (scrapRasio <= scrapTargetRasio ? "good" : "bad")
    : (scrapRasio === 0 ? "good" : "warn");
  const costColClass = `col-${costStatus} card-glow-${costStatus}`;

  // Moral: attendance % vs 95/85; if no attendance logged yet, default to warn (oranye)
  const moralStatus = attendance.total_orang === 0
    ? "warn"
    : cardStatus(attendance.pctExclCuti, 95, 85);
  const moralColClass = `col-${moralStatus} card-glow-${moralStatus}`;

  const unitLabel = periodMode === "harian" ? "Orang" : "/hari";
  const theme = useThemeListener();

  useEffect(() => {
    const t = miniTrend || { labels: [], safety: [], quality: [], productivity: [], cost: [], moral: [] };

    const cv = (v: string) => {
      try { return getComputedStyle(document.documentElement).getPropertyValue(v).trim() || ""; }
      catch { return ""; }
    };

    const renderSparkline = (
      canvas: HTMLCanvasElement | null,
      id: string,
      labels: string[],
      data: number[],
      color: string,
      type: "line" | "bar" = "line"
    ) => {
      if (!canvas) return;
      if (chartInstances.current[id]) {
        chartInstances.current[id].destroy();
      }
      const isBar = type === "bar";
      chartInstances.current[id] = new Chart(canvas, {
        type: isBar ? "bar" : "line",
        data: {
          labels,
          datasets: [
            {
              data,
              borderColor: color,
              backgroundColor: isBar ? color : "transparent",
              borderWidth: 2.5,
              tension: 0.4,
              pointRadius: 0,
              pointHoverRadius: 4,
              borderRadius: isBar ? 3 : 0,
              barPercentage: 0.6,
              categoryPercentage: 0.7,
            } as any,
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { top: 8, right: 4, bottom: 2 } },
          plugins: {
            legend: { display: false },
            tooltip: { enabled: true },
          },
          scales: {
            x: {
              ticks: { color: cv("--chart-tick") || "#64748b", font: { size: 8 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 4 },
              grid: { display: false },
              border: { display: false },
            },
            y: {
              ticks: { color: cv("--chart-tick") || "#64748b", font: { size: 8 }, maxTicksLimit: 3 },
              grid: { color: cv("--chart-grid") || "#334155", drawTicks: false },
              border: { display: false },
              beginAtZero: true,
              suggestedMax: 1,
            },
          },
        },
      });
    };

    // Sparkline colors: use --chart-* CSS vars (resolved at render time)
    renderSparkline(chartRefs.miniSafety.current,       "miniSafety",       t.labels, t.safety,       cv("--chart-1") || "#34d399", "line");
    renderSparkline(chartRefs.miniQuality.current,      "miniQuality",      t.labels, t.quality,      cv("--chart-2") || "#38bdf8", "line");
    renderSparkline(chartRefs.miniProductivity.current, "miniProductivity",  t.labels, t.productivity, cv("--chart-1") || "#34d399", "bar");
    renderSparkline(chartRefs.miniCost.current,         "miniCost",         t.labels, t.cost,         cv("--chart-5") || "#fb7185", "bar");

    return () => {
      Object.values(chartInstances.current).forEach((c) => c.destroy());
      chartInstances.current = {};
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miniTrend, theme]);

  return (
    <div className="sqcpm-columns">
      {/* ═══ SAFETY ═══ */}
      <Card className={`sqcpm-col ${safetyColClass}`}>
        <div className="sqcpm-col-head">
          <Image
            src="/icons/emoji-3d/safety.png"
            alt="Safety"
            width={30}
            height={30}
            className="w-8 h-8 object-contain flex-shrink-0"
          />
          <div>
            <div className="sqcpm-col-title">SAFETY</div>
            <div className="sqcpm-col-sub">KESELAMATAN</div>
          </div>
        </div>
        <div className="sqcpm-metric-label">Hari Tanpa Kecelakaan</div>
        <div className="sqcpm-metric-value">{fmtNum(safety.hariTanpaAccident)}</div>
        <div className="sqcpm-bar">
          <div className="sqcpm-bar-fill" style={{ width: `${safety.accident === 0 ? 100 : 20}%` }} />
        </div>
        <div className="sqcpm-mini-label">{fmtNum(safety.accident)} insiden tercatat</div>
        <div className="sqcpm-chart">
          <canvas ref={chartRefs.miniSafety} />
        </div>
      </Card>

      {/* ═══ QUALITY ═══ */}
      <Card className={`sqcpm-col ${qualityColClass}`}>
        <div className="sqcpm-col-head">
          <Image
            src="/icons/emoji-3d/target.png"
            alt="Quality"
            width={30}
            height={30}
            className="w-8 h-8 object-contain flex-shrink-0"
          />
          <div>
            <div className="sqcpm-col-title">QUALITY</div>
            <div className="sqcpm-col-sub">KUALITAS</div>
          </div>
        </div>
        <div className="sqcpm-metric-label">NG Rate (Target ≤ 0,5%)</div>
        <div className="sqcpm-metric-value">{fmtNum(ngRatePct)}%</div>
        <div className="sqcpm-bar">
          <div className="sqcpm-bar-fill" style={{ width: `${Math.max(0, Math.min(100, 100 - ngRatePct * 20))}%` }} />
        </div>
        <div className="sqcpm-mini-label">{fmtNum(totalNG)} pcs NG</div>
        <div className="sqcpm-chart">
          <canvas ref={chartRefs.miniQuality} />
        </div>
      </Card>

      {/* ═══ PRODUCTIVITY ═══ */}
      <Card className={`sqcpm-col ${productivityColClass}`}>
        <div className="sqcpm-col-head">
          <Image
            src="/icons/emoji-3d/gear.png"
            alt="Productivity"
            width={30}
            height={30}
            className="w-8 h-8 object-contain flex-shrink-0"
          />
          <div>
            <div className="sqcpm-col-title">PRODUCTIVITY</div>
            <div className="sqcpm-col-sub">PRODUKTIVITAS</div>
          </div>
        </div>
        <div className="sqcpm-metric-label">OEE Keseluruhan</div>
        <div className="sqcpm-metric-value">{fmtNum(oee)}%</div>
        <div className="sqcpm-bar">
          <div className="sqcpm-bar-fill" style={{ width: `${Math.max(0, Math.min(100, oee))}%` }} />
        </div>
        <div className="sqcpm-mini-label">
          GSPH <b>{fmtNum(gsph)}</b> / target <b>{fmtNum(targetGsph)}</b>
        </div>
        <div className="sqcpm-chart-title">AVG GSPH All Line</div>
        <div className="sqcpm-chart sqcpm-chart-tall">
          <canvas ref={chartRefs.miniProductivity} />
        </div>
      </Card>

      {/* ═══ COST ═══ */}
      <Card className={`sqcpm-col ${costColClass}`}>
        <div className="sqcpm-col-head">
          <Image
            src="/icons/emoji-3d/money-bag.png"
            alt="Cost"
            width={30}
            height={30}
            className="w-8 h-8 object-contain flex-shrink-0"
          />
          <div>
            <div className="sqcpm-col-title">COST</div>
            <div className="sqcpm-col-sub">BIAYA</div>
          </div>
        </div>
        <div className="sqcpm-metric-label">Total Biaya</div>
        <div className="sqcpm-metric-value" style={{ fontSize: "22px" }}>
          {fmtRupiahShort(ngValueRp + scrapValueRp)}
        </div>
        <div className="cost-split">
          <div className="cost-split-row">
            <span className="cost-split-label">NG Inline</span>
            <span className="cost-split-value">{fmtRupiahShort(ngValueRp)}</span>
          </div>
          <div className="cost-split-bar">
            <div className="cost-split-fill cost-fill-ng"
              style={{ width: `${ngValueRp + scrapValueRp > 0 ? (ngValueRp / (ngValueRp + scrapValueRp)) * 100 : 0}%` }} />
          </div>
          <div className="cost-split-row" style={{ marginTop: "3px" }}>
            <span className="cost-split-label">Scrap Top End</span>
            <span className="cost-split-value">{fmtRupiahShort(scrapValueRp)}</span>
          </div>
          <div className="cost-split-bar">
            <div className="cost-split-fill cost-fill-scrap"
              style={{ width: `${ngValueRp + scrapValueRp > 0 ? (scrapValueRp / (ngValueRp + scrapValueRp)) * 100 : 0}%` }} />
          </div>
        </div>
        {scrapRasio > 0 && (
          <div className="sqcpm-mini-label">
            Rasio scrap <b>{(scrapRasio * 100).toFixed(2)}%</b> / target <b>{(scrapTargetRasio * 100).toFixed(2)}%</b>
          </div>
        )}
        <div className="sqcpm-chart sqcpm-chart-tall">
          <canvas ref={chartRefs.miniCost} />
        </div>
      </Card>

      {/* ═══ MORAL / ATTENDANCE ═══ */}
      <Card className={`sqcpm-col ${moralColClass}`}>
        <div className="sqcpm-col-head">
          <Image
            src="/icons/emoji-3d/people.png"
            alt="Attendance"
            width={30}
            height={30}
            className="w-8 h-8 object-contain flex-shrink-0"
          />
          <div>
            <div className="sqcpm-col-title">ATTENDANCE</div>
            <div className="sqcpm-col-sub">MORAL</div>
          </div>
        </div>
        <div className="sqcpm-metric-label">
          Tingkat Kehadiran
          {periodMode !== "harian" && <span className="avg-tag">rata-rata</span>}
        </div>
        <div className="attendance-dual-metric">
          <div className="attendance-dual-item">
            <div className="sqcpm-metric-value">{fmtNum(attendance.pctExclCuti)}%</div>
            <div className="attendance-dual-label">Termasuk Cuti</div>
          </div>
          <div className="attendance-dual-item">
            <div className="sqcpm-metric-value">{fmtNum(attendance.pctExclCutiFromDenom ?? 0)}%</div>
            <div className="attendance-dual-label">
              Tanpa Cuti{" "}
              <span title={`Cuti dibuang dari penyebut (${fmtNum(attendance.cuti)} orang), jadi tidak menurunkan rate`} style={{ display: "inline-flex", verticalAlign: "middle" }}>
                <Info size={13} />
              </span>
            </div>
          </div>
        </div>
        <div className="sqcpm-bar">
          <div className="sqcpm-bar-fill" style={{ width: `${Math.max(0, Math.min(100, attendance.pctExclCuti))}%` }} />
        </div>

        {/* Manpower grid */}
        <div className="manpower-grid manpower-grid-5">
          <div className="manpower-box">
            <span className="manpower-icon"><Users size={16} /></span>
            <span className="manpower-label">Total</span>
            <span className="manpower-value">{fmtNum(attendance.total_orang)}</span>
            <span className="manpower-unit">{unitLabel}</span>
          </div>
          <div className="manpower-box manpower-hadir">
            <span className="manpower-icon"><User size={16} /></span>
            <span className="manpower-label">Hadir</span>
            <span className="manpower-value">{fmtNum(attendance.hadir)}</span>
            <span className="manpower-unit">{unitLabel}</span>
          </div>
          <div className="manpower-box">
            <span className="manpower-icon"><Palmtree size={16} /></span>
            <span className="manpower-label">Cuti</span>
            <span className="manpower-value">{fmtNum(attendance.cuti)}</span>
            <span className="manpower-unit">{unitLabel}</span>
          </div>
          <div className="manpower-box">
            <span className="manpower-icon"><UserX size={16} /></span>
            <span className="manpower-label">Absen</span>
            <span className="manpower-value">{fmtNum(attendance.absen)}</span>
            <span className="manpower-unit">{unitLabel}</span>
          </div>
          <div className="manpower-box">
            <span className="manpower-icon"><Clock size={16} /></span>
            <span className="manpower-label">O.T</span>
            <span className="manpower-value">{fmtNum(attendance.overtime_jam)}</span>
            <span className="manpower-unit">Jam</span>
          </div>
        </div>

        {/* moral-summary: Total kumulatif untuk mode bulanan/tahunan */}
        {periodMode !== "harian" && (
          <div className="moral-summary">
            <div className="moral-summary-item">
              <span className="moral-summary-value">{fmtNum(attendance.totalHadir ?? 0)}</span>
              <span className="moral-summary-label">Total Hadir</span>
            </div>
            <div className="moral-summary-item">
              <span className="moral-summary-value">{fmtNum(attendance.totalCuti ?? 0)}</span>
              <span className="moral-summary-label">Total Cuti</span>
            </div>
            <div className="moral-summary-item">
              <span className="moral-summary-value">{fmtNum(attendance.totalAbsen ?? 0)}</span>
              <span className="moral-summary-label">Total Absen</span>
            </div>
            <div className="moral-summary-item">
              <span className="moral-summary-value">{fmtNum(attendance.totalOvertimeJam ?? 0)}</span>
              <span className="moral-summary-label">Total O.T (Jam)</span>
            </div>
          </div>
        )}

        {/* moral-summary-2col: Hadir per shift untuk mode harian */}
        {periodMode === "harian" && attendanceByShift && (
          <div className="moral-summary moral-summary-2col">
            <div className="moral-summary-item">
              <span className="moral-summary-value">{fmtNum(attendanceByShift.shift1.hadir)}</span>
              <span className="moral-summary-label">Hadir Shift 1</span>
            </div>
            <div className="moral-summary-item">
              <span className="moral-summary-value">{fmtNum(attendanceByShift.shift2.hadir)}</span>
              <span className="moral-summary-label">Hadir Shift 2</span>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
