import type { ProdMachineConfig } from "@/types/produksi";

export const MACHINE_CONFIGS: Record<string, ProdMachineConfig> = {
  blanking: {
    slug: "blanking",
    key: "blanking",
    label: "Blanking",
    extraFields: [
      { key: "top_coil", label: "Top Coil", type: "text" },
      { key: "berat_coil", label: "Berat Coil (kg)", type: "number" },
    ],
    routingMax: 0,
    kategoriOptions: ["MESIN", "DIES", "FINGER", "OTHER"],
    stationConfig: { mode: "none" },
  },
  pc200t: {
    slug: "pc200t",
    key: "pc200t",
    label: "PC200t",
    extraFields: [],
    routingMax: 0,
    kategoriOptions: ["MESIN", "DIES", "FINGER", "OTHER"],
    stationConfig: { mode: "fixed", stations: ["PC-1", "PC-2"] },
  },
  tandem: {
    slug: "tandem",
    key: "tandem",
    label: "Tandem",
    extraFields: [],
    routingMax: 8,
    kategoriOptions: ["MESIN", "DIES", "FINGER", "OTHER"],
    stationConfig: {
      mode: "variant",
      variants: {
        lama: ["PA-1", "PA-2", "PA-3", "PA-4", "PA-5"],
        baru: ["PA-6", "PA-7", "PA-8", "PA-9", "PA-10"],
      },
    },
  },
  "transfer-2000t": {
    slug: "transfer-2000t",
    key: "transfer_2000t",
    label: "Transfer 2000t",
    extraFields: [],
    routingMax: 0,
    kategoriOptions: ["MESIN", "DIES", "FINGER", "OTHER"],
    stationConfig: { mode: "none" },
  },
  "transfer-800t": {
    slug: "transfer-800t",
    key: "transfer_800t",
    label: "Transfer 800t",
    extraFields: [],
    routingMax: 0,
    kategoriOptions: ["MESIN", "DIES", "FINGER", "OTHER"],
    stationConfig: { mode: "none" },
  },
};

/**
 * Config default/generic untuk line produksi baru yang tidak punya entry khusus di MACHINE_CONFIGS.
 * Dipakai sebagai fallback — tidak menggantikan 5 config yang sudah ada.
 */
export function getMachineConfig(slug: string, label?: string): ProdMachineConfig {
  const normSlug = (slug || "").toLowerCase().trim();
  const dashed = normSlug.replace(/[_\s]+/g, "-");
  if (MACHINE_CONFIGS[dashed]) return MACHINE_CONFIGS[dashed];
  if (MACHINE_CONFIGS[normSlug]) return MACHINE_CONFIGS[normSlug];

  if (label) {
    const normLabel = label.toLowerCase().trim().replace(/[_\s]+/g, "-");
    if (MACHINE_CONFIGS[normLabel]) return MACHINE_CONFIGS[normLabel];
    if (normLabel.includes("blanking")) return MACHINE_CONFIGS["blanking"];
    if (normLabel.includes("pc200") || normLabel.includes("pc-200")) return MACHINE_CONFIGS["pc200t"];
    if (normLabel.includes("tandem")) return MACHINE_CONFIGS["tandem"];
    if (normLabel.includes("2000")) return MACHINE_CONFIGS["transfer-2000t"];
    if (normLabel.includes("800")) return MACHINE_CONFIGS["transfer-800t"];
  }

  // Fallback: konfigurasi standar generik
  const key = normSlug.replace(/-/g, "_");
  return {
    slug,
    key,
    label: label ?? slug,
    extraFields: [],
    routingMax: 0,
    kategoriOptions: ["MESIN", "DIES", "FINGER", "OTHER"],
    stationConfig: { mode: "none" },
  };
}
