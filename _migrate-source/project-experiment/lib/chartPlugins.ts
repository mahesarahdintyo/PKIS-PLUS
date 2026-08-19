// =========================================================
// Plugin Chart.js custom untuk mode "Visualisasi Internal" — diporting
// dari vanilla assets/index.html (Chart.register(...) di top-level script).
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

// Tulis angka total di tengah doughnut chart (dipakai di "Downtime per Kategori").
const pieCenterText = {
  id: "pieCenterText",
  afterDatasetsDraw(chart: Chart, _args: unknown, opts: any) {
    if (!opts || !opts.value) return;
    const { ctx, chartArea } = chart;
    const cx = (chartArea.left + chartArea.right) / 2;
    const cy = (chartArea.top + chartArea.bottom) / 2;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const mainColor = resolveColor(opts.color, "--text", "#f1f5f9");
    const labelColor = resolveColor(opts.labelColor, "--muted", "#94a3b8");

    const size = Math.min(chartArea.right - chartArea.left, chartArea.bottom - chartArea.top);
    const fontSizeVal = Math.max(12, Math.min(18, Math.round(size * 0.16)));
    const fontSizeLbl = Math.max(8, Math.min(10, Math.round(size * 0.08)));

    ctx.fillStyle = mainColor;
    ctx.font = `700 ${fontSizeVal}px ` + (opts.fontFamily || "'Space Grotesk', sans-serif");
    ctx.fillText(opts.value, cx, cy - (opts.label ? (fontSizeLbl * 0.7) : 0));
    if (opts.label) {
      ctx.fillStyle = labelColor;
      ctx.font = `600 ${fontSizeLbl}px ` + (opts.fontFamily || "sans-serif");
      ctx.fillText(opts.label, cx, cy + (fontSizeVal * 0.6));
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

    const labelColor = resolveColor(opts.color, "--text", "#f1f5f9");

    meta.data.forEach((arc: any, i: number) => {
      const val = Number((dataset.data as number[])[i]) || 0;
      if (val <= 0) return; // slice kosong tidak usah dilabeli, biar tidak numpuk
      const pct = Math.round((val / total) * 100);
      if (pct < 10) return; // slice terlalu kecil — tampilkan persentase di legend saja, bukan di canvas
      const pos = arc.tooltipPosition();
      ctx.save();
      ctx.fillStyle = labelColor;
      ctx.font = "700 11px " + (opts.fontFamily || "sans-serif");
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(pct + "%", pos.x, pos.y);
      ctx.restore();
    });
  },
};

// Panah + angka variance di atas tiap bar (Actual vs Target).
// dataset[0] = actual (bar), dataset[1] = target (marker titik/garis).
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
      const targetY = scales.y.getPixelForValue(target);
      const labelY = Math.min(barTopY, targetY) - 24;
      ctx.save();
      ctx.textAlign = "center";
      ctx.font = "700 11px " + (opts.fontFamily || "sans-serif");
      ctx.fillStyle = color;
      const sign = variance > 0 ? "+" : "";
      const text = sign + (opts.fmt ? opts.fmt(variance) : Math.round(variance));
      ctx.fillText(text, x, labelY);
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

// Label angka (bold) di atas/tengah tiap bar — dipakai chart bar manapun
// yang butuh angkanya kelihatan langsung tanpa hover.
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
      if (dataset.skipLabel) return; // dataset yg sengaja tdk dikasih label (mis. garis target)
      const meta = chart.getDatasetMeta(di);
      if (meta.hidden) return;
      const isLine = dataset.type === "line";

      meta.data.forEach((el: any, i: number) => {
        const val = dataset.data[i];
        if (val === null || val === undefined || val === 0) return;

        if (!isLine && isStacked) {
          const base = el.base !== undefined ? el.base : el.y;
          const barHeight = Math.abs(base - el.y);
          if (barHeight < minHeight) return; // Sembunyikan label jika tinggi visual segmen < 20px

          const centerY = (el.y + base) / 2;
          ctx.save();
          ctx.font = "700 10px 'Space Grotesk', sans-serif";
          ctx.fillStyle = labelColor;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(fmt(val), el.x, centerY);
          ctx.restore();
          return;
        }

        const pos = el.tooltipPosition ? el.tooltipPosition() : { x: el.x, y: el.y };
        ctx.save();
        ctx.font = "700 10px 'Space Grotesk', sans-serif";
        ctx.fillStyle = labelColor;
        ctx.textAlign = "center";
        ctx.textBaseline = isLine ? "bottom" : "bottom";
        const offsetY = isLine ? -8 : -4;
        ctx.fillText(fmt(val), pos.x, pos.y + offsetY);
        ctx.restore();
      });
    });
  },
};

let registered = false;

// Idempotent — aman dipanggil dari useEffect tiap render, plugin cuma
// diregister sekali ke instance Chart.js global.
export function registerInternalVizPlugins() {
  if (registered) return;
  Chart.register(pieCenterText, sliceLabels, varianceArrows, barValueLabels);
  registered = true;
}
