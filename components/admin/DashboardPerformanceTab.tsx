"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, Tv, RefreshCw } from "lucide-react";
import Chart from "chart.js/auto";
import {
  registerInternalVizPlugins,
  createVerticalGradient,
  createAreaGradient,
} from "@/lib/produksi/chartPlugins";

const CAT_GRAD_COLORS: Record<string, { top: string; bottom: string }> = {
  MESIN: { top: "#38bdf8", bottom: "#0284c7" },
  DIES: { top: "#fb7185", bottom: "#e11d48" },
  FINGER: { top: "#34d399", bottom: "#059669" },
  OTHER: { top: "#fbbf24", bottom: "#d97706" },
};

interface MachineMeta {
  key: string;
  label: string;
  shortLabel: string;
  slug: string;
}

interface DashboardPerformanceTabProps {
  periodMode: "harian" | "bulanan" | "tahunan";
  tanggal: string;
  bulanPilih: number;
  tahunPilih: number;
  shiftFilter: string;
  machines: MachineMeta[];
  totals: {
    stroke: number;
    ng: number;
    downtimeMenit: number;
    dandoriMenit: number;
    whJam?: number;
    gsph: number;
    targetGsph: number;
    availability: number;
    performanceFactor: number;
    oee: number;
  };
  machineDataMap: Record<string, any>;
  worstPerMachine: Record<string, { kategori: string; problem: string; menit: number }[]>;
  hourlyData: Record<string, { jam: number; gsph: number }[]>;
  lineTrend?: { labels: string[]; perLine: { label: string; values: (number | null)[] }[] } | null;
  rawDowntimes: any[];
  rawProductionLogs: any[];
  theme: string;
  fmtNum: (n: number | null | undefined) => string;
}

export default function DashboardPerformanceTab({
  periodMode,
  tanggal,
  bulanPilih,
  tahunPilih,
  shiftFilter,
  machines,
  totals,
  machineDataMap,
  worstPerMachine,
  hourlyData,
  lineTrend,
  rawDowntimes,
  rawProductionLogs,
  theme,
  fmtNum,
}: DashboardPerformanceTabProps) {
  const [selectedMachine, setSelectedMachine] = useState<string>("all");
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [rotateCountdown, setRotateCountdown] = useState<number>(20);

  const [selectedProblemDetail, setSelectedProblemDetail] = useState<{
    kategori: string;
    problem: string;
    totalMenit: number;
    count: number;
    items: any[];
  } | null>(null);

  const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pieCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstancesRef = useRef<Record<string, any>>({});

  // Auto-Rotate TV Cycle
  useEffect(() => {
    if (!autoRotate) return;
    const interval = setInterval(() => {
      setRotateCountdown((prev) => {
        if (prev <= 1) {
          const list = ["all", ...machines.map((m) => m.key)];
          setSelectedMachine((curr) => {
            const idx = list.indexOf(curr);
            const nextIdx = (idx + 1) % list.length;
            return list[nextIdx];
          });
          return 20;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [autoRotate, machines]);

  // Handle manual selection
  const handleSelectMachine = (key: string) => {
    setSelectedMachine(key);
    setRotateCountdown(20);
  };

  // Label Periode
  const periodLabel = useMemo(() => {
    if (periodMode === "tahunan") return String(tahunPilih);
    if (periodMode === "bulanan") {
      return new Date(tahunPilih, bulanPilih, 1).toLocaleDateString("id-ID", {
        month: "long",
        year: "numeric",
      });
    }
    return new Date(tanggal + "T00:00:00").toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }, [periodMode, tanggal, bulanPilih, tahunPilih]);

  // Active machine object
  const activeMachineObj = useMemo(() => {
    if (selectedMachine === "all") return null;
    return machines.find((m) => m.key === selectedMachine) || null;
  }, [selectedMachine, machines]);

  // Hitung Data Summary untuk Mesin yang dipilih (atau All)
  const currentSummary = useMemo(() => {
    if (selectedMachine === "all") {
      const stroke = totals.stroke || 0;
      const ng = totals.ng || 0;
      const downtimeMenit = totals.downtimeMenit || 0;
      const dandoriMenit = totals.dandoriMenit || 0;
      const whJam = totals.whJam !== undefined ? totals.whJam : Object.values(machineDataMap).reduce(
        (sum: number, d: any) => sum + (Number(d.whJam) || 0),
        0
      );
      const gsph = totals.gsph || 0;
      const targetGsph = totals.targetGsph || 0;
      const availability = totals.availability || 0;
      const performanceFactor = totals.performanceFactor || 0;
      const quality = stroke > 0 ? Math.max(0, ((stroke - ng) / stroke) * 100) : 100;
      const oee = totals.oee || 0;

      // Sum break_menit from all machines in machineDataMap
      const breakMenit = Object.values(machineDataMap).reduce(
        (sum: number, d: any) => sum + (Number(d.breakMenit) || 0),
        0
      );

      return {
        label: "Semua Machine (Total)",
        stroke,
        ng,
        downtimeMenit,
        dandoriMenit,
        breakMenit,
        whJam,
        gsph,
        targetGsph,
        availability,
        performanceFactor,
        quality,
        oee,
      };
    }

    const d = machineDataMap[selectedMachine] || {};
    const stroke = Number(d.stroke) || 0;
    const ng = Number(d.ng) || 0;
    const downtimeMenit = Number(d.downtime) || 0;
    const dandoriMenit = Number(d.dandori) || 0;
    const breakMenit = Number(d.breakMenit) || 0;
    const whJam = Number(d.whJam) || 0;
    const gsph = Number(d.gsph) || 0;
    const targetGsph = Number(d.targetGsph) || 0;
    const availability = Number(d.availability) || 0;
    const performanceFactor = Number(d.performanceFactor) || 0;
    const quality = Number(d.quality) || (stroke > 0 ? Math.max(0, ((stroke - ng) / stroke) * 100) : 100);
    const oee = Number(d.oee) || 0;

    return {
      label: activeMachineObj?.label || selectedMachine,
      stroke,
      ng,
      downtimeMenit,
      dandoriMenit,
      breakMenit,
      whJam,
      gsph,
      targetGsph,
      availability,
      performanceFactor,
      quality,
      oee,
    };
  }, [selectedMachine, totals, machineDataMap, activeMachineObj]);

  // Filter raw downtimes untuk mesin yang dipilih
  const filteredDowntimes = useMemo(() => {
    if (!rawDowntimes || rawDowntimes.length === 0) return [];
    if (selectedMachine === "all") return rawDowntimes;

    return rawDowntimes.filter((d: any) => {
      const rawMesin = (d.mesin || "").toLowerCase().trim();
      const selKey = selectedMachine.toLowerCase().trim();
      const selSlug = (activeMachineObj?.slug || "").toLowerCase().trim();
      return (
        rawMesin === selKey ||
        rawMesin === selSlug ||
        rawMesin.replace(/-/g, "_") === selKey.replace(/-/g, "_")
      );
    });
  }, [rawDowntimes, selectedMachine, activeMachineObj]);

  // Filter production rows untuk tabel produksi harian
  const filteredProductionRows = useMemo(() => {
    if (!rawProductionLogs || rawProductionLogs.length === 0) return [];
    if (selectedMachine === "all") return rawProductionLogs;

    return rawProductionLogs.filter((p: any) => {
      const rawMesin = (p.mesin || "").toLowerCase().trim();
      const selKey = selectedMachine.toLowerCase().trim();
      const selSlug = (activeMachineObj?.slug || "").toLowerCase().trim();
      return (
        rawMesin === selKey ||
        rawMesin === selSlug ||
        rawMesin.replace(/-/g, "_") === selKey.replace(/-/g, "_")
      );
    });
  }, [rawProductionLogs, selectedMachine, activeMachineObj]);

  // Downtime Category Tables Data (MESIN, DIES, FINGER, OTHER)
  const categoryTablesData = useMemo(() => {
    const categories = ["MESIN", "DIES", "FINGER", "OTHER"] as const;

    const result: Record<
      string,
      {
        totalMenit: number;
        totalCount: number;
        problems: Array<{
          problem: string;
          totalMenit: number;
          count: number;
          items: any[];
        }>;
      }
    > = {};

    const problemMaps: Record<
      string,
      Record<string, { problem: string; totalMenit: number; count: number; items: any[] }>
    > = {};

    categories.forEach((cat) => {
      result[cat] = { totalMenit: 0, totalCount: 0, problems: [] };
      problemMaps[cat] = {};
    });

    filteredDowntimes.forEach((d: any) => {
      let rawCat = (d.kategori || "").toUpperCase().trim();
      if (rawCat === "FORKLIFT" || rawCat.includes("FORKLIFT")) {
        rawCat = "OTHER";
      }
      const targetCat = (categories as readonly string[]).includes(rawCat) ? rawCat : "OTHER";

      let m = 0;
      if (d.waktu_awal && d.waktu_akhir) {
        m = Math.round((new Date(d.waktu_akhir).getTime() - new Date(d.waktu_awal).getTime()) / 60000);
      } else if (d.durasi_menit || d.durasi) {
        m = Number(d.durasi_menit || d.durasi || 0);
      }
      m = Math.max(0, m);

      const prob = (d.problem || d.deskripsi || "Tanpa Keterangan").trim();
      const pMap = problemMaps[targetCat];

      if (pMap) {
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

        if (result[targetCat]) {
          result[targetCat].totalMenit += m;
          result[targetCat].totalCount += 1;
        }
      }
    });

    categories.forEach((cat) => {
      if (problemMaps[cat]) {
        const sorted = Object.values(problemMaps[cat]).sort((a, b) => {
          if (b.totalMenit !== a.totalMenit) return b.totalMenit - a.totalMenit;
          return b.count - a.count;
        });
        result[cat].problems = sorted;
      }
    });

    return { result, categories };
  }, [filteredDowntimes]);

  // 5 Downtime Terburuk
  const top5Problems = useMemo(() => {
    if (selectedMachine !== "all" && worstPerMachine[selectedMachine]?.length > 0) {
      return worstPerMachine[selectedMachine].slice(0, 5);
    }

    const probMap: Record<string, { kategori: string; problem: string; menit: number }> = {};
    filteredDowntimes.forEach((d: any) => {
      let rawK = (d.kategori || "MESIN").toUpperCase().trim();
      if (rawK === "FORKLIFT" || rawK.includes("FORKLIFT")) rawK = "OTHER";
      const k = ["MESIN", "DIES", "FINGER", "OTHER"].includes(rawK) ? rawK : "OTHER";
      const p = (d.problem || d.deskripsi || "Tanpa Keterangan").trim();
      const key = `${k}_${p}`;
      let m = 0;
      if (d.waktu_awal && d.waktu_akhir) {
        m = Math.round((new Date(d.waktu_akhir).getTime() - new Date(d.waktu_awal).getTime()) / 60000);
      } else if (d.durasi_menit || d.durasi) {
        m = Number(d.durasi_menit || d.durasi || 0);
      }
      if (!probMap[key]) probMap[key] = { kategori: k, problem: p, menit: 0 };
      probMap[key].menit += m;
    });

    return Object.values(probMap).sort((a, b) => b.menit - a.menit).slice(0, 5);
  }, [selectedMachine, worstPerMachine, filteredDowntimes]);

  // Kesimpulan Downtime
  const downtimeKesimpulan = useMemo(() => {
    const cats = categoryTablesData.categories;
    const total = cats.reduce((acc, cat) => acc + (categoryTablesData.result[cat]?.totalMenit || 0), 0);
    if (total === 0) return "Tidak ada downtime tercatat pada periode ini.";

    const top = cats
      .map((cat) => ({ cat, menit: categoryTablesData.result[cat]?.totalMenit || 0 }))
      .sort((a, b) => b.menit - a.menit)[0];

    const pct = total > 0 ? ((top.menit / total) * 100).toFixed(0) : "0";
    return `Total downtime ${fmtNum(total)} mnt didominasi oleh ${top.cat} (${pct}%).`;
  }, [categoryTablesData, fmtNum]);

  // Render Charts (GSPH & Pie Donut)
  useEffect(() => {
    registerInternalVizPlugins();

    const getCssVar = (v: string) => {
      try {
        return getComputedStyle(document.documentElement).getPropertyValue(v).trim() || "";
      } catch {
        return "";
      }
    };

    // 1. Chart GSPH (Target vs Aktual atau Trend)
    if (chartCanvasRef.current) {
      if (chartInstancesRef.current.chart) chartInstancesRef.current.chart.destroy();

      let labels: string[] = [];
      let datasets: any[] = [];

      if (periodMode === "harian") {
        // Tampilkan hourly data untuk mesin terpilih atau gabungan
        const jamSet = new Set<number>();
        if (selectedMachine === "all") {
          machines.forEach((m) => (hourlyData[m.key] || []).forEach((h) => jamSet.add(h.jam)));
        } else {
          (hourlyData[selectedMachine] || []).forEach((h) => jamSet.add(h.jam));
        }

        const jamList = Array.from(jamSet).sort((a, b) => a - b);
        if (jamList.length === 0) {
          for (let h = 7; h <= 18; h++) jamList.push(h);
        }

        labels = jamList.map((j) => String(j).padStart(2, "0") + ":00");

        const actualValues = jamList.map((j) => {
          if (selectedMachine === "all") {
            const hits = machines
              .map((m) => (hourlyData[m.key] || []).find((h) => h.jam === j)?.gsph)
              .filter((v): v is number => v !== undefined && v > 0);
            if (hits.length === 0) return null;
            return Number((hits.reduce((a, b) => a + b, 0) / hits.length).toFixed(1));
          }
          const found = (hourlyData[selectedMachine] || []).find((h) => h.jam === j);
          return found && found.gsph > 0 ? Number(found.gsph.toFixed(1)) : null;
        });

        const tg = currentSummary.targetGsph || 0;

        datasets = [
          {
            type: "bar",
            label: "GSPH Aktual",
            data: actualValues,
            backgroundColor: (context: any) => {
              const chart = context.chart;
              return createAreaGradient(chart.ctx, chart.chartArea, "#38bdf8", 0.85, 0.5, 0.2);
            },
            borderRadius: 4,
            borderWidth: 0,
            order: 2,
          },
          ...(tg > 0
            ? [
                {
                  type: "line",
                  label: `Target (${fmtNum(tg)})`,
                  data: jamList.map(() => tg),
                  borderColor: "#f59e0b",
                  borderWidth: 2,
                  borderDash: [5, 5],
                  pointRadius: 0,
                  fill: false,
                  order: 1,
                },
              ]
            : []),
        ];
      } else {
        // Trend Bulanan atau Tahunan
        const lt = lineTrend || { labels: [], perLine: [] };
        labels = lt.labels;

        if (selectedMachine === "all") {
          // Average across all lines
          const avgValues = labels.map((_, i) => {
            const valid = (lt.perLine || [])
              .map((pl) => pl.values[i])
              .filter((v): v is number => v !== null && v !== undefined && v > 0);
            if (valid.length === 0) return null;
            return Number((valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1));
          });

          datasets = [
            {
              type: "line",
              label: "GSPH Rata-rata Pabrik",
              data: avgValues,
              borderColor: "#38bdf8",
              backgroundColor: (ctx: any) =>
                createAreaGradient(ctx.chart.ctx, ctx.chart.chartArea, "#38bdf8", 0.25, 0.05, 0.0),
              fill: true,
              tension: 0.35,
              borderWidth: 2.5,
              pointRadius: 3,
            },
          ];
        } else {
          const pl = (lt.perLine || []).find(
            (p) =>
              p.label.toLowerCase().includes(selectedMachine.toLowerCase()) ||
              p.label.toLowerCase().includes(activeMachineObj?.slug.toLowerCase() || "")
          );

          datasets = [
            {
              type: "line",
              label: pl?.label || currentSummary.label,
              data: pl?.values || [],
              borderColor: "#38bdf8",
              backgroundColor: (ctx: any) =>
                createAreaGradient(ctx.chart.ctx, ctx.chart.chartArea, "#38bdf8", 0.25, 0.05, 0.0),
              fill: true,
              tension: 0.35,
              borderWidth: 2.5,
              pointRadius: 3,
            },
          ];
        }
      }

      chartInstancesRef.current.chart = new Chart(chartCanvasRef.current, {
        type: "bar",
        data: { labels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "top",
              labels: {
                color: getCssVar("--muted-foreground") || "#94a3b8",
                boxWidth: 10,
                boxHeight: 10,
                font: { size: 10.5, weight: 600 },
              },
            },
            tooltip: {
              backgroundColor: getCssVar("--panel") || "#1e293b",
              titleColor: getCssVar("--text") || "#f1f5f9",
              bodyColor: getCssVar("--text") || "#f1f5f9",
              borderColor: getCssVar("--border") || "#334155",
              borderWidth: 1,
              padding: 8,
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: getCssVar("--chart-tick") || "#64748b", font: { size: 10 } },
            },
            y: {
              grid: { color: getCssVar("--chart-grid") || "#334155", drawTicks: false },
              ticks: { color: getCssVar("--chart-tick") || "#64748b", font: { size: 10 } },
              beginAtZero: true,
            },
          },
        },
      });
    }

    // 2. Donut Pie Chart Downtime per Kategori
    if (pieCanvasRef.current) {
      if (chartInstancesRef.current.pie) chartInstancesRef.current.pie.destroy();

      const categories = categoryTablesData.categories;
      const totalsPerCat = categories.map((cat) => categoryTablesData.result[cat]?.totalMenit || 0);
      const grandTotal = totalsPerCat.reduce((a, b) => a + b, 0);

      chartInstancesRef.current.pie = new Chart(pieCanvasRef.current, {
        type: "doughnut",
        data: {
          labels: [...categories],
          datasets: [
            {
              data: totalsPerCat,
              backgroundColor: (context: any) => {
                const chart = context.chart;
                const c = categories[context.dataIndex] || categories[0];
                const pair = CAT_GRAD_COLORS[c] || { top: "#fbbf24", bottom: "#d97706" };
                return createVerticalGradient(chart.ctx, chart.chartArea, pair.top, pair.bottom);
              },
              spacing: 4,
              borderRadius: 6,
              borderWidth: 1.5,
              borderColor: "rgba(255, 255, 255, 0.12)",
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { top: 4, right: 6, bottom: 4, left: 6 } },
          onHover: (evt: any, elements: any[]) => {
            if (evt.native?.target) evt.native.target.style.cursor = elements.length ? "pointer" : "default";
          },
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                color: getCssVar("--muted-foreground") || "#94a3b8",
                boxWidth: 8,
                boxHeight: 8,
                usePointStyle: true,
                pointStyle: "circle",
                font: { size: 10 },
                padding: 10,
                generateLabels: (chart: any) => {
                  const dataset = chart.data.datasets[0];
                  const total = (dataset.data as number[]).reduce((a: number, b: number) => a + b, 0);
                  const legendTextColor = getCssVar("--muted-foreground") || "#94a3b8";
                  return (chart.data.labels as string[]).map((label: string, i: number) => {
                    const val = (dataset.data as number[])[i] || 0;
                    const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                    const pair = CAT_GRAD_COLORS[label] || { top: "#fbbf24", bottom: "#d97706" };
                    return {
                      text: `${label}  ${pct}%`,
                      fontColor: legendTextColor,
                      fillStyle: pair.top,
                      strokeStyle: "transparent",
                      lineWidth: 0,
                      hidden: false,
                      index: i,
                    };
                  });
                },
              },
            },
            pieCenterText: {
              value: fmtNum(grandTotal),
              label: "Menit DT",
              color: () => getCssVar("--text") || "#f1f5f9",
              labelColor: () => getCssVar("--muted-foreground") || "#94a3b8",
            },
            sliceLabels: { enabled: false },
            tooltip: {
              backgroundColor: getCssVar("--panel") || "#1e293b",
              titleColor: getCssVar("--text") || "#f1f5f9",
              bodyColor: getCssVar("--text") || "#f1f5f9",
              borderColor: getCssVar("--border") || "#334155",
              borderWidth: 1,
              padding: 10,
              displayColors: false,
              callbacks: {
                title: () => "",
                label: (ctx: any) => {
                  const total = totalsPerCat.reduce((a, b) => a + b, 0);
                  const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : "0";
                  return `${ctx.label}: ${fmtNum(ctx.parsed)} menit (${pct}%)`;
                },
              },
            },
          } as any,
          ...(({ cutout: "68%" } as any)),
        },
      });
    }

    return () => {
      Object.values(chartInstancesRef.current).forEach((c) => {
        try {
          c?.destroy?.();
        } catch {}
      });
      chartInstancesRef.current = {};
    };
  }, [
    selectedMachine,
    periodMode,
    hourlyData,
    lineTrend,
    currentSummary,
    categoryTablesData,
    machines,
    activeMachineObj,
    theme,
    fmtNum,
  ]);

  return (
    <div className="perf-tab-admin-container perf-fullwidth-container space-y-4">
      {/* ── Toolbar Selector Mesin & Auto-Rotate TV ── */}
      <div className="perf-machine-bar flex flex-wrap items-center justify-between gap-3 p-3 bg-card/70 backdrop-blur-md rounded-xl border border-border/50 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          <button
            type="button"
            className={`chip text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
              selectedMachine === "all"
                ? "chip-active bg-primary text-primary-foreground font-bold shadow-xs"
                : "bg-muted/40 hover:bg-muted text-foreground"
            }`}
            onClick={() => handleSelectMachine("all")}
          >
            Semua Machine
          </button>
          {machines.map((m) => (
            <button
              key={m.key}
              type="button"
              className={`chip text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                selectedMachine === m.key
                  ? "chip-active bg-primary text-primary-foreground font-bold shadow-xs"
                  : "bg-muted/40 hover:bg-muted text-foreground"
              }`}
              onClick={() => handleSelectMachine(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Auto-Rotate TV Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAutoRotate((prev) => !prev)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              autoRotate
                ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/40 shadow-xs shadow-emerald-500/20"
                : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
            }`}
            title="Rotasi otomatis tampilan mesin setiap 20 detik untuk Display TV"
          >
            <Tv size={14} className={autoRotate ? "text-emerald-500" : "text-muted-foreground"} />
            <span
              className={`w-2 h-2 rounded-full ${autoRotate ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/40"}`}
            />
            <span>Rotasi Otomatis TV: {autoRotate ? `ON (${rotateCountdown}s)` : "OFF"}</span>
          </button>
        </div>
      </div>

      {/* ── Performance Main Panel (Gaya 100% Persis PerformanceTab Operator) ── */}
      <Card className="dash-panel card-glow-info p-4 sm:p-5">
        <div className="perf-header flex flex-wrap justify-between items-center gap-3 mb-4 pb-2 border-b border-border/40">
          <div className="flex items-center gap-3">
            <p className="dash-panel-title font-bold text-lg m-0 uppercase tracking-wider text-foreground">
              Performance {currentSummary.label}
            </p>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-semibold uppercase">
              Mode {periodMode}
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono font-bold text-sm text-[var(--amber)]">
            <span>{periodLabel}</span>
            {shiftFilter !== "all" && (
              <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                Shift {shiftFilter}
              </span>
            )}
          </div>
        </div>

        {/* ── Top Grid (9 Cards KPI di Kiri & Chart di Kanan) ── */}
        <div className="perf-top-grid">
          {/* Cards Column */}
          <div className="perf-cards-col">
            <Card
              className={`perf-card perf-card-oee ${
                currentSummary.oee >= 75
                  ? "card-glow-good"
                  : currentSummary.oee >= 50
                  ? "card-glow-warn"
                  : "card-glow-bad"
              }`}
            >
              <span className="perf-label">OEE</span>
              <span className="perf-value perf-value-xl">{fmtNum(currentSummary.oee)}%</span>
              <span className="perf-oee-breakdown text-xs text-muted-foreground block mt-1">
                A <b>{fmtNum(currentSummary.availability)}</b>% · P{" "}
                <b>{fmtNum(currentSummary.performanceFactor)}</b>% · Q{" "}
                <b>{fmtNum(currentSummary.quality)}</b>%
              </span>
            </Card>

            <Card
              className={`perf-card perf-card-accent ${
                currentSummary.performanceFactor >= 95
                  ? "card-glow-good"
                  : currentSummary.performanceFactor >= 80
                  ? "card-glow-warn"
                  : "card-glow-bad"
              }`}
            >
              <span className="perf-label">GSPH Aktual</span>
              <span className="perf-value">{fmtNum(currentSummary.gsph)}</span>
            </Card>

            <Card className="perf-card card-glow-info">
              <span className="perf-label">GSPH Target</span>
              <span className="perf-value">{fmtNum(currentSummary.targetGsph)}</span>
            </Card>

            <Card className="perf-card card-glow-info">
              <span className="perf-label">Stroke (Qty)</span>
              <span className="perf-value">{fmtNum(currentSummary.stroke)}</span>
            </Card>

            <Card
              className={`perf-card ${
                currentSummary.stroke > 0 && currentSummary.ng / currentSummary.stroke <= 0.005
                  ? "card-glow-good"
                  : "card-glow-warn"
              }`}
            >
              <span className="perf-label">NG</span>
              <span className="perf-value">{fmtNum(currentSummary.ng)}</span>
            </Card>

            <Card className="perf-card card-glow-info">
              <span className="perf-label">Downtime</span>
              <span className="perf-value">{fmtNum(currentSummary.downtimeMenit)} mnt</span>
            </Card>

            <Card className="perf-card card-glow-info">
              <span className="perf-label">Dandori</span>
              <span className="perf-value">{fmtNum(currentSummary.dandoriMenit)} mnt</span>
            </Card>

            <Card className="perf-card card-glow-info">
              <span className="perf-label">Break</span>
              <span className="perf-value">{fmtNum(currentSummary.breakMenit)} mnt</span>
            </Card>

            <Card className="perf-card card-glow-info">
              <span className="perf-label">Jam Kerja</span>
              <span className="perf-value">{fmtNum(currentSummary.whJam)} jam</span>
            </Card>
          </div>

          {/* Chart Column */}
          <div className="perf-chart-col">
            {periodMode !== "harian" ? (
              <div className="perf-chart-wrap">
                <canvas ref={chartCanvasRef} />
              </div>
            ) : (
              <div className="perf-daily-split grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="perf-daily-chart">
                  <p className="panel-subtitle font-bold text-sm mb-2 text-foreground">
                    GSPH Target vs Aktual (per Jam)
                  </p>
                  <div className="perf-chart-wrap perf-chart-wrap-daily">
                    <canvas ref={chartCanvasRef} />
                  </div>
                </div>

                <div className="perf-daily-list">
                  <p className="panel-subtitle font-bold text-sm mb-2 text-foreground">
                    Produksi Hari Itu{" "}
                    <span className="count font-mono text-muted-foreground">
                      ({filteredProductionRows.length} baris)
                    </span>
                  </p>
                  <div className="table-wrap" style={{ maxHeight: 200, overflowY: "auto" }}>
                    <table className="table-compact text-sm w-full">
                      <thead>
                        <tr>
                          <th>Mesin/Stasiun</th>
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
                        {filteredProductionRows.length > 0 ? (
                          filteredProductionRows.slice(0, 50).map((row: any) => (
                            <tr key={row.id}>
                              <td className="mono text-xs">{row.stasiun || row.mesin || "-"}</td>
                              <td className="mono text-xs">
                                {row.waktu_awal
                                  ? new Date(row.waktu_awal).toLocaleTimeString("id-ID", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : "-"}
                              </td>
                              <td className="mono text-xs">
                                {row.waktu_akhir
                                  ? new Date(row.waktu_akhir).toLocaleTimeString("id-ID", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : "-"}
                              </td>
                              <td className="text-xs">{row.part_number || "-"}</td>
                              <td className="mono text-xs">{fmtNum(row.qty)}</td>
                              <td className="mono text-xs">{fmtNum(row.dandori_menit || 0)}</td>
                              <td className="mono text-xs">{fmtNum(row.downtime_menit || 0)}</td>
                              <td className="mono text-xs">{fmtNum(row.break_menit || 0)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={8} className="empty-state text-center py-4 text-xs text-muted-foreground">
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

            {/* ── 4 Downtime Tables per Category (MESIN, DIES, FINGER, OTHER) ── */}
            <div className="perf-cat-tables-compact mt-4 pt-3 perf-section-divider">
              <div className="flex items-center justify-between mb-2">
                <p className="panel-subtitle font-bold text-xs uppercase tracking-wider text-muted-foreground m-0">
                  Downtime per Kategori
                </p>
                <span className="text-xs text-muted-foreground">Klik baris untuk rincian log</span>
              </div>

              <div
                className={`grid grid-cols-1 sm:grid-cols-2 ${
                  categoryTablesData.categories.length === 4 ? "lg:grid-cols-4" : "md:grid-cols-3"
                } gap-2`}
              >
                {categoryTablesData.categories.map((cat) => {
                  const catData = categoryTablesData.result[cat] || { totalMenit: 0, totalCount: 0, problems: [] };
                  const badgeColor =
                    cat === "MESIN"
                      ? "bg-sky-500/15 text-sky-500 border-sky-500/40 shadow-xs shadow-sky-500/20"
                      : cat === "DIES"
                      ? "bg-rose-500/15 text-rose-500 border-rose-500/40 shadow-xs shadow-rose-500/20"
                      : cat === "FINGER"
                      ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/40 shadow-xs shadow-emerald-500/20"
                      : "bg-amber-500/15 text-amber-500 border-amber-500/40 shadow-xs shadow-amber-500/20";

                  const catCardClass =
                    cat === "MESIN"
                      ? "perf-cat-card perf-cat-card-mesin"
                      : cat === "DIES"
                      ? "perf-cat-card perf-cat-card-dies"
                      : cat === "FINGER"
                      ? "perf-cat-card perf-cat-card-finger"
                      : "perf-cat-card perf-cat-card-other";

                  const borderBottomColor =
                    cat === "MESIN"
                      ? "border-sky-500/30"
                      : cat === "DIES"
                      ? "border-rose-500/30"
                      : cat === "FINGER"
                      ? "border-emerald-500/30"
                      : "border-amber-500/30";

                  const hoverRowColor =
                    cat === "MESIN"
                      ? "hover:bg-sky-500/10"
                      : cat === "DIES"
                      ? "hover:bg-rose-500/10"
                      : cat === "FINGER"
                      ? "hover:bg-emerald-500/10"
                      : "hover:bg-amber-500/10";

                  const actionBtnHover =
                    cat === "MESIN"
                      ? "hover:bg-sky-500/20 hover:text-sky-500"
                      : cat === "DIES"
                      ? "hover:bg-rose-500/20 hover:text-rose-500"
                      : cat === "FINGER"
                      ? "hover:bg-emerald-500/20 hover:text-emerald-500"
                      : "hover:bg-amber-500/20 hover:text-amber-500";

                  const neonGlowClass =
                    cat === "MESIN"
                      ? "border-sky-500/60 shadow-[0_0_16px_-2px_rgba(14,165,233,0.4)]"
                      : cat === "DIES"
                      ? "border-rose-500/60 shadow-[0_0_16px_-2px_rgba(244,63,94,0.4)]"
                      : cat === "FINGER"
                      ? "border-emerald-500/60 shadow-[0_0_16px_-2px_rgba(16,185,129,0.4)]"
                      : "border-amber-500/60 shadow-[0_0_16px_-2px_rgba(245,158,11,0.4)]";

                  return (
                    <div
                      key={cat}
                      className={`p-2.5 flex flex-col justify-between ${catCardClass} ${neonGlowClass}`}
                    >
                      <div>
                        <div
                          className={`flex items-center justify-between pb-1.5 mb-1.5 border-b ${borderBottomColor}`}
                        >
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
                                <th className="w-7 text-center px-1 py-1 text-xs">No.</th>
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

        {/* ── Lower Grid (5 Downtime Terburuk di Kiri & Donut Pie Chart di Kanan) ── */}
        <div className="perf-lower-grid mt-4 pt-3 perf-section-divider">
          <div className="perf-lower-col">
            <p className="panel-subtitle font-bold text-sm mb-2 text-foreground">5 Downtime Terburuk</p>
            <div className="table-wrap">
              <table className="table-compact text-sm w-full">
                <thead>
                  <tr>
                    <th>Kategori</th>
                    <th>Problem</th>
                    <th>Menit</th>
                  </tr>
                </thead>
                <tbody>
                  {top5Problems.length > 0 ? (
                    top5Problems.map((row: any, idx: number) => (
                      <tr key={idx}>
                        <td title={row.kategori}>
                          <span
                            className={`badge ${
                              row.kategori === "MESIN"
                                ? "bg-sky-500/15 text-sky-500 border border-sky-500/40"
                                : row.kategori === "DIES"
                                ? "bg-rose-500/15 text-rose-500 border border-rose-500/40"
                                : row.kategori === "FINGER"
                                ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/40"
                                : "bg-amber-500/15 text-amber-500 border border-amber-500/40"
                            }`}
                          >
                            {row.kategori}
                          </span>
                        </td>
                        <td
                          title={row.problem}
                          style={{
                            minWidth: 100,
                            maxWidth: 180,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {row.problem}
                        </td>
                        <td className="mono font-semibold">{fmtNum(row.menit)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="empty-state text-center py-4 text-muted-foreground">
                        Tidak ada downtime.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="perf-lower-col perf-pie-col">
            <p className="panel-subtitle font-bold text-sm mb-2 text-foreground">
              Downtime per Kategori
              <span className="ml-1 text-muted-foreground font-mono font-normal">
                (MESIN / DIES / FINGER / OTHER)
              </span>
            </p>
            <div className="perf-pie-wrap">
              <canvas ref={pieCanvasRef} />
            </div>
            <p className="perf-pie-summary text-sm text-muted-foreground mt-2">
              {downtimeKesimpulan}
            </p>
          </div>
        </div>
      </Card>

      {/* ── Detail Dialog Downtime Log ── */}
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
                    ? "bg-sky-500/10 text-sky-500 border-sky-500/30"
                    : selectedProblemDetail?.kategori === "DIES"
                    ? "bg-rose-500/10 text-rose-500 border-rose-500/30"
                    : selectedProblemDetail?.kategori === "FINGER"
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30"
                    : "bg-amber-500/10 text-amber-500 border-amber-500/30"
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
                <b className="text-foreground font-mono text-base">
                  {fmtNum(selectedProblemDetail?.totalMenit)} menit
                </b>
              </span>
              <span>•</span>
              <span>
                Frekuensi:{" "}
                <b className="text-foreground font-mono text-base">
                  {selectedProblemDetail?.count}x
                </b>
              </span>
            </div>
          </DialogHeader>

          <div className="table-wrap flex-1 overflow-y-auto mt-4" style={{ maxHeight: "calc(88vh - 180px)" }}>
            <table className="table-compact perf-dialog-table text-sm w-full">
              <thead>
                <tr>
                  <th className="w-10 text-center">No.</th>
                  <th>Waktu Awal</th>
                  <th>Waktu Akhir</th>
                  <th className="w-20 text-right">Durasi</th>
                  <th>Shift</th>
                  <th>Operator</th>
                  <th>Penyebab</th>
                  <th>Countermeasure</th>
                </tr>
              </thead>
              <tbody>
                {(selectedProblemDetail?.items || []).map((it: any, idx: number) => {
                  const startStr = it.waktu_awal
                    ? new Date(it.waktu_awal).toLocaleString("id-ID", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "-";
                  const endStr = it.waktu_akhir
                    ? new Date(it.waktu_akhir).toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "-";
                  return (
                    <tr key={it.id || idx}>
                      <td className="text-center font-mono text-muted-foreground">{idx + 1}</td>
                      <td className="mono">{startStr}</td>
                      <td className="mono">{endStr}</td>
                      <td className="text-right mono font-semibold">
                        {fmtNum(it.calcMenit ?? it.durasi_menit ?? it.durasi ?? 0)} mnt
                      </td>
                      <td className="mono">{it.shift || "-"}</td>
                      <td>{it.operator_name || it.operator || "-"}</td>
                      <td className="text-muted-foreground" style={{ maxWidth: 200 }}>
                        {it.penyebab || "-"}
                      </td>
                      <td className="text-muted-foreground" style={{ maxWidth: 200 }}>
                        {it.countermeasure || "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
