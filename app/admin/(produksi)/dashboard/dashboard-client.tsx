"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import SQCDMPPanel from "@/components/produksi/SQCDMPPanel";
import { useThemeListener } from "@/hooks/produksi/useThemeListener";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { ProdProfile } from "@/types/produksi";
import Chart from "chart.js/auto";
import { registerInternalVizPlugins } from "@/lib/produksi/chartPlugins";
import { Sun, Moon, AlertTriangle, ShieldCheck, Home, Maximize, Minimize } from "lucide-react";

const MACHINES = [
  { key: "tandem", label: "Tandem", shortLabel: "Tandem", slug: "tandem" },
  { key: "blanking", label: "Blanking", shortLabel: "Blanking", slug: "blanking" },
  { key: "transfer_2000t", label: "Transfer 2000t", shortLabel: "TR 2000t", slug: "transfer-2000t" },
  { key: "transfer_800t", label: "Transfer 800t", shortLabel: "TR 800t", slug: "transfer-800t" },
  { key: "pc200t", label: "PC200t", shortLabel: "PC200t", slug: "pc200t" },
];

const KIJUN_PEFF = 0.775471310201421;

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function DashboardClient() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [periodMode, setPeriodMode] = useState<"harian" | "bulanan" | "tahunan">("harian");
  const [tanggal, setTanggal] = useState(new Date().toISOString().split("T")[0]);
  const [bulanPilih, setBulanPilih] = useState(new Date().getMonth());
  const [tahunPilih, setTahunPilih] = useState(new Date().getFullYear());
  const [shiftFilter, setShiftFilter] = useState("all");

  const [, setProfile] = useState<ProdProfile | null>(null);
  const [paretoDowntime, setParetoDowntime] = useState<any[]>([]);
  const [fleetTop10, setFleetTop10] = useState<any[]>([]);
  // worst-5 downtime per mesin: { mesinKey -> { kategori, problem, menit }[] }
  const [worstPerMachine, setWorstPerMachine] = useState<Record<string, { kategori: string; problem: string; menit: number }[]>>({});
  const [machineDataMap, setMachineDataMap] = useState<Record<string, any>>({});
  const [dtByCategoryMap, setDtByCategoryMap] = useState<Record<string, Record<string, number>>>({});

  const [totals, setTotals] = useState({
    gsph: 0, targetGsph: 0, performanceFactor: 0,
    okQty: 0, ng: 0, targetQty: 0,
    availability: 0, downtimeMenit: 0,
    stroke: 0, dandoriMenit: 0, oee: 0,
    ngValueRp: 0,
    peff: 0, productivity: 0, gapMenit: 0,
  });

  const [productivityTrend, setProductivityTrend] = useState<{
    labels: string[];
    values: (number | null)[];
    cumValues: (number | null)[];
  }>({ labels: [], values: [], cumValues: [] });

  const [productivityToday, setProductivityToday] = useState<{
    ehJam: number;
    whJam: number;
    totalManHoursJam: number;
    gapJam: number;
    peff: number;
    productivity: number;
    sumber?: string;
  } | null>(null);

  // Mesin yang produksi (stroke > 0) tapi belum ada Target GSPH eksplisit di
  // mesin_settings — Performance/OEE mesin itu bakal tampil 0%.
  const [machinesTanpaTarget, setMachinesTanpaTarget] = useState<string[]>([]);
  const [, setLineAktif] = useState(0);
  const [, setAchievementPct] = useState(0);

  // Modal drill-down downtime — klik chart pie kategori / bar per line, tampilkan
  // baris downtime_log asli yang jadi sumber angkanya.
  const [downtimeModal, setDowntimeModal] = useState<{
    open: boolean; loading: boolean; title: string; rows: any[];
  }>({ open: false, loading: false, title: "", rows: [] });

  const [safety, setSafety] = useState({ hariTanpaAccident: 0, accident: 0 });
  const [scrapValueRp, setScrapValueRp] = useState(0);
  const [scrapRasio, setScrapRasio] = useState(0);
  const [scrapTargetRasio, setScrapTargetRasio] = useState(0);
  const [attendance, setAttendance] = useState({
    pctExclCuti: 0, pctExclCutiFromDenom: 0, total_orang: 0, hadir: 0, cuti: 0, absen: 0, overtime_jam: 0,
    totalHadir: 0, totalCuti: 0, totalAbsen: 0, totalOvertimeJam: 0,
  });
  const [attendanceByShift, setAttendanceByShift] = useState<{
    shift1: { hadir: number; total: number };
    shift2: { hadir: number; total: number };
  } | undefined>(undefined);

  const [miniTrend, setMiniTrend] = useState<{
    labels: string[];
    safety: number[];
    quality: number[];
    productivity: number[];
    cost: number[];
    moral: number[];
  } | undefined>(undefined);

  // Per-period GSPH trend for bulanan/tahunan chart
  const [lineTrend, setLineTrend] = useState<{
    labels: string[];
    perLine: { label: string; values: (number | null)[] }[];
  } | undefined>(undefined);

  // Per-hour GSPH from RPC, keyed by machine key
  const [hourlyData, setHourlyData] = useState<Record<string, { jam: number; gsph: number }[]>>({});

  const theme = useThemeListener();
  const [vizMode, setVizMode] = useState<"umum" | "internal">("umum");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => { });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => { });
      }
    }
  };

  useEffect(() => {
    // Otomatis full screen saat masuk ke dashboard
    const enterFullscreen = async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
        }
      } catch (err) {
        console.warn("Fullscreen auto-trigger ignored by browser policy:", err);
      }
    };
    enterFullscreen();

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => { });
      }
    };
  }, []);

  const hourlyCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fleetCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const categoryPieRef = useRef<HTMLCanvasElement | null>(null);
  const donutAvailRef = useRef<HTMLCanvasElement | null>(null);
  const donutPerfRef = useRef<HTMLCanvasElement | null>(null);
  const donutQualRef = useRef<HTMLCanvasElement | null>(null);
  const internalProdTrendRef = useRef<HTMLCanvasElement | null>(null);
  const internalProdCumRef = useRef<HTMLCanvasElement | null>(null);
  const internalAvailRef = useRef<HTMLCanvasElement | null>(null);
  const internalGsphRef = useRef<HTMLCanvasElement | null>(null);
  const internalDowntimeLineRef = useRef<HTMLCanvasElement | null>(null);
  const internalCategoryPieRef = useRef<HTMLCanvasElement | null>(null);
  const internalCategoryLineRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstances = useRef<Record<string, any>>({});

  const destroyChartOnCanvas = (canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    Chart.getChart(canvas)?.destroy();
  };

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    localStorage.setItem("futaba.theme", next);
    if (next === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    } else {
      document.documentElement.classList.add("light");
      document.documentElement.classList.remove("dark");
    }
    document.documentElement.setAttribute("data-theme", next);
    window.dispatchEvent(new Event("themeChange"));
  };

  /* ── Date bounds helper ──────────────────────────────── */
  const bounds = useCallback(() => {
    if (periodMode === "tahunan") {
      return { start: new Date(tahunPilih, 0, 1), end: new Date(tahunPilih + 1, 0, 1) };
    }
    if (periodMode === "bulanan") {
      return { start: new Date(tahunPilih, bulanPilih, 1), end: new Date(tahunPilih, bulanPilih + 1, 1) };
    }
    // harian
    const d = new Date(tanggal + "T00:00:00");
    if (shiftFilter === "1") return { start: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 7, 0), end: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 19, 30) };
    if (shiftFilter === "2") return { start: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 19, 30), end: new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 7, 0) };
    return { start: new Date(d.getFullYear(), d.getMonth(), d.getDate()), end: new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1) };
  }, [tanggal, periodMode, bulanPilih, tahunPilih, shiftFilter]);

  /* ── Downtime drill-down modal ── */
  const openDowntimeDetail = useCallback(async (filters: { mesin?: string; mesinLabel?: string; kategori?: string }) => {
    setDowntimeModal({ open: true, loading: true, title: "", rows: [] });
    const { start, end } = bounds();
    let q = supabase.from("prod_downtime_log").select("*")
      .gte("waktu_awal", start.toISOString()).lt("waktu_awal", end.toISOString())
      .order("waktu_awal", { ascending: false })
      .limit(200);
    if (filters.mesin) q = q.eq("mesin", filters.mesin);
    if (filters.kategori) q = q.eq("kategori", filters.kategori);
    const { data } = await q;
    const rows = (data || []).map((r: any) => ({
      ...r,
      mesinLabel: (MACHINES.find((m) => m.key === r.mesin) || {}).label || r.mesin,
      menit: Math.round((new Date(r.waktu_akhir).getTime() - new Date(r.waktu_awal).getTime()) / 60000),
    }));
    const parts: string[] = [];
    if (filters.mesinLabel) parts.push(filters.mesinLabel);
    if (filters.kategori) parts.push(filters.kategori);
    setDowntimeModal({
      open: true, loading: false, rows,
      title: "Detail Downtime" + (parts.length ? " — " + parts.join(" · ") : " — Semua Line"),
    });
  }, [bounds, supabase]);

  const closeDowntimeDetail = () => setDowntimeModal((prev) => ({ ...prev, open: false }));

  const fmtDowntimeWaktu = (iso?: string | null) => {
    if (!iso) return "-";
    return new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  /* ── fetchLineTrend ─────────────── */
  const fetchLineTrend = useCallback(async () => {
    if (periodMode === "harian") {
      setLineTrend(undefined);
      return;
    }
    const d = new Date(tanggal + "T00:00:00");
    let start: Date, end: Date, bucket: string, labels: string[], keyOf: (d: Date) => number;

    if (periodMode === "bulanan") {
      const y = d.getFullYear(), m = bulanPilih;
      const n = new Date(y, m + 1, 0).getDate();
      start = new Date(y, m, 1); end = new Date(y, m + 1, 1);
      bucket = "day";
      labels = Array.from({ length: n }, (_, i) => String(i + 1));
      keyOf = (dt: Date) => dt.getDate() - 1;
    } else {
      const y = d.getFullYear();
      start = new Date(y, 0, 1); end = new Date(y + 1, 0, 1);
      bucket = "month";
      labels = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
      keyOf = (dt: Date) => dt.getMonth();
    }

    try {
      const res = await Promise.all(MACHINES.map((m) =>
        supabase.rpc("prod_gsph_trend_bucketed", {
          p_mesin: m.key, p_start: start.toISOString(), p_end: end.toISOString(), p_bucket: bucket,
        })
      ));

      const perLine = MACHINES.map((m, idx) => {
        const vals: (number | null)[] = new Array(labels.length).fill(null);
        const rows = (res[idx] && res[idx].data) || [];
        rows.forEach((r: any) => {
          const dt = new Date(r.bucket_start);
          const i = keyOf(dt);
          if (i >= 0 && i < vals.length) {
            const g = Number(r.gsph) || 0;
            vals[i] = g > 0 ? Number(g.toFixed(1)) : null;
          }
        });
        return { label: m.label, values: vals };
      });
      setLineTrend({ labels, perLine });
    } catch (e) {
      console.warn("fetchLineTrend failed:", e);
    }
  }, [periodMode, tanggal, bulanPilih, supabase]);

  /* ── fetchProductivityTrend & fetchProductivityToday ── */
  const fetchProductivityTrend = useCallback(async () => {
    let start: Date, end: Date, bucket: string, labels: string[], keyOf: (d: Date) => number;
    if (periodMode === "harian") {
      const base = new Date(tanggal + "T00:00:00");
      start = new Date(base.getFullYear(), base.getMonth(), base.getDate());
      end = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1);
      bucket = "hour";
      labels = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0") + ":00");
      keyOf = (d) => d.getHours();
    } else if (periodMode === "bulanan") {
      const y = tahunPilih, m = bulanPilih;
      const n = new Date(y, m + 1, 0).getDate();
      start = new Date(y, m, 1); end = new Date(y, m + 1, 1);
      bucket = "day";
      labels = Array.from({ length: n }, (_, i) => String(i + 1));
      keyOf = (d) => d.getDate() - 1;
    } else {
      const y = tahunPilih;
      start = new Date(y, 0, 1); end = new Date(y + 1, 0, 1);
      bucket = "month";
      labels = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
      keyOf = (d) => d.getMonth();
    }

    try {
      const { data } = await supabase.rpc("prod_productivity_trend_bucketed", {
        p_start: start.toISOString(),
        p_end: end.toISOString(),
        p_bucket: bucket,
      });

      const values = new Array(labels.length).fill(null);
      const cumValues = new Array(labels.length).fill(null);
      let totalEh = 0, totalWh = 0, totalManHours = 0;
      let runningEh = 0, runningWh = 0;

      const sorted = [...(data || [])].sort((a: any, b: any) => new Date(a.bucket_start).getTime() - new Date(b.bucket_start).getTime());
      sorted.forEach((r: any) => {
        const d = new Date(r.bucket_start);
        const i = keyOf(d);
        const eh = Number(r.eh_menit) || 0;
        const wh = Number(r.wh_menit) || 0;
        totalEh += eh; totalWh += wh;
        totalManHours += Number(r.total_man_hours_menit) || 0;
        runningEh += eh; runningWh += wh;
        if (i >= 0 && i < values.length) {
          const peff = Number(r.peff) || 0;
          const productivity = KIJUN_PEFF > 0 ? (peff / KIJUN_PEFF) * 100 : 0;
          values[i] = wh > 0 ? Number(productivity.toFixed(1)) : null;
          if (runningWh > 0) {
            const peffKum = runningEh / runningWh;
            cumValues[i] = KIJUN_PEFF > 0 ? Number(((peffKum / KIJUN_PEFF) * 100).toFixed(1)) : null;
          }
        }
      });

      setProductivityTrend({ labels, values, cumValues });

      const peffTotal = totalWh > 0 ? totalEh / totalWh : 0;
      const prodTotal = KIJUN_PEFF > 0 ? (peffTotal / KIJUN_PEFF) * 100 : 0;
      const gapM = totalManHours - totalWh;

      setTotals((prev) => ({
        ...prev,
        peff: peffTotal,
        productivity: prodTotal,
        gapMenit: gapM,
      }));
    } catch (e) {
      console.warn("fetchProductivityTrend failed:", e);
    }
  }, [periodMode, tanggal, bulanPilih, tahunPilih, supabase]);

  const fetchProductivityToday = useCallback(async () => {
    try {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const { data } = await supabase.rpc("prod_productivity_trend_bucketed", {
        p_start: start.toISOString(),
        p_end: end.toISOString(),
        p_bucket: "day",
      });
      const dayRow = (data && data[0]) || null;
      setProductivityToday(
        dayRow
          ? {
            ehJam: (Number(dayRow.eh_menit) || 0) / 60,
            whJam: (Number(dayRow.wh_menit) || 0) / 60,
            totalManHoursJam: (Number(dayRow.total_man_hours_menit) || 0) / 60,
            gapJam: (Number(dayRow.gap_menit) || 0) / 60,
            peff: Number(dayRow.peff) || 0,
            productivity: KIJUN_PEFF > 0 ? ((Number(dayRow.peff) || 0) / KIJUN_PEFF) * 100 : 0,
            sumber: dayRow.sumber,
          }
          : null
      );
    } catch (e) {
      console.warn("fetchProductivityToday failed:", e);
    }
  }, [supabase]);

  /* ── fetchMiniTrend ─────────────── */
  const fetchMiniTrend = useCallback(async () => {
    const COUNT = 6;
    const base = new Date(tanggal + "T00:00:00");
    const periods: { start: Date; end: Date; label: string }[] = [];

    for (let i = COUNT - 1; i >= 0; i--) {
      let start: Date, end: Date, label: string;
      if (periodMode === "tahunan") {
        const y = base.getFullYear() - i;
        start = new Date(y, 0, 1); end = new Date(y + 1, 0, 1); label = String(y);
      } else if (periodMode === "bulanan") {
        start = new Date(base.getFullYear(), bulanPilih - i, 1);
        end = new Date(base.getFullYear(), bulanPilih - i + 1, 1);
        label = start.toLocaleDateString("id-ID", { month: "short" });
      } else {
        start = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i);
        end = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i + 1);
        label = start.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
      }
      periods.push({ start, end, label });
    }

    const out: {
      labels: string[];
      safety: number[]; quality: number[]; productivity: number[]; cost: number[]; moral: number[];
    } = { labels: periods.map((p) => p.label), safety: [], quality: [], productivity: [], cost: [], moral: [] };

    try {
      const perPeriod = await Promise.all(periods.map(async (p) => {
        const sIso = p.start.toISOString(), eIso = p.end.toISOString();
        const sDate = localDateStr(p.start), eDate = localDateStr(p.end);

        const safetyRpcP = Promise.resolve(supabase.rpc("prod_safety_summary", { p_start: sDate, p_end: eDate })).catch(() => ({ data: null, error: true }));
        const attRpcP = Promise.resolve(supabase.rpc("prod_attendance_summary", { p_start: sDate, p_end: eDate })).catch(() => ({ data: null, error: true }));
        const scrapRpcP = Promise.resolve(supabase.rpc("prod_scrap_top_end_summary", { p_start: sDate, p_end: eDate })).catch(() => ({ data: null, error: true }));
        const aggAllP = Promise.all(MACHINES.map((m) =>
          supabase.rpc("prod_performance_aggregate", { p_mesin: m.key, p_stasiun_list: null, p_start: sIso, p_end: eIso })
        ));
        const [aggAll, safetyRes, attRes, scrapRes] = await Promise.all([
          aggAllP,
          safetyRpcP,
          attRpcP,
          scrapRpcP,
        ]);

        let stroke = 0, ng = 0, ngValue = 0, whMenit = 0;
        aggAll.forEach((r: any) => {
          const row = (r.data && r.data[0]) || {};
          stroke += Number(row.stroke) || 0;
          ng += Number(row.ng) || 0;
          ngValue += Number(row.ng_value) || 0;
          whMenit += Number(row.wh_menit) || 0;
        });
        const whJam = whMenit / 60;
        const gsph = whJam > 0 ? stroke / whJam : 0;

        const sRow = (safetyRes.data && safetyRes.data[0]) || {};
        const scRow = (scrapRes.data && scrapRes.data[0]) || {};
        const aRow = (attRes.data && attRes.data[0]) || {};
        const totalSlot = Number(aRow.total_orang) || 0;
        const hadir = Number(aRow.hadir) || 0;

        return {
          safety: Number(sRow.accident_count) || 0,
          quality: stroke > 0 ? Number(((ng / stroke) * 100).toFixed(3)) : 0,
          productivity: Number(gsph.toFixed(1)),
          cost: Number((((ngValue) + (Number(scRow.scrap_value_kidr) || 0) * 1000) / 1e6).toFixed(2)),
          moral: totalSlot > 0 ? Number(((hadir / totalSlot) * 100).toFixed(1)) : 0,
        };
      }));

      perPeriod.forEach((v) => {
        out.safety.push(v.safety);
        out.quality.push(v.quality);
        out.productivity.push(v.productivity);
        out.cost.push(v.cost);
        out.moral.push(v.moral);
      });

      setMiniTrend(out);
    } catch (e) {
      console.warn("fetchMiniTrend failed:", e);
    }
  }, [periodMode, tanggal, bulanPilih, supabase]);

  /* ── fetchAttendanceByShift ──────── */
  const fetchAttendanceByShift = useCallback(async (startDate: string, endDate: string) => {
    try {
      const [r1, r2] = await Promise.all([
        supabase.rpc("prod_attendance_summary", { p_start: startDate, p_end: endDate, p_shift: "1" }),
        supabase.rpc("prod_attendance_summary", { p_start: startDate, p_end: endDate, p_shift: "2" }),
      ]);
      const row1 = (!r1.error && r1.data && r1.data[0]) || {};
      const row2 = (!r2.error && r2.data && r2.data[0]) || {};
      return {
        shift1: { hadir: Number(row1.hadir) || 0, total: Number(row1.total_orang) || 0 },
        shift2: { hadir: Number(row2.hadir) || 0, total: Number(row2.total_orang) || 0 },
      };
    } catch {
      return undefined;
    }
  }, [supabase]);

  /* ── Fetch Main Data ───────────────────────────────────── */
  const fetchDashboardData = useCallback(async (isCancelled: () => boolean = () => false) => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      let profileResult: ProdProfile | null = null;
      if (session?.user) {
        const { data: profData } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
        if (profData) profileResult = profData as ProdProfile;
      }

      let startDate = tanggal;
      let endDate = tanggal;
      if (periodMode === "bulanan") {
        const yr = tahunPilih, mo = bulanPilih;
        startDate = `${yr}-${String(mo + 1).padStart(2, "0")}-01`;
        const lastDay = new Date(yr, mo + 1, 0).getDate();
        endDate = `${yr}-${String(mo + 1).padStart(2, "0")}-${lastDay}`;
      } else if (periodMode === "tahunan") {
        startDate = `${tahunPilih}-01-01`;
        endDate = `${tahunPilih}-12-31`;
      }

      const { start: rangeStart, end: rangeEnd } = bounds();
      const rangeStartIso = rangeStart.toISOString();
      const rangeEndIso = rangeEnd.toISOString();

      const [aggResults, topProbResults, byCatResults, settingsRes] = await Promise.all([
        Promise.all(MACHINES.map((m) =>
          supabase.rpc("prod_performance_aggregate", { p_mesin: m.key, p_stasiun_list: null, p_start: rangeStartIso, p_end: rangeEndIso })
        )),
        Promise.all(MACHINES.map((m) =>
          supabase.rpc("prod_downtime_top_problems", { p_mesin: m.key, p_stasiun_list: null, p_start: rangeStartIso, p_end: rangeEndIso, p_limit: 10 })
        )),
        Promise.all(MACHINES.map((m) =>
          supabase.rpc("prod_downtime_by_category", { p_mesin: m.key, p_stasiun_list: null, p_start: rangeStartIso, p_end: rangeEndIso })
        )),
        supabase.from("prod_mesin_settings").select("*"),
      ]);

      const settingsMap: Record<string, { mode: string; fixed: number; targetAvailability: number }> = {};
      (settingsRes.data || []).forEach((r: any) => {
        settingsMap[r.mesin] = {
          mode: r.gsph_target_mode || "fixed",
          fixed: Number(r.gsph_target_fixed) || 0,
          targetAvailability: Number(r.target_availability) || 0,
        };
      });

      let totalStroke = 0, totalNG = 0, totalNgValue = 0, totalDowntime = 0, totalDandori = 0, totalWhJam = 0;
      let targetGsphSum = 0, targetGsphCount = 0;
      const perMachineMap: Record<string, any> = {};
      const dtByCat: Record<string, Record<string, number>> = {};
      let lineAktifCount = 0;
      const tanpaTargetLabels: string[] = [];

      MACHINES.forEach((m, idx) => {
        const row = (aggResults[idx].data && aggResults[idx].data[0]) || {};
        const stroke = Number(row.stroke) || 0;
        const ng = Number(row.ng) || 0;
        const ngValue = Number(row.ng_value) || 0;
        const downtimeMenit = Math.round(Number(row.downtime_menit) || 0);
        const dandoriMenit = Math.round(Number(row.dandori_menit) || 0);
        const whJam = (Number(row.wh_menit) || 0) / 60;
        const targetStdMenit = Number(row.target_std_menit) || 0;

        const settings = settingsMap[m.key];
        const explicitTargetSet = !!settings && (
          settings.fixed > 0 || (settings.mode === "per_part" && targetStdMenit > 0)
        );
        let targetGsph = 0;
        if (explicitTargetSet) {
          if (settings?.mode === "per_part" && targetStdMenit > 0) {
            targetGsph = stroke / (targetStdMenit / 60);
          } else {
            targetGsph = settings!.fixed;
          }
        }

        const gsph = whJam > 0 ? stroke / whJam : 0;
        const availability = whJam > 0 ? Math.max(0, (whJam * 60 - downtimeMenit) / (whJam * 60)) * 100 : 0;
        const performanceFactor = targetGsph > 0 ? Math.min(100, (gsph / targetGsph) * 100) : 0;
        const quality = stroke > 0 ? Math.max(0, ((stroke - ng) / stroke) * 100) : 100;
        const oee = (availability / 100) * (performanceFactor / 100) * (quality / 100) * 100;

        perMachineMap[m.key] = {
          stroke, ok: stroke - ng, ng, downtime: downtimeMenit,
          gsph, targetGsph,
          performanceFactor, availability,
          quality, oee,
          targetAvailability: settings?.targetAvailability || 0,
          status: (stroke > 0 || downtimeMenit > 0) ? "RUNNING" : "OFFLINE",
        };

        if (stroke > 0) {
          lineAktifCount += 1;
          if (!explicitTargetSet) tanpaTargetLabels.push(m.label);
        }

        totalStroke += stroke; totalNG += ng; totalNgValue += ngValue;
        totalDowntime += downtimeMenit; totalDandori += dandoriMenit;
        totalWhJam += whJam;
        if (targetGsph > 0) { targetGsphSum += targetGsph; targetGsphCount += 1; }

        dtByCat[m.key] = {};
        (byCatResults[idx].data || []).forEach((r: any) => {
          const kat = (r.kategori || "OTHER").toUpperCase();
          dtByCat[m.key][kat] = Math.round(Number(r.total_menit) || 0);
        });
      });

      const avgTargetGsph = targetGsphCount > 0 ? targetGsphSum / targetGsphCount : 0;
      const totalAvailability = totalWhJam > 0 ? Math.max(0, (totalWhJam * 60 - totalDowntime) / (totalWhJam * 60)) * 100 : 0;
      const totalGsph = totalWhJam > 0 ? totalStroke / totalWhJam : 0;
      const totalPerf = avgTargetGsph > 0 ? Math.min(100, (totalGsph / avgTargetGsph) * 100) : 0;
      const totalQuality = totalStroke > 0 ? Math.max(0, ((totalStroke - totalNG) / totalStroke) * 100) : 100;
      const totalOee = (totalAvailability / 100) * (totalPerf / 100) * (totalQuality / 100) * 100;

      const totalsResult = {
        gsph: totalGsph, targetGsph: avgTargetGsph,
        performanceFactor: totalPerf, okQty: totalStroke - totalNG, ng: totalNG,
        targetQty: totalStroke, availability: totalAvailability,
        downtimeMenit: totalDowntime, stroke: totalStroke, dandoriMenit: totalDandori,
        oee: totalOee, ngValueRp: totalNgValue,
      };

      setLineAktif(lineAktifCount);
      setMachinesTanpaTarget(tanpaTargetLabels);

      try {
        const achResults = await Promise.all(MACHINES.map((m) =>
          supabase.rpc("prod_achievement_aggregate", { p_mesin: m.key, p_start: rangeStartIso, p_end: rangeEndIso })
        ));
        const achTotal = achResults.reduce((acc, r) => {
          const row = (r.data && r.data[0]) || {};
          return {
            rencana: acc.rencana + (Number(row.qty_rencana) || 0),
            aktual: acc.aktual + (Number(row.qty_aktual) || 0),
          };
        }, { rencana: 0, aktual: 0 });
        setAchievementPct(achTotal.rencana > 0 ? (achTotal.aktual / achTotal.rencana) * 100 : 0);
      } catch {
        setAchievementPct(0);
      }

      const fleetTop10Result = MACHINES.flatMap((m, idx) =>
        (topProbResults[idx].data || []).map((r: any) => ({
          mesin: m.key, mesinLabel: m.label,
          kategori: r.kategori || "MESIN", problem: r.problem || "-",
          menit: Math.round(Number(r.total_menit) || 0),
        }))
      ).sort((a, b) => b.menit - a.menit).slice(0, 10);

      const probAgg: Record<string, number> = {};
      MACHINES.forEach((m, idx) => {
        (topProbResults[idx].data || []).forEach((r: any) => {
          const key = r.problem || "(tanpa keterangan)";
          probAgg[key] = (probAgg[key] || 0) + Math.round(Number(r.total_menit) || 0);
        });
      });
      const totalProbMenit = Object.values(probAgg).reduce((a, b) => a + b, 0);
      const paretoResult = Object.entries(probAgg)
        .map(([problem, menit]) => ({ problem, menit, pct: totalProbMenit > 0 ? (menit / totalProbMenit) * 100 : 0 }))
        .sort((a, b) => b.menit - a.menit)
        .slice(0, 6);
      const maxParetoMenit = Math.max(1, ...paretoResult.map((r) => r.menit));
      paretoResult.forEach((r: any) => { r.barPct = (r.menit / maxParetoMenit) * 100; });

      const worstPerMachineResult: Record<string, { kategori: string; problem: string; menit: number }[]> = {};
      MACHINES.forEach((m, idx) => {
        worstPerMachineResult[m.key] = (topProbResults[idx].data || [])
          .slice(0, 5)
          .map((r: any) => ({
            kategori: r.kategori || "MESIN",
            problem: r.problem || "-",
            menit: Math.round(Number(r.total_menit) || 0),
          }));
      });

      /* Safety */
      let accidentCount = 0, daysWithoutAccident = 0;
      try {
        const safetyRpc = await supabase.rpc("prod_safety_summary", { p_start: startDate, p_end: endDate });
        if (!safetyRpc.error && safetyRpc.data && safetyRpc.data[0]) {
          const row = safetyRpc.data[0];
          accidentCount = Number(row.accident_count) || 0;
          daysWithoutAccident = Number(row.hari_tanpa_accident) || 0;
        } else {
          const sr = await supabase.from("prod_safety_log").select("*").gte("tanggal", startDate).lte("tanggal", endDate);
          if (sr.data && sr.data.length > 0) {
            accidentCount = sr.data.filter((s: any) => s.kategori === "ACCIDENT").length;
            const totalDays = periodMode === "harian" ? 1
              : Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1;
            daysWithoutAccident = accidentCount === 0 ? totalDays : 0;
          }
        }
      } catch { /* defaults */ }
      const safetyResult = { accident: accidentCount, hariTanpaAccident: daysWithoutAccident };

      /* Scrap */
      let scrapValueRpResult = 0, scrapRasioResult = 0, scrapTargetRasioResult = 0;
      try {
        const scrapRpc = await supabase.rpc("prod_scrap_top_end_summary", { p_start: startDate, p_end: endDate });
        if (!scrapRpc.error && scrapRpc.data && scrapRpc.data[0]) {
          const row = scrapRpc.data[0];
          scrapValueRpResult = (Number(row.scrap_value_kidr) || 0) * 1000;
          scrapRasioResult = Number(row.rasio) || 0;
          scrapTargetRasioResult = Number(row.target_rasio) || 0;
        } else {
          const scrapYear = periodMode === "tahunan" ? tahunPilih : new Date(endDate).getFullYear();
          const scrapMonth = periodMode === "tahunan" ? new Date().getMonth() + 1 : new Date(endDate).getMonth() + 1;
          const sr = await supabase.from("prod_scrap_top_end").select("*").eq("tahun", scrapYear).eq("bulan", scrapMonth).maybeSingle();
          scrapValueRpResult = sr.data ? (sr.data.scrap_value_kidr || 0) * 1000 : 0;
        }
      } catch { /* defaults */ }

      /* Attendance */
      let attendanceResult: typeof attendance;
      let attendanceByShiftResult: typeof attendanceByShift;
      try {
        const attRpc = await supabase.rpc("prod_attendance_summary", { p_start: startDate, p_end: endDate });
        if (!attRpc.error && attRpc.data && attRpc.data[0]) {
          const row = attRpc.data[0];
          const totalSlot = Number(row.total_orang) || 0;
          const hadir = Number(row.hadir) || 0;
          const cuti = Number(row.cuti) || 0;
          const absen = Number(row.absen) || 0;
          const hari = Math.max(1, Number(row.jumlah_hari) || 1);
          const isRata = periodMode !== "harian";
          attendanceResult = {
            total_orang: isRata ? Math.round(totalSlot / hari) : totalSlot,
            hadir: isRata ? Math.round(hadir / hari) : hadir,
            cuti: isRata ? Math.round(cuti / hari) : cuti,
            absen: isRata ? Math.round(absen / hari) : absen,
            overtime_jam: isRata ? Number((Number(row.overtime_jam) || 0) / hari) : (Number(row.overtime_jam) || 0),
            pctExclCuti: totalSlot > 0 ? (hadir / totalSlot) * 100 : 0,
            pctExclCutiFromDenom: (totalSlot - cuti) > 0 ? (hadir / (totalSlot - cuti)) * 100 : 0,
            totalHadir: hadir,
            totalCuti: cuti,
            totalAbsen: absen,
            totalOvertimeJam: Number(row.overtime_jam) || 0,
          };
          attendanceByShiftResult = periodMode === "harian"
            ? await fetchAttendanceByShift(startDate, endDate)
            : undefined;
        } else {
          throw new Error("RPC not available");
        }
      } catch {
        let attList: any[] = [];
        try {
          let aq = supabase.from("prod_attendance_log").select("*").gte("tanggal", startDate).lte("tanggal", endDate);
          if (shiftFilter !== "all") aq = aq.eq("shift", shiftFilter);
          const ar = await aq;
          if (ar.data) attList = ar.data;
        } catch { attList = []; }

        if (attList.length > 0) {
          const totOrang = attList.reduce((s: number, a: any) => s + (a.total_orang || 0), 0);
          const totHadir = attList.reduce((s: number, a: any) => s + (a.hadir || 0), 0);
          const totCuti = attList.reduce((s: number, a: any) => s + (a.cuti || 0), 0);
          const totAbsen = attList.reduce((s: number, a: any) => s + (a.absen || 0), 0);
          const totOT = attList.reduce((s: number, a: any) => s + (a.overtime_jam || 0), 0);
          const pctInclCuti = totOrang > 0 ? Math.min(100, Math.round((totHadir / totOrang) * 1000) / 10) : 0;
          const pctExclDenom = (totOrang - totCuti) > 0 ? Math.min(100, Math.round((totHadir / (totOrang - totCuti)) * 1000) / 10) : 0;
          const n = attList.length;
          attendanceResult = {
            pctExclCuti: pctInclCuti,
            pctExclCutiFromDenom: pctExclDenom,
            total_orang: periodMode === "harian" ? totOrang : Math.round(totOrang / n),
            hadir: periodMode === "harian" ? totHadir : Math.round(totHadir / n),
            cuti: periodMode === "harian" ? totCuti : Math.round(totCuti / n),
            absen: periodMode === "harian" ? totAbsen : Math.round(totAbsen / n),
            overtime_jam: periodMode === "harian" ? totOT : Math.round(totOT / n * 10) / 10,
            totalHadir: totHadir, totalCuti: totCuti, totalAbsen: totAbsen, totalOvertimeJam: totOT,
          };
        } else {
          attendanceResult = {
            pctExclCuti: 0, pctExclCutiFromDenom: 0, total_orang: 0, hadir: 0, cuti: 0, absen: 0, overtime_jam: 0,
            totalHadir: 0, totalCuti: 0, totalAbsen: 0, totalOvertimeJam: 0
          };
        }
        attendanceByShiftResult = undefined;
      }

      let hourlyResult: Record<string, { jam: number; gsph: number }[]> = {};
      if (periodMode === "harian") {
        try {
          const hourlyRes = await Promise.all(MACHINES.map((m) =>
            supabase.rpc("prod_gsph_hourly", { p_mesin: m.key, p_start: rangeStartIso, p_end: rangeEndIso })
          ));
          MACHINES.forEach((m, idx) => {
            const rows = (hourlyRes[idx].data || []) as any[];
            hourlyResult[m.key] = rows.map((r) => ({ jam: Number(r.jam), gsph: Number(r.gsph) || 0 }));
          });
        } catch { /* RPC fallback */ }
      }

      if (isCancelled()) return;

      if (profileResult) setProfile(profileResult);
      setSafety(safetyResult);
      setScrapValueRp(scrapValueRpResult);
      setScrapRasio(scrapRasioResult);
      setScrapTargetRasio(scrapTargetRasioResult);
      setAttendance(attendanceResult);
      setAttendanceByShift(attendanceByShiftResult);
      setHourlyData(hourlyResult);
      setParetoDowntime(paretoResult);
      setFleetTop10(fleetTop10Result);
      setWorstPerMachine(worstPerMachineResult);
      setDtByCategoryMap(dtByCat);
      setTotals((prev) => ({ ...totalsResult, peff: prev.peff, productivity: prev.productivity, gapMenit: prev.gapMenit }));
      setMachineDataMap(perMachineMap);
    } catch (err: any) {
      console.error("Dashboard error:", err?.message || err);
    } finally {
      if (!isCancelled()) setLoading(false);
    }
  }, [periodMode, tanggal, bulanPilih, tahunPilih, shiftFilter, bounds, fetchAttendanceByShift, supabase]);

  useEffect(() => {
    let cancelled = false;
    fetchDashboardData(() => cancelled);
    return () => { cancelled = true; };
  }, [fetchDashboardData]);

  useEffect(() => {
    if (loading) return;
    fetchLineTrend();
    fetchMiniTrend();
    fetchProductivityTrend();
    fetchProductivityToday();
  }, [loading, fetchLineTrend, fetchMiniTrend, fetchProductivityTrend, fetchProductivityToday]);

  const ngRatePct = totals.stroke > 0 ? (totals.ng / totals.stroke) * 100 : 0;

  /* ── Charts ──────────────────────────────────────────── */
  useEffect(() => {
    if (loading) return;

    registerInternalVizPlugins();

    const lineColors = ["#3b82f6", "#38bdf8", "#818cf8", "#2dd4bf", "#94a3b8"];
    const getCssVar = (v: string) => {
      try { return getComputedStyle(document.documentElement).getPropertyValue(v).trim() || ""; }
      catch { return ""; }
    };

    /* ── Trend GSPH ─────────────────────────────────────── */
    if (hourlyCanvasRef.current) {
      if (chartInstances.current.hourly) chartInstances.current.hourly.destroy();

      let labels: string[], datasets: any[];

      if (periodMode === "harian") {
        const jamSet = new Set<number>();
        MACHINES.forEach((m) => (hourlyData[m.key] || []).forEach((h) => jamSet.add(h.jam)));
        const jamList = Array.from(jamSet).sort((a, b) => a - b);

        if (jamList.length === 0) {
          for (let h = 7; h <= 18; h++) jamList.push(h);
        }
        labels = jamList.map((j) => String(j).padStart(2, "0") + ":00");
        datasets = MACHINES.map((m, idx) => {
          const hMap: Record<number, number> = {};
          (hourlyData[m.key] || []).forEach((h) => { hMap[h.jam] = h.gsph; });
          return {
            type: "line", label: m.label,
            data: jamList.map((j) => (hMap[j] !== undefined ? Number(hMap[j].toFixed(1)) : null)),
            borderColor: lineColors[idx % lineColors.length], backgroundColor: "transparent",
            tension: 0.4, pointRadius: 0, pointHoverRadius: 4, spanGaps: true, borderWidth: 2.5,
          };
        });
      } else {
        const lt = lineTrend || { labels: [], perLine: [] };
        labels = lt.labels;
        datasets = (lt.perLine || []).map((pl, idx) => ({
          type: "line", label: pl.label, data: pl.values,
          borderColor: lineColors[idx % lineColors.length], backgroundColor: "transparent",
          tension: 0.4, pointRadius: 0, pointHoverRadius: 4, spanGaps: true, borderWidth: 2.5,
        }));
      }

      destroyChartOnCanvas(hourlyCanvasRef.current);
      chartInstances.current.hourly = new Chart(hourlyCanvasRef.current, {
        data: { labels, datasets },
        options: {
          responsive: true, maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          layout: { padding: { top: 4, right: 6, bottom: 0, left: 0 } },
          plugins: {
            legend: {
              display: true, position: "top", align: "end",
              labels: { color: getCssVar("--muted") || "#94a3b8", boxWidth: 6, boxHeight: 6, usePointStyle: true, pointStyle: "circle", font: { size: 9 }, padding: 6 },
            },
            tooltip: { backgroundColor: getCssVar("--panel") || "#1e293b", titleColor: getCssVar("--text") || "#f1f5f9", bodyColor: getCssVar("--text") || "#f1f5f9", borderColor: getCssVar("--border") || "#334155", borderWidth: 1, padding: 8, displayColors: false },
          },
          scales: {
            x: { ticks: { color: getCssVar("--chart-tick") || "#64748b", font: { size: 9 }, maxRotation: 0, autoSkip: true }, grid: { display: false }, border: { display: false } },
            y: { ticks: { color: getCssVar("--chart-tick") || "#64748b", font: { size: 9 }, maxTicksLimit: 4 }, grid: { color: getCssVar("--chart-grid") || "#334155" }, border: { display: false }, beginAtZero: true },
          },
        },
      });
    }

    /* ── Downtime per Kategori × Line (Stacked Bar) ─────── */
    if (fleetCanvasRef.current) {
      if (chartInstances.current.fleet) chartInstances.current.fleet.destroy();
      const categories = ["MESIN", "DIES", "FINGER", "OTHER"];
      const catColors: Record<string, string> = { MESIN: getCssVar("--chart-2") || "#38bdf8", DIES: getCssVar("--chart-5") || "#fb7185", FINGER: getCssVar("--chart-1") || "#34d399", OTHER: getCssVar("--chart-4") || "#fbbf24" };
      destroyChartOnCanvas(fleetCanvasRef.current);
      chartInstances.current.fleet = new Chart(fleetCanvasRef.current, {
        type: "bar",
        data: {
          labels: MACHINES.map((m) => m.label),
          datasets: categories.map((cat) => ({
            label: cat,
            data: MACHINES.map((m) => (dtByCategoryMap[m.key]?.[cat] || 0)),
            backgroundColor: catColors[cat],
            borderRadius: 4,
          })),
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          layout: { padding: { top: 4, right: 6, bottom: 0, left: 0 } },
          onClick: (evt: any, elements: any[]) => {
            if (!elements.length) return;
            const el = elements[0];
            const m = MACHINES[el.index];
            const cat = categories[el.datasetIndex];
            if (m) openDowntimeDetail({ mesin: m.key, mesinLabel: m.label, kategori: cat });
          },
          onHover: (evt: any, elements: any[]) => {
            if (evt.native?.target) evt.native.target.style.cursor = elements.length ? "pointer" : "default";
          },
          plugins: {
            legend: { position: "top", align: "end", labels: { color: getCssVar("--muted") || "#94a3b8", boxWidth: 6, boxHeight: 6, usePointStyle: true, pointStyle: "circle", font: { size: 9 }, padding: 6 } },
            tooltip: { backgroundColor: getCssVar("--panel") || "#1e293b", titleColor: getCssVar("--text") || "#f1f5f9", bodyColor: getCssVar("--text") || "#f1f5f9", borderColor: getCssVar("--border") || "#334155", borderWidth: 1, padding: 8, displayColors: false },
            barValueLabels: { enabled: true, fmt: (v: any) => fmtNum(v), color: () => getCssVar("--text") || "#f1f5f9", minHeight: 14 },
          } as any,
          scales: {
            x: { stacked: true, ticks: { color: getCssVar("--chart-tick") || "#64748b", font: { size: 9 } }, grid: { display: false }, border: { display: false } },
            y: { stacked: true, ticks: { color: getCssVar("--chart-tick") || "#64748b", font: { size: 9 }, maxTicksLimit: 4 }, grid: { color: getCssVar("--chart-grid") || "#334155" }, border: { display: false }, beginAtZero: true },
          },
        },
      });
    }

    /* ── Downtime per Kategori (Pie/Doughnut) ───────────── */
    if (categoryPieRef.current) {
      if (chartInstances.current.categoryPie) chartInstances.current.categoryPie.destroy();
      const categories = ["MESIN", "DIES", "FINGER", "OTHER"];
      const catColors: Record<string, string> = { MESIN: getCssVar("--chart-2") || "#38bdf8", DIES: getCssVar("--chart-5") || "#fb7185", FINGER: getCssVar("--chart-1") || "#34d399", OTHER: getCssVar("--chart-4") || "#fbbf24" };
      const totalsPerCat = categories.map((cat) =>
        MACHINES.reduce((sum, m) => sum + (dtByCategoryMap[m.key]?.[cat] || 0), 0)
      );
      const grandTotal = totalsPerCat.reduce((a, b) => a + b, 0);
      destroyChartOnCanvas(categoryPieRef.current);
      chartInstances.current.categoryPie = new Chart(categoryPieRef.current, {
        type: "doughnut",
        data: {
          labels: categories,
          datasets: [{ data: totalsPerCat, backgroundColor: categories.map((c) => catColors[c]), borderWidth: 0 }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          layout: { padding: { top: 2, right: 4, bottom: 2, left: 4 } },
          onClick: (evt: any, elements: any[]) => {
            if (!elements.length) return;
            const cat = categories[elements[0].index];
            if (cat) openDowntimeDetail({ kategori: cat });
          },
          onHover: (evt: any, elements: any[]) => {
            if (evt.native?.target) evt.native.target.style.cursor = elements.length ? "pointer" : "default";
          },
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                color: getCssVar("--muted") || "#94a3b8",
                boxWidth: 6,
                boxHeight: 6,
                usePointStyle: true,
                pointStyle: "circle",
                font: { size: 9 },
                padding: 6,
                generateLabels: (chart: any) => {
                  const dataset = chart.data.datasets[0];
                  const total = (dataset.data as number[]).reduce((a: number, b: number) => a + b, 0);
                  const legendTextColor = getCssVar("--muted") || "#94a3b8";
                  return (chart.data.labels as string[]).map((label: string, i: number) => {
                    const val = (dataset.data as number[])[i] || 0;
                    const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                    return {
                      text: `${label} ${pct}%`,
                      fontColor: legendTextColor,
                      fillStyle: (dataset.backgroundColor as string[])[i],
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
              labelColor: () => getCssVar("--muted") || "#94a3b8",
            },
            sliceLabels: { enabled: true, color: () => getCssVar("--text") || "#f1f5f9" },
            tooltip: {
              backgroundColor: getCssVar("--panel") || "#1e293b",
              titleColor: getCssVar("--text") || "#f1f5f9",
              bodyColor: getCssVar("--text") || "#f1f5f9",
              borderColor: getCssVar("--border") || "#334155",
              borderWidth: 1,
              padding: 8,
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
          ...(({ cutout: "70%" } as any)),
        },
      });
    }

    /* ── Donuts OEE ─────────────────────────────────────── */
    const renderDonut = (canvas: HTMLCanvasElement | null, id: string, val: number, color: string, labelName: string = "") => {
      if (!canvas) return;
      if (chartInstances.current[id]) chartInstances.current[id].destroy();
      const v = Math.max(0, Math.min(100, val));
      destroyChartOnCanvas(canvas);
      chartInstances.current[id] = new Chart(canvas, {
        type: "doughnut",
        data: {
          labels: [labelName || "Capaian", "Sisa"],
          datasets: [{ data: [v, Math.max(0, 100 - v)], backgroundColor: [color, getCssVar("--panel-2") || "#1e293b"], borderWidth: 0 }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              enabled: true,
              backgroundColor: getCssVar("--panel") || "#1e293b",
              titleColor: getCssVar("--text") || "#f1f5f9",
              bodyColor: getCssVar("--text") || "#f1f5f9",
              borderColor: getCssVar("--border") || "#334155",
              borderWidth: 1,
              padding: 8,
              displayColors: false,
              callbacks: {
                title: () => "",
                label: (ctx: any) => {
                  if (ctx.dataIndex !== 0) return "";
                  return `${labelName || "Capaian"}: ${fmtNum(v)}%`;
                },
              },
            },
          },
          ...(({ cutout: "70%" } as any)),
        },
        plugins: [{
          id: "centerText",
          afterDatasetsDraw(chart: any) {
            const { ctx, chartArea } = chart;
            ctx.save();
            const size = Math.min(chartArea.right - chartArea.left, chartArea.bottom - chartArea.top);
            const fontSize = Math.max(10, Math.min(13, Math.round(size * 0.22)));
            ctx.font = `700 ${fontSize}px 'Space Grotesk', sans-serif`;
            ctx.fillStyle = getCssVar("--text") || "#f1f5f9";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(fmtNum(v) + "%", (chartArea.left + chartArea.right) / 2, (chartArea.top + chartArea.bottom) / 2);
            ctx.restore();
          },
        }],
      });
    };

    renderDonut(donutAvailRef.current, "donutAvail", totals.availability, getCssVar("--chart-2") || "#38bdf8", "Availability");
    renderDonut(donutPerfRef.current, "donutPerf", totals.performanceFactor, getCssVar("--chart-1") || "#34d399", "Performance");
    renderDonut(donutQualRef.current, "donutQual", totals.stroke > 0 ? Math.max(0, 100 - ngRatePct) : 100, getCssVar("--chart-3") || "#a78bfa", "Quality");

    return () => {
      try { chartInstances.current.hourly?.destroy(); } catch { }
      try { chartInstances.current.fleet?.destroy(); } catch { }
      try { chartInstances.current.categoryPie?.destroy(); } catch { }
      try { chartInstances.current.donutAvail?.destroy(); } catch { }
      try { chartInstances.current.donutPerf?.destroy(); } catch { }
      try { chartInstances.current.donutQual?.destroy(); } catch { }
    };
  }, [loading, vizMode, totals, ngRatePct, dtByCategoryMap, hourlyData, lineTrend, periodMode, theme, openDowntimeDetail]);

  /* ── Internal Viz: Productivity Trend & Cumulative Charts ── */
  useEffect(() => {
    if (loading || vizMode !== "internal") return;

    registerInternalVizPlugins();

    const getCssVar = (v: string) => {
      try { return getComputedStyle(document.documentElement).getPropertyValue(v).trim() || ""; }
      catch { return ""; }
    };

    if (internalProdTrendRef.current) {
      if (chartInstances.current.internalProdTrend) {
        chartInstances.current.internalProdTrend.destroy();
      }
      const pt = productivityTrend || { labels: [], values: [] };
      destroyChartOnCanvas(internalProdTrendRef.current);
      chartInstances.current.internalProdTrend = new Chart(internalProdTrendRef.current, {
        data: {
          labels: pt.labels,
          datasets: [
            {
              type: "line",
              label: "Productivity",
              data: pt.values,
              borderColor: getCssVar("--amber") || "#f59e0b",
              backgroundColor: getCssVar("--amber") || "#f59e0b",
              borderWidth: 2,
              tension: 0.25,
              pointRadius: 4,
              pointHoverRadius: 6,
              pointBackgroundColor: getCssVar("--amber") || "#f59e0b",
              pointBorderColor: getCssVar("--panel") || "#1e293b",
              pointBorderWidth: 1.5,
              spanGaps: true,
              order: 2,
            },
            {
              type: "line",
              label: "Target 100%",
              data: pt.labels.map(() => 100),
              borderColor: getCssVar("--red") || "#ef4444",
              borderWidth: 1.5,
              borderDash: [5, 4],
              pointRadius: 0,
              order: 1,
              skipLabel: true,
            } as any,
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { top: 28, right: 8 } },
          plugins: {
            legend: {
              position: "top",
              align: "end",
              labels: {
                color: getCssVar("--muted") || "#94a3b8",
                boxWidth: 8,
                boxHeight: 8,
                usePointStyle: true,
                font: { size: 10 },
                padding: 12,
              },
            },
            tooltip: {
              backgroundColor: getCssVar("--panel") || "#1e293b",
              titleColor: getCssVar("--text") || "#f1f5f9",
              bodyColor: getCssVar("--text") || "#f1f5f9",
              borderColor: getCssVar("--border") || "#334155",
              borderWidth: 1,
              padding: 10,
              callbacks: {
                label: (ctx: any) =>
                  ctx.dataset.label === "Productivity" ? `Productivity: ${fmtNum(ctx.parsed.y)}%` : null,
              },
            },
            barValueLabels: {
              enabled: true,
              fmt: (v: any) => fmtNum(v) + "%",
            },
          } as any,
          scales: {
            x: {
              ticks: { color: getCssVar("--chart-tick") || "#64748b", font: { size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 16 },
              grid: { display: false },
              border: { display: false },
            },
            y: {
              ticks: { color: getCssVar("--chart-tick") || "#64748b", font: { size: 10 }, maxTicksLimit: 5, callback: (v: any) => v + "%" },
              grid: { color: getCssVar("--chart-grid") || "#334155", drawTicks: false },
              border: { display: false },
              suggestedMax: (() => { const vals = (productivityTrend?.values || []).filter((v) => v !== null) as number[]; const mx = vals.length ? Math.max(...vals) : 100; return Math.ceil(mx * 1.15); })(),
            },
          },
        },
      });
    }

    if (internalProdCumRef.current) {
      if (chartInstances.current.internalProdCum) {
        chartInstances.current.internalProdCum.destroy();
      }
      const pt = productivityTrend || { labels: [], cumValues: [] };
      destroyChartOnCanvas(internalProdCumRef.current);
      chartInstances.current.internalProdCum = new Chart(internalProdCumRef.current, {
        data: {
          labels: pt.labels,
          datasets: [
            {
              type: "line",
              label: "Akumulasi",
              data: pt.cumValues,
              borderColor: getCssVar("--teal") || "#2dd4bf",
              backgroundColor: getCssVar("--teal") || "#2dd4bf",
              borderWidth: 2,
              tension: 0.25,
              pointRadius: 4,
              pointHoverRadius: 6,
              pointBackgroundColor: getCssVar("--teal") || "#2dd4bf",
              pointBorderColor: getCssVar("--panel") || "#1e293b",
              pointBorderWidth: 1.5,
              spanGaps: true,
              order: 2,
            },
            {
              type: "line",
              label: "Target 100%",
              data: pt.labels.map(() => 100),
              borderColor: getCssVar("--red") || "#ef4444",
              borderWidth: 1.5,
              borderDash: [5, 4],
              pointRadius: 0,
              order: 1,
              skipLabel: true,
            } as any,
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { top: 28, right: 8 } },
          plugins: {
            legend: {
              position: "top",
              align: "end",
              labels: {
                color: getCssVar("--muted") || "#94a3b8",
                boxWidth: 8,
                boxHeight: 8,
                usePointStyle: true,
                font: { size: 10 },
                padding: 12,
              },
            },
            tooltip: {
              backgroundColor: getCssVar("--panel") || "#1e293b",
              titleColor: getCssVar("--text") || "#f1f5f9",
              bodyColor: getCssVar("--text") || "#f1f5f9",
              borderColor: getCssVar("--border") || "#334155",
              borderWidth: 1,
              padding: 10,
              callbacks: {
                label: (ctx: any) =>
                  ctx.dataset.label === "Akumulasi" ? `Akumulasi: ${fmtNum(ctx.parsed.y)}%` : null,
              },
            },
            barValueLabels: {
              enabled: true,
              fmt: (v: any) => fmtNum(v) + "%",
            },
          } as any,
          scales: {
            x: {
              ticks: { color: getCssVar("--chart-tick") || "#64748b", font: { size: 9 }, maxRotation: 0, autoSkip: true, maxTicksLimit: 16 },
              grid: { display: false },
              border: { display: false },
            },
            y: {
              ticks: { color: getCssVar("--chart-tick") || "#64748b", font: { size: 10 }, maxTicksLimit: 5, callback: (v: any) => v + "%" },
              grid: { color: getCssVar("--chart-grid") || "#334155", drawTicks: false },
              border: { display: false },
              suggestedMax: (() => { const vals = (productivityTrend?.cumValues || []).filter((v) => v !== null) as number[]; const mx = vals.length ? Math.max(...vals) : 100; return Math.ceil(mx * 1.15); })(),
            },
          },
        },
      });
    }

    if (internalAvailRef.current) {
      if (chartInstances.current.internalAvailability) {
        chartInstances.current.internalAvailability.destroy();
      }
      const labels = MACHINES.map((m) => m.label);
      const actual = MACHINES.map((m) => Number((machineDataMap[m.key]?.availability || 0).toFixed(1)));
      const target = MACHINES.map((m) => machineDataMap[m.key]?.targetAvailability || null);
      destroyChartOnCanvas(internalAvailRef.current);
      chartInstances.current.internalAvailability = new Chart(internalAvailRef.current, {
        data: {
          labels,
          datasets: [
            {
              type: "bar",
              label: "Actual",
              data: actual,
              backgroundColor: getCssVar("--sky") || "#38bdf8",
              borderRadius: 4,
              borderSkipped: false,
              barPercentage: 0.5,
              categoryPercentage: 0.7,
              order: 2,
            },
            {
              type: "line",
              label: "Target",
              data: target,
              showLine: false,
              pointStyle: "rectRot",
              pointRadius: 7,
              pointBorderWidth: 0,
              backgroundColor: getCssVar("--muted") || "#94a3b8",
              order: 1,
              skipLabel: true,
            } as any,
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { top: 36, right: 8 } },
          plugins: {
            legend: {
              position: "top",
              align: "end",
              labels: {
                color: getCssVar("--muted") || "#94a3b8",
                boxWidth: 8,
                boxHeight: 8,
                usePointStyle: true,
                font: { size: 10 },
                padding: 12,
              },
            },
            tooltip: {
              backgroundColor: getCssVar("--panel") || "#1e293b",
              titleColor: getCssVar("--text") || "#f1f5f9",
              bodyColor: getCssVar("--text") || "#f1f5f9",
              borderColor: getCssVar("--border") || "#334155",
              borderWidth: 1,
              padding: 10,
              callbacks: {
                label: (ctx: any) => `${ctx.dataset.label}: ${fmtNum(ctx.parsed.y)}%`,
              },
            },
            varianceArrows: { enabled: true, fmt: (v: any) => fmtNum(v) + "%" },
            barValueLabels: { enabled: true, fmt: (v: any) => fmtNum(v) + "%" },
          } as any,
          scales: {
            x: {
              ticks: { color: getCssVar("--chart-tick") || "#64748b", font: { size: 10 } },
              grid: { display: false },
              border: { display: false },
            },
            y: {
              ticks: { color: getCssVar("--chart-tick") || "#64748b", font: { size: 10 }, maxTicksLimit: 5, callback: (v: any) => v + "%" },
              grid: { color: getCssVar("--chart-grid") || "#334155", drawTicks: false },
              border: { display: false },
              beginAtZero: true,
              suggestedMax: (() => { const mx = Math.max(...actual.filter(Boolean), ...target.filter(Boolean) as number[]); return mx > 0 ? Math.ceil(mx * 1.15) : 110; })(),
            },
          },
        },
      });
    }

    if (internalGsphRef.current) {
      if (chartInstances.current.internalGsph) {
        chartInstances.current.internalGsph.destroy();
      }
      const labels = MACHINES.map((m) => m.label);
      const actual = MACHINES.map((m) => Number((machineDataMap[m.key]?.gsph || 0).toFixed(0)));
      const target = MACHINES.map((m) => machineDataMap[m.key]?.targetGsph || null);
      destroyChartOnCanvas(internalGsphRef.current);
      chartInstances.current.internalGsph = new Chart(internalGsphRef.current, {
        data: {
          labels,
          datasets: [
            {
              type: "bar",
              label: "Actual",
              data: actual,
              backgroundColor: getCssVar("--teal") || "#2dd4bf",
              borderRadius: 4,
              borderSkipped: false,
              barPercentage: 0.5,
              categoryPercentage: 0.7,
              order: 2,
            },
            {
              type: "line",
              label: "Target",
              data: target,
              showLine: false,
              pointStyle: "rectRot",
              pointRadius: 7,
              pointBorderWidth: 0,
              backgroundColor: getCssVar("--muted") || "#94a3b8",
              order: 1,
              skipLabel: true,
            } as any,
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { top: 36, right: 8 } },
          plugins: {
            legend: {
              position: "top",
              align: "end",
              labels: {
                color: getCssVar("--muted") || "#94a3b8",
                boxWidth: 8,
                boxHeight: 8,
                usePointStyle: true,
                font: { size: 10 },
                padding: 12,
              },
            },
            tooltip: {
              backgroundColor: getCssVar("--panel") || "#1e293b",
              titleColor: getCssVar("--text") || "#f1f5f9",
              bodyColor: getCssVar("--text") || "#f1f5f9",
              borderColor: getCssVar("--border") || "#334155",
              borderWidth: 1,
              padding: 10,
              callbacks: {
                label: (ctx: any) => `${ctx.dataset.label}: ${fmtNum(ctx.parsed.y)}`,
              },
            },
            varianceArrows: { enabled: true, fmt: (v: any) => fmtNum(v) },
            barValueLabels: { enabled: true, fmt: (v: any) => fmtNum(v) },
          } as any,
          scales: {
            x: {
              ticks: { color: getCssVar("--chart-tick") || "#64748b", font: { size: 10 } },
              grid: { display: false },
              border: { display: false },
            },
            y: {
              ticks: { color: getCssVar("--chart-tick") || "#64748b", font: { size: 10 }, maxTicksLimit: 5 },
              grid: { color: getCssVar("--chart-grid") || "#334155", drawTicks: false },
              border: { display: false },
              beginAtZero: true,
              suggestedMax: (() => { const mx = Math.max(...actual.filter(Boolean), ...target.filter(Boolean) as number[]); return mx > 0 ? Math.ceil(mx * 1.15) : 10; })(),
            },
          },
        },
      });
    }

    if (internalDowntimeLineRef.current) {
      if (chartInstances.current.internalDowntimeLine) {
        chartInstances.current.internalDowntimeLine.destroy();
      }
      destroyChartOnCanvas(internalDowntimeLineRef.current);
      chartInstances.current.internalDowntimeLine = new Chart(internalDowntimeLineRef.current, {
        type: "bar",
        data: {
          labels: MACHINES.map((m) => m.label),
          datasets: [
            {
              label: "Downtime",
              data: MACHINES.map((m) => machineDataMap[m.key]?.downtime || 0),
              backgroundColor: getCssVar("--blue") || "#3b82f6",
              borderRadius: 4,
              borderSkipped: false,
              barPercentage: 0.6,
              categoryPercentage: 0.7,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { top: 28, right: 8 } },
          onClick: (evt: any, elements: any[]) => {
            if (!elements.length) return;
            const m = MACHINES[elements[0].index];
            if (m) openDowntimeDetail({ mesin: m.key, mesinLabel: m.label });
          },
          onHover: (evt: any, elements: any[]) => {
            if (evt.native?.target) evt.native.target.style.cursor = elements.length ? "pointer" : "default";
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: getCssVar("--panel") || "#1e293b",
              titleColor: getCssVar("--text") || "#f1f5f9",
              bodyColor: getCssVar("--text") || "#f1f5f9",
              borderColor: getCssVar("--border") || "#334155",
              borderWidth: 1,
              padding: 10,
              callbacks: { label: (ctx: any) => fmtNum(ctx.parsed.y) + " menit" },
            },
            barValueLabels: { enabled: true, fmt: (v: any) => fmtNum(v) },
          } as any,
          scales: {
            x: {
              ticks: { color: getCssVar("--chart-tick") || "#64748b", font: { size: 10 } },
              grid: { display: false },
              border: { display: false },
            },
            y: {
              ticks: { color: getCssVar("--chart-tick") || "#64748b", font: { size: 10 }, maxTicksLimit: 5 },
              grid: { color: getCssVar("--chart-grid") || "#334155", drawTicks: false },
              border: { display: false },
              beginAtZero: true,
              suggestedMax: (() => { const dtVals = MACHINES.map((m) => machineDataMap[m.key]?.downtime || 0); const mx = Math.max(...dtVals, 1); return Math.ceil(mx * 1.15); })(),
            },
          },
        },
      });
    }

    if (internalCategoryPieRef.current) {
      if (chartInstances.current.internalCategoryPie) {
        chartInstances.current.internalCategoryPie.destroy();
      }
      const categories = ["MESIN", "DIES", "FINGER", "OTHER"];
      const catColors: Record<string, string> = {
        MESIN: getCssVar("--chart-2") || "#38bdf8",
        DIES: getCssVar("--chart-5") || "#fb7185",
        FINGER: getCssVar("--chart-1") || "#34d399",
        OTHER: getCssVar("--chart-4") || "#fbbf24",
      };
      const totalsPerCat = categories.map((cat) =>
        MACHINES.reduce((sum, m) => sum + (dtByCategoryMap[m.key]?.[cat] || 0), 0)
      );
      const grandTotal = totalsPerCat.reduce((a, b) => a + b, 0);
      destroyChartOnCanvas(internalCategoryPieRef.current);
      chartInstances.current.internalCategoryPie = new Chart(internalCategoryPieRef.current, {
        type: "doughnut",
        data: {
          labels: categories,
          datasets: [{ data: totalsPerCat, backgroundColor: categories.map((c) => catColors[c]), borderWidth: 0 }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          onClick: (evt: any, elements: any[]) => {
            if (!elements.length) return;
            const cat = categories[elements[0].index];
            if (cat) openDowntimeDetail({ kategori: cat });
          },
          onHover: (evt: any, elements: any[]) => {
            if (evt.native?.target) evt.native.target.style.cursor = elements.length ? "pointer" : "default";
          },
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                color: getCssVar("--muted") || "#94a3b8",
                boxWidth: 8,
                boxHeight: 8,
                usePointStyle: true,
                pointStyle: "circle",
                font: { size: 10 },
                padding: 10,
                generateLabels: (chart: any) => {
                  const dataset = chart.data.datasets[0];
                  const total = (dataset.data as number[]).reduce((a: number, b: number) => a + b, 0);
                  const legendTextColor = getCssVar("--muted") || "#94a3b8";
                  return (chart.data.labels as string[]).map((label: string, i: number) => {
                    const val = (dataset.data as number[])[i] || 0;
                    const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                    return {
                      text: `${label}  ${pct}%`,
                      fontColor: legendTextColor,
                      fillStyle: (dataset.backgroundColor as string[])[i],
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
              label: "Menit Downtime",
              color: () => getCssVar("--text") || "#f1f5f9",
              labelColor: () => getCssVar("--muted") || "#94a3b8",
            },
            sliceLabels: { enabled: true, color: () => getCssVar("--text") || "#f1f5f9" },
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
          ...(({ cutout: "72%" } as any)),
        },
      });
    }

    if (internalCategoryLineRef.current) {
      if (chartInstances.current.internalCategoryLine) {
        chartInstances.current.internalCategoryLine.destroy();
      }
      const categories = ["MESIN", "DIES", "FINGER", "OTHER"];
      const catColors: Record<string, string> = {
        MESIN: getCssVar("--chart-2") || "#38bdf8",
        DIES: getCssVar("--chart-5") || "#fb7185",
        FINGER: getCssVar("--chart-1") || "#34d399",
        OTHER: getCssVar("--chart-4") || "#fbbf24",
      };
      destroyChartOnCanvas(internalCategoryLineRef.current);
      chartInstances.current.internalCategoryLine = new Chart(internalCategoryLineRef.current, {
        type: "bar",
        data: {
          labels: MACHINES.map((m) => m.label),
          datasets: categories.map((cat) => ({
            label: cat,
            data: MACHINES.map((m) => dtByCategoryMap[m.key]?.[cat] || 0),
            backgroundColor: catColors[cat],
            borderRadius: 4,
            borderSkipped: false,
            barPercentage: 0.6,
            categoryPercentage: 0.7,
          })),
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { top: 24, right: 8 } },
          onClick: (evt: any, elements: any[]) => {
            if (!elements.length) return;
            const el = elements[0];
            const m = MACHINES[el.index];
            const cat = categories[el.datasetIndex];
            if (m) openDowntimeDetail({ mesin: m.key, mesinLabel: m.label, kategori: cat });
          },
          onHover: (evt: any, elements: any[]) => {
            if (evt.native?.target) evt.native.target.style.cursor = elements.length ? "pointer" : "default";
          },
          plugins: {
            legend: {
              position: "top",
              align: "end",
              labels: {
                color: getCssVar("--muted") || "#94a3b8",
                boxWidth: 8,
                boxHeight: 8,
                usePointStyle: true,
                font: { size: 10 },
                padding: 12,
              },
            },
            tooltip: {
              backgroundColor: getCssVar("--panel") || "#1e293b",
              titleColor: getCssVar("--text") || "#f1f5f9",
              bodyColor: getCssVar("--text") || "#f1f5f9",
              borderColor: getCssVar("--border") || "#334155",
              borderWidth: 1,
              padding: 10,
            },
            barValueLabels: { enabled: true, fmt: (v: any) => fmtNum(v), color: () => getCssVar("--text") || "#f1f5f9" },
          } as any,
          scales: {
            x: {
              stacked: true,
              ticks: { color: getCssVar("--chart-tick") || "#64748b", font: { size: 10 } },
              grid: { display: false },
              border: { display: false },
            },
            y: {
              stacked: true,
              ticks: { color: getCssVar("--chart-tick") || "#64748b", font: { size: 10 }, maxTicksLimit: 5 },
              grid: { color: getCssVar("--chart-grid") || "#334155", drawTicks: false },
              border: { display: false },
              beginAtZero: true,
            },
          },
        },
      });
    }

    return () => {
      try { chartInstances.current.internalProdTrend?.destroy(); } catch { }
      try { chartInstances.current.internalProdCum?.destroy(); } catch { }
      try { chartInstances.current.internalAvailability?.destroy(); } catch { }
      try { chartInstances.current.internalGsph?.destroy(); } catch { }
      try { chartInstances.current.internalDowntimeLine?.destroy(); } catch { }
      try { chartInstances.current.internalCategoryPie?.destroy(); } catch { }
      try { chartInstances.current.internalCategoryLine?.destroy(); } catch { }
    };
  }, [loading, vizMode, productivityTrend, totals, machineDataMap, dtByCategoryMap, openDowntimeDetail, theme]);

  const fmtNum = (n: number | null | undefined) => {
    if (n === null || n === undefined || isNaN(Number(n))) return "0";
    return Number(n).toLocaleString("en-US", { maximumFractionDigits: 1 });
  };

  const oeeKesimpulan = (): string => {
    const a = totals.availability;
    const p = totals.performanceFactor;
    const q = totals.stroke > 0 ? Math.max(0, 100 - ngRatePct) : 100;
    const oee = totals.oee;
    if (oee === 0 && a === 0 && p === 0) return "Belum ada data produksi pada periode ini.";
    const faktor = [
      { nama: "Availability", val: a, saran: "kurangi downtime & dandori" },
      { nama: "Performance", val: p, saran: "kejar GSPH mendekati target" },
      { nama: "Quality", val: q, saran: "tekan angka NG" },
    ];
    const terlemah = faktor.reduce((acc, cur) => (cur.val < acc.val ? cur : acc));
    const level = oee >= 75 ? "baik" : oee >= 50 ? "cukup" : "perlu perhatian";
    let s = `OEE ${fmtNum(oee)}% (${level}). `;
    if (terlemah.val >= 95) s += "Ketiga faktor sudah tinggi dan seimbang.";
    else s += `Faktor terlemah: ${terlemah.nama} ${fmtNum(terlemah.val)}% — ${terlemah.saran}.`;
    return s;
  };

  const statusClass = (d: any) => d.status === "OFFLINE" ? "status-idle" : d.oee >= 75 ? "status-running" : d.oee >= 50 ? "status-warn" : "status-stop";
  const statusLabel = (d: any) => d.status === "OFFLINE" ? "OFF" : d.oee >= 75 ? "GOOD" : d.oee >= 50 ? "FAIR" : "POOR";

  return (
    <div className="app-shell app-shell-dashboard flex flex-col min-h-screen">
      {/* Main Content Area */}
      <main className="main main-dashboard">
        {/* Topbar ──────────────────────────────────────────── */}
        <div className="dash-topbar">
          <div className="dash-title-block flex items-center gap-3">
            <Link
              href="/admin"
              className="chip flex items-center gap-1.5 text-xs font-semibold py-1.5 px-3 rounded-lg border border-border hover:bg-accent hover:text-accent-foreground transition cursor-pointer"
              title="Kembali ke Home (Admin Workspace)"
            >
              <Home size={15} />
              <span>Home</span>
            </Link>
            <div>
              <h1>STAMPING PRODUCTION PERFORMANCE</h1>
              <p>Monitoring &amp; Management Control</p>
            </div>
          </div>
          <div className="dash-controls">
            <div className="perf-toggle-row" style={{ margin: 0 }}>
              <button type="button" className={`chip ${periodMode === "harian" ? "chip-active" : ""}`} onClick={() => setPeriodMode("harian")}>Harian</button>
              <button type="button" className={`chip ${periodMode === "bulanan" ? "chip-active" : ""}`} onClick={() => setPeriodMode("bulanan")}>Bulanan</button>
              <button type="button" className={`chip ${periodMode === "tahunan" ? "chip-active" : ""}`} onClick={() => setPeriodMode("tahunan")}>Tahunan</button>
            </div>

            {periodMode === "harian" && (
              <>
                <Input type="date" className="h-9 w-auto text-xs" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
                <select value={shiftFilter} onChange={(e) => setShiftFilter(e.target.value)}>
                  <option value="all">Semua Shift</option>
                  <option value="1">Shift 1 (07:00–19:30)</option>
                  <option value="2">Shift 2 (19:30–07:00)</option>
                </select>
              </>
            )}
            {periodMode === "bulanan" && (
              <select value={bulanPilih} onChange={(e) => setBulanPilih(Number(e.target.value))}>
                {["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"].map((m, i) => (
                  <option key={m} value={i}>{m}</option>
                ))}
              </select>
            )}
            {(periodMode === "bulanan" || periodMode === "tahunan") && (
              <Input type="number" min="2000" max="2100" className="h-9 w-20 text-xs" value={tahunPilih} onChange={(e) => setTahunPilih(Number(e.target.value))} />
            )}

            <button
              className="theme-toggle"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit Fullscreen (F11)" : "Fullscreen (F11)"}
            >
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>

            <button className="theme-toggle" onClick={toggleTheme} title={theme === "dark" ? "Light mode" : "Dark mode"}>
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>

        <div className="viz-mode-toggle">
          <button
            type="button"
            className={`viz-mode-btn ${vizMode === "umum" ? "viz-mode-active" : ""}`}
            onClick={() => setVizMode("umum")}
          >
            Visualisasi Umum
          </button>
          <button
            type="button"
            className={`viz-mode-btn ${vizMode === "internal" ? "viz-mode-active" : ""}`}
            onClick={() => setVizMode("internal")}
          >
            Visualisasi Internal
          </button>
        </div>

        {loading ? (
          <p className="empty-state">Memuat data...</p>
        ) : (
          <div className="dash-body">
            {machinesTanpaTarget.length > 0 && (
              <div className="error-msg" style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
                <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                <span><b>Target GSPH belum diisi</b> untuk: {machinesTanpaTarget.join(", ")}.
                  Akibatnya <b>Performance &amp; OEE tampil 0%</b>. Isi dulu di halaman mesin
                  → tab <b>Master Data</b> → panel <b>Target GSPH &amp; Availability</b> (khusus admin/leader).</span>
              </div>
            )}

            {/* ═══ SQCPM 5-column strip — cuma di Visualisasi Umum ═══ */}
            {vizMode === "umum" && (
              <SQCDMPPanel
                safety={safety}
                ngRatePct={ngRatePct}
                totalNG={totals.ng}
                oee={totals.oee}
                performanceFactor={totals.performanceFactor}
                gsph={totals.gsph}
                targetGsph={totals.targetGsph}
                ngValueRp={totals.ngValueRp}
                scrapValueRp={scrapValueRp}
                scrapRasio={scrapRasio}
                scrapTargetRasio={scrapTargetRasio}
                attendance={attendance}
                attendanceByShift={attendanceByShift}
                periodMode={periodMode}
                miniTrend={miniTrend}
              />
            )}

            {vizMode === "internal" ? (
              /* ═══ Visualisasi Internal ═══ */
              <div className="internal-viz">
                <div className="dash-main-grid internal-row-productivity">
                  <Card className="dash-panel card-glow-info">
                    <p className="dash-panel-title">Productivity — Capaian Hari Ini</p>
                    <p className="hint" style={{ margin: "-4px 0 10px" }}>
                      Productivity = PEFF ÷ Kijun PEFF <b>{fmtNum(KIJUN_PEFF * 100)}%</b> · PEFF = Earned Hours ÷ Working Hours
                    </p>
                    <div className="productivity-today">
                      {productivityToday ? (
                        <div>
                          <div className="productivity-today-main">
                            <div className="productivity-today-value">{fmtNum(productivityToday.productivity)}%</div>
                            <span
                              className={`badge ${productivityToday.sumber === "historis" ? "badge-historis" : "badge-live"}`}
                            >
                              {productivityToday.sumber === "historis" ? "EH manual" : "EH otomatis"}
                            </span>
                          </div>
                          <div className="productivity-today-grid">
                            <div className="productivity-today-stat">
                              <span className="productivity-today-label">Earned Hours</span>
                              <span className="productivity-today-num">{fmtNum(productivityToday.ehJam)} jam</span>
                            </div>
                            <div className="productivity-today-stat">
                              <span className="productivity-today-label">Working Hours</span>
                              <span className="productivity-today-num">{fmtNum(productivityToday.whJam)} jam</span>
                            </div>
                            <div className="productivity-today-stat">
                              <span className="productivity-today-label">Total Man Hours</span>
                              <span className="productivity-today-num">{fmtNum(productivityToday.totalManHoursJam)} jam</span>
                            </div>
                            <div className="productivity-today-stat">
                              <span className="productivity-today-label">GAP</span>
                              <span className="productivity-today-num">{fmtNum(productivityToday.gapJam)} jam</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="empty-state">Belum ada data hari ini.</p>
                      )}
                    </div>
                  </Card>

                  <Card className="dash-panel card-glow-info">
                    <p className="dash-panel-title">Productivity — Per Tanggal</p>
                    <p className="hint" style={{ margin: "-4px 0 10px" }}>
                      Angka masing-masing tanggal, dihitung sendiri-sendiri (tidak digabung).
                    </p>
                    <div className="dash-chart-sm">
                      <canvas ref={internalProdTrendRef} />
                    </div>
                  </Card>

                  <Card className="dash-panel card-glow-info">
                    <p className="dash-panel-title">Productivity — Akumulasi</p>
                    <p className="hint" style={{ margin: "-4px 0 10px" }}>
                      Total periode ini: <b>{fmtNum(totals.productivity)}%</b> (PEFF <b>{fmtNum(totals.peff * 100)}%</b>) · EH &amp; WH dijumlah berjalan sejak awal periode, baru dibagi.
                    </p>
                    <div className="dash-chart-sm">
                      <canvas ref={internalProdCumRef} />
                    </div>
                  </Card>
                </div>
                <div className="dash-main-grid internal-row-1">
                  <Card className="dash-panel card-glow-info">
                    <p className="dash-panel-title">Availability per Line — Target vs Actual</p>
                    <div className="dash-chart-sm">
                      <canvas ref={internalAvailRef} />
                    </div>
                  </Card>
                  <Card className="dash-panel card-glow-info">
                    <p className="dash-panel-title">GSPH per Line — Target vs Actual</p>
                    <div className="dash-chart-sm">
                      <canvas ref={internalGsphRef} />
                    </div>
                  </Card>
                </div>
                <div className="dash-main-grid internal-row-3">
                  <Card className="dash-panel card-glow-info">
                    <p className="dash-panel-title">Downtime per Line</p>
                    <div className="dash-chart-sm">
                      <canvas ref={internalDowntimeLineRef} />
                    </div>
                  </Card>
                  <Card className="dash-panel card-glow-info">
                    <p className="dash-panel-title">Downtime per Kategori</p>
                    <div className="dash-chart-sm">
                      <canvas ref={internalCategoryPieRef} />
                    </div>
                  </Card>
                  <Card className="dash-panel card-glow-info">
                    <p className="dash-panel-title">Downtime per Kategori × Line</p>
                    <div className="dash-chart-sm">
                      <canvas ref={internalCategoryLineRef} />
                    </div>
                  </Card>
                </div>
                <div className="internal-row-worst">
                  {MACHINES.map((m) => {
                    const rows = worstPerMachine[m.key] || [];
                    return (
                      <Card key={m.key} className="dash-panel card-glow-info">
                        <p className="dash-panel-title">5 Downtime Terburuk — {m.shortLabel}</p>
                        {rows.length === 0 ? (
                          <p className="empty-state" style={{ padding: "20px 0" }}>Tidak ada downtime.</p>
                        ) : (
                          <div className="table-wrap">
                            <table className="table-compact">
                              <thead>
                                <tr>
                                  <th>Kategori</th>
                                  <th>Problem</th>
                                  <th style={{ textAlign: "right" }}>Menit</th>
                                </tr>
                              </thead>
                              <tbody>
                                {rows.map((r, i) => (
                                  <tr key={i}>
                                    <td title={r.kategori}>
                                      <span className={`badge`}>
                                        {r.kategori}
                                      </span>
                                    </td>
                                    <td style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                      {r.problem}
                                    </td>
                                    <td style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                      {r.menit}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* ═══ TV Grid ═══ */
              <div className="tv-grid">

                {/* Row 1: Trend GSPH | OEE Breakdown | Line Status */}
                <div className="dash-main-grid tv-row-1">

                  {/* Trend GSPH */}
                  <Card className="dash-panel dash-panel-fit card-glow-info">
                    <p className="dash-panel-title">
                      TREND GSPH PER {periodMode === "harian" ? "JAM" : periodMode === "bulanan" ? "HARI" : "BULAN"}
                    </p>
                    <div className="dash-chart-sm">
                      <canvas ref={hourlyCanvasRef} />
                    </div>
                  </Card>

                  {/* OEE Breakdown */}
                  <Card className="dash-panel dash-panel-fit card-glow-info">
                    <p className="dash-panel-title">OEE BREAKDOWN</p>
                    <div className="oee-donut-row oee-donut-row-3">
                      <div className="oee-donut-item">
                        <div className="oee-donut-wrap"><canvas ref={donutAvailRef} /></div>
                        <div className="oee-donut-label">Availability</div>
                      </div>
                      <div className="oee-donut-item">
                        <div className="oee-donut-wrap"><canvas ref={donutPerfRef} /></div>
                        <div className="oee-donut-label">Performance</div>
                      </div>
                      <div className="oee-donut-item">
                        <div className="oee-donut-wrap"><canvas ref={donutQualRef} /></div>
                        <div className="oee-donut-label">Quality</div>
                      </div>
                    </div>
                    <div className="oee-total-big">
                      <span className="oee-total-big-value">{fmtNum(totals.oee)}%</span>
                      <span className="oee-total-big-label">OEE Keseluruhan</span>
                    </div>
                    <p className="oee-kesimpulan">{oeeKesimpulan()}</p>
                  </Card>

                  {/* Line Status */}
                  <Card className="dash-panel card-glow-info">
                    <p className="dash-panel-title">LINE STATUS</p>
                    <div className="table-wrap">
                      <table className="table-compact">
                        <thead>
                          <tr>
                            <th>LINE</th>
                            <th>STROKE</th>
                            <th>TARGET</th>
                            <th>ACTUAL</th>
                            <th>PERF</th>
                            <th>OEE</th>
                            <th>DT</th>
                          </tr>
                        </thead>
                        <tbody>
                          {MACHINES.map((m) => {
                            const d = machineDataMap[m.key] || {
                              stroke: 0, gsph: 0, ng: 0, downtime: 0, status: "OFFLINE",
                              targetGsph: 0, performanceFactor: 0, oee: 0,
                            };
                            return (
                              <tr key={m.key}>
                                <td>
                                  <span style={{ fontWeight: 700, color: "var(--text)" }}>
                                    {m.shortLabel}
                                  </span>
                                </td>
                                <td className="mono">{fmtNum(d.stroke)}</td>
                                <td className="mono">{fmtNum(d.targetGsph)}</td>
                                <td className="mono">{fmtNum(d.gsph)}</td>
                                <td className="mono">{fmtNum(d.performanceFactor)}%</td>
                                <td className="mono">{fmtNum(d.oee)}%</td>
                                <td className="mono">{fmtNum(d.downtime)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </div>

                {/* Row 2: Pie Kategori | Fleet Bar | Top 10 DT | Pareto */}
                <div className="dash-main-grid tv-row-4">

                  {/* Downtime per Kategori (Pie) */}
                  <Card className="dash-panel dash-panel-fit card-glow-info">
                    <p className="dash-panel-title">DOWNTIME PER KATEGORI</p>
                    <div className="dash-chart-sm">
                      <canvas ref={categoryPieRef} />
                    </div>
                  </Card>

                  {/* Downtime per Kategori × Line (Stacked Bar) */}
                  <Card className="dash-panel dash-panel-fit card-glow-info">
                    <p className="dash-panel-title">DOWNTIME PER KATEGORI × LINE</p>
                    <div className="dash-chart-sm">
                      <canvas ref={fleetCanvasRef} />
                    </div>
                  </Card>

                  {/* 10 Downtime Terburuk */}
                  <Card className="dash-panel card-glow-info" style={{ display: "flex", flexDirection: "column" }}>
                    <p className="dash-panel-title">10 DOWNTIME TERBURUK</p>
                    <div className="table-wrap" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                      <table className="table-compact" style={{ width: "100%", height: "100%" }}>
                        <thead>
                          <tr>
                            <th style={{ width: "22%" }}>LINE</th>
                            <th style={{ width: "25%" }}>KATEGORI</th>
                            <th style={{ width: "38%" }}>PROBLEM</th>
                            <th style={{ width: "15%" }}>MENIT</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fleetTop10.length > 0 ? (
                            fleetTop10.map((row, idx) => (
                              <tr key={idx}>
                                <td title={row.mesinLabel}><span className="badge">{row.mesinLabel}</span></td>
                                <td title={row.kategori}>{row.kategori}</td>
                                <td title={row.problem} style={{ minWidth: 120, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.problem}</td>
                                <td className="mono">{fmtNum(row.menit)}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={4} className="empty-state" style={{ padding: "40px 10px", verticalAlign: "middle", textAlign: "center", borderBottom: "1px solid var(--border)" }}>
                                Tidak ada downtime.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Card>

                  {/* Pareto Downtime */}
                  <Card className="dash-panel card-glow-info">
                    <p className="dash-panel-title">PARETO DOWNTIME (MENIT)</p>
                    {paretoDowntime.length > 0 ? (
                      <div style={{ flex: 1 }}>
                        {paretoDowntime.map((row) => (
                          <div className="pareto-row" key={row.problem}>
                            <span className="pareto-label" title={row.problem}>{row.problem}</span>
                            <div className="pareto-bar-track">
                              <div className="pareto-bar-fill" style={{ width: `${row.barPct}%` }} />
                            </div>
                            <span className="pareto-val">{fmtNum(row.menit)} ({fmtNum(row.pct)}%)</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="dash-empty-center">
                        <span>Tidak ada downtime.</span>
                      </div>
                    )}
                  </Card>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal drill-down downtime */}
        <Dialog open={downtimeModal.open} onOpenChange={(open) => { if (!open) closeDowntimeDetail(); }}>
          <DialogContent onClose={closeDowntimeDetail} maxWidth="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{downtimeModal.title}</DialogTitle>
            </DialogHeader>
            {downtimeModal.loading ? (
              <p className="empty-state">Memuat data...</p>
            ) : (
              <div className="table-wrap" style={{ maxHeight: "60vh" }}>
                <table className="table-compact">
                  <thead>
                    <tr>
                      <th>Line</th><th>Waktu</th><th>Kategori</th><th>Problem</th>
                      <th>Penyebab</th><th>Countermeasure</th><th>Menit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {downtimeModal.rows.map((row) => (
                      <tr key={row.id}>
                        <td title={row.mesinLabel}><span className="badge">{row.mesinLabel}</span></td>
                        <td className="mono">{fmtDowntimeWaktu(row.waktu_awal)}</td>
                        <td title={row.kategori}>{row.kategori}</td>
                        <td title={row.problem || "-"}>{row.problem || "-"}</td>
                        <td title={row.penyebab || "-"}>{row.penyebab || "-"}</td>
                        <td title={row.countermeasure || "-"}>{row.countermeasure || "-"}</td>
                        <td className="mono">{fmtNum(row.menit)}</td>
                      </tr>
                    ))}
                    {downtimeModal.rows.length === 0 && (
                      <tr>
                        <td colSpan={7} className="empty-state">
                          Tidak ada data downtime untuk filter ini di periode berjalan.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
