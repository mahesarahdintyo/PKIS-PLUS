// =========================================================
// Plugin Chart.js custom untuk mode "Visualisasi Internal"
// Porting dari project-experiment/lib/chartPlugins.ts
// Diregister sekali lewat registerInternalVizPlugins() sebelum chart apapun
// yang memakainya dibuat.
// =========================================================

import Chart from "chart.js/auto";

const getCssVar = (v: string): string => {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue(v).trim() || "";
  } catch {
    return "";
  }
};

const resolveColor = (val: any, fallbackVar: string, defaultHex: string): string => {
  let color = getCssVar(fallbackVar) || defaultHex;
  if (typeof val === "function") {
    try {
      color = val() || color;
    } catch {
      // fallback
    }
  } else if (typeof val === "string" && val && val !== "auto") {
    color = val.startsWith("var(")
      ? getCssVar(val.slice(4, -1).trim()) || color
      : val;
  }
  return color;
};

export function hexToRgba(hex: string, alpha: number): string {
  const cleanHex = hex.replace("#", "").trim();
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16);
    const g = parseInt(cleanHex[1] + cleanHex[1], 16);
    const b = parseInt(cleanHex[2] + cleanHex[2], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return hex;
}

export function createVerticalGradient(
  ctx: CanvasRenderingContext2D,
  chartArea: { top: number; bottom: number } | undefined,
  topColor: string,
  bottomColor: string
): CanvasGradient | string {
  if (!chartArea || chartArea.bottom === chartArea.top) return topColor;
  const grad = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  grad.addColorStop(0, topColor);
  grad.addColorStop(1, bottomColor);
  return grad;
}

export function createAreaGradient(
  ctx: CanvasRenderingContext2D,
  chartArea: { top: number; bottom: number } | undefined,
  colorHex: string,
  peakAlpha = 0.38,
  midAlpha = 0.12,
  bottomAlpha = 0.0
): CanvasGradient | string {
  if (!chartArea || chartArea.bottom === chartArea.top) return colorHex;
  const grad = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  grad.addColorStop(0, hexToRgba(colorHex, peakAlpha));
  grad.addColorStop(0.5, hexToRgba(colorHex, midAlpha));
  grad.addColorStop(1, hexToRgba(colorHex, bottomAlpha));
  return grad;
}

// Tulis angka total di tengah doughnut chart dengan aksen dial 2.5D (dipakai di "Downtime per Kategori").
const pieCenterText = {
  id: "pieCenterText",
  afterDatasetsDraw(chart: Chart, _args: unknown, opts: any) {
    if (!opts || !opts.value) return;
    const { ctx, chartArea } = chart;
    const cx = (chartArea.left + chartArea.right) / 2;
    const cy = (chartArea.top + chartArea.bottom) / 2;
    ctx.save();

    // 2.5D Dial Inner Core (Lempeng dial halus di dalam lubang donat)
    const size = Math.min(chartArea.right - chartArea.left, chartArea.bottom - chartArea.top);
    const innerR = size * 0.31;
    if (innerR > 12) {
      const radGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, innerR);
      radGrad.addColorStop(0, "rgba(255, 255, 255, 0.08)");
      radGrad.addColorStop(0.7, "rgba(255, 255, 255, 0.02)");
      radGrad.addColorStop(1, "rgba(0, 0, 0, 0.32)");
      ctx.fillStyle = radGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const mainColor = resolveColor(opts.color, "--text", "#f1f5f9");
    const labelColor = resolveColor(opts.labelColor, "--muted-foreground", "#94a3b8");

    const fontSizeVal = Math.max(12, Math.min(18, Math.round(size * 0.16)));
    const fontSizeLbl = Math.max(8, Math.min(10, Math.round(size * 0.08)));

    ctx.fillStyle = mainColor;
    ctx.font = `700 ${fontSizeVal}px ` + (opts.fontFamily || "'Aptos', 'Aptos Display', sans-serif");
    ctx.fillText(String(opts.value).toUpperCase(), cx, cy - (opts.label ? (fontSizeLbl * 0.7) : 0));
    if (opts.label) {
      ctx.fillStyle = labelColor;
      ctx.font = `600 ${fontSizeLbl}px ` + (opts.fontFamily || "'Aptos', 'Aptos Display', sans-serif");
      ctx.fillText(String(opts.label).toUpperCase(), cx, cy + (fontSizeVal * 0.6));
    }
    ctx.restore();
  },
};

// Label persentase di setiap slice pie/doughnut.
const sliceLabels = {
  id: "sliceLabels",
  afterDatasetsDraw(chart: Chart, _args: unknown, opts: any) {
    if (!opts || !opts.enabled) return;
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);
    const dataset = chart.data.datasets[0];
    const total = ((dataset?.data as number[]) || []).reduce((a, b) => a + (Number(b) || 0), 0);
    if (total <= 0) return;

    const fallbackColor = resolveColor(opts.color, "--slice-label-text", "#ffffff");
    // opts.colors: optional array of per-slice colors (matching category colors)
    const perSliceColors: string[] | undefined = Array.isArray(opts.colors) ? opts.colors : undefined;

    meta.data.forEach((arc: any, i: number) => {
      const val = Number((dataset.data as number[])[i]) || 0;
      if (val <= 0) return;
      const pct = Math.round((val / total) * 100);
      if (pct < 10) return;
      const pos = arc.tooltipPosition();
      const sliceColor = perSliceColors ? (perSliceColors[i] || fallbackColor) : fallbackColor;
      ctx.save();
      ctx.fillStyle = sliceColor;
      ctx.font = "bold 11px " + (opts.fontFamily || "'Aptos', 'Aptos Display', sans-serif");
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      // Thin dark stroke for legibility on light/coloured backgrounds
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.lineWidth = 3;
      ctx.lineJoin = "round";
      ctx.strokeText(pct + "%", pos.x, pos.y);
      ctx.fillText(pct + "%", pos.x, pos.y);
      ctx.restore();
    });
  },
};

// Panah + angka variance di atas tiap bar (Actual vs Target).
const varianceArrows = {
  id: "varianceArrows",
  afterDatasetsDraw(chart: Chart, _args: unknown, opts: any) {
    if (!opts || !opts.enabled) return;
    const { ctx, scales } = chart;
    const actualData = chart.data.datasets[0].data as number[];
    const targetData = (chart.data.datasets[1] ? chart.data.datasets[1].data : []) as number[];
    const meta = chart.getDatasetMeta(0);
    const upColor = resolveColor(opts.upColor, "--status-good", "#16a34a");
    const downColor = resolveColor(opts.downColor, "--status-bad", "#dc2626");
    meta.data.forEach((bar: any, i: number) => {
      const actual = Number(actualData[i]);
      const target = Number(targetData[i]);
      if (!isFinite(actual) || !isFinite(target) || !target) return;
      const variance = actual - target;
      const isUp = variance >= 0;
      const color = isUp ? upColor : downColor;
      const x = bar.x;
      const barTopY = bar.y;
      const targetY = (scales as any).y.getPixelForValue(target);
      const labelY = Math.min(barTopY, targetY) - 24;
      ctx.save();
      ctx.textAlign = "center";
      ctx.font = "700 11px " + (opts.fontFamily || "'Aptos', 'Aptos Display', sans-serif");
      ctx.fillStyle = color;
      const sign = variance > 0 ? "+" : "";
      const text = sign + (opts.fmt ? opts.fmt(variance) : Math.round(variance));
      ctx.fillText(String(text).toUpperCase(), x, labelY);
      const y1 = labelY + 7, y2 = labelY + 19;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, isUp ? y2 : y1);
      ctx.lineTo(x, isUp ? y1 + 4 : y2 - 4);
      ctx.stroke();
      const headY = isUp ? y1 : y2;
      const dir = isUp ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(x - 4, headY + dir * 5);
      ctx.lineTo(x, headY);
      ctx.lineTo(x + 4, headY + dir * 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
  },
};

// Label angka (bold) di atas/tengah tiap bar.
const barValueLabels = {
  id: "barValueLabels",
  afterDatasetsDraw(chart: Chart, _args: unknown, opts: any) {
    if (!opts || !opts.enabled) return;
    const { ctx } = chart;
    const fmt = opts.fmt || ((v: number) => Math.round(v));
    const minHeight = opts.minHeight !== undefined ? opts.minHeight : 20;

    const scales = chart.options.scales as any;
    const isStacked = scales?.x?.stacked || scales?.y?.stacked;
    const labelColor = resolveColor(opts.color, "--text", "#f1f5f9");

    chart.data.datasets.forEach((dataset: any, di: number) => {
      if (dataset.skipLabel) return;
      const meta = chart.getDatasetMeta(di);
      if (meta.hidden) return;
      const isLine = dataset.type === "line";

      meta.data.forEach((el: any, i: number) => {
        const val = dataset.data[i];
        if (val === null || val === undefined || val === 0) return;

        if (!isLine && isStacked) {
          const base = el.base !== undefined ? el.base : el.y;
          const barHeight = Math.abs(base - el.y);
          if (barHeight < minHeight) return;

          const centerY = (el.y + base) / 2;
          ctx.save();
          ctx.font = "700 10px 'Aptos', 'Aptos Display', sans-serif";
          ctx.fillStyle = labelColor;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(fmt(val)).toUpperCase(), el.x, centerY);
          ctx.restore();
          return;
        }

        const pos = el.tooltipPosition ? el.tooltipPosition() : { x: el.x, y: el.y };
        ctx.save();
        ctx.font = "700 10px 'Aptos', 'Aptos Display', sans-serif";
        ctx.fillStyle = labelColor;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        const offsetY = isLine ? -8 : -4;
        ctx.fillText(String(fmt(val)).toUpperCase(), pos.x, pos.y + offsetY);
        ctx.restore();
      });
    });
  },
};

// Efek 3D Ring Floating Shadow untuk Doughnut & Pie Chart
const doughnut3DDepth = {
  id: "doughnut3DDepth",
  beforeDatasetDraw(chart: Chart) {
    const opts = (chart.options.plugins as any)?.doughnut3DDepth;
    if (opts?.enabled === false) return;
    const chartType = (chart.config as any)?.type;
    if (chartType === "doughnut" || chartType === "pie") {
      const { ctx } = chart;
      ctx.save();
      ctx.shadowColor = opts?.shadowColor || "rgba(0, 0, 0, 0.22)";
      ctx.shadowBlur = opts?.shadowBlur !== undefined ? opts.shadowBlur : 8;
      ctx.shadowOffsetX = opts?.shadowOffsetX !== undefined ? opts.shadowOffsetX : 0;
      ctx.shadowOffsetY = opts?.shadowOffsetY !== undefined ? opts.shadowOffsetY : 4;
    }
  },
  afterDatasetDraw(chart: Chart) {
    const opts = (chart.options.plugins as any)?.doughnut3DDepth;
    if (opts?.enabled === false) return;
    const chartType = (chart.config as any)?.type;
    if (chartType === "doughnut" || chartType === "pie") {
      chart.ctx.restore();
    }
  },
};

// Efek Neon Glow untuk Line Chart
const lineGlow = {
  id: "lineGlow",
  beforeDatasetDraw(chart: Chart, args: any) {
    const meta = chart.getDatasetMeta(args.index);
    if (meta.type === "line") {
      const opts = (chart.options.plugins as any)?.lineGlow;
      if (opts?.enabled !== false) {
        const ctx = chart.ctx;
        ctx.save();
        const borderColor = (meta.dataset?.options as any)?.borderColor;
        const glowColor = typeof borderColor === "string" ? borderColor : "rgba(56, 189, 248, 0.5)";
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 2;
      }
    }
  },
  afterDatasetDraw(chart: Chart, args: any) {
    const meta = chart.getDatasetMeta(args.index);
    if (meta.type === "line") {
      const opts = (chart.options.plugins as any)?.lineGlow;
      if (opts?.enabled !== false) {
        chart.ctx.restore();
      }
    }
  },
};

let registered = false;

// Idempotent — aman dipanggil dari useEffect tiap render.
export function registerInternalVizPlugins() {
  if (registered) return;
  Chart.defaults.font.family = "'Aptos', 'Aptos Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  Chart.register(pieCenterText, sliceLabels, varianceArrows, barValueLabels, doughnut3DDepth, lineGlow);
  registered = true;
}
