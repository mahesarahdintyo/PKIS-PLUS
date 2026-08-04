export interface ProductionReport {
  id: string;
  land_id: string;
  report_date: string; // YYYY-MM-DD
  shift: string;
  operator_name: string;
  start_time: string; // HH:MM or HH:MM:SS
  end_time: string; // HH:MM or HH:MM:SS
  part_number: string;
  qty: number;
  ng_qty: number;
  ng_category?: string | null;
  break_minutes: number;
  created_at: string;
  updated_at: string;
  land?: {
    name: string;
  } | null;
  is_active?: boolean;
}

export interface ProductionReportQuery {
  landId?: string;
  startDate?: string;
  endDate?: string;
  trash?: boolean;
}

export async function getProductionReports(query?: ProductionReportQuery): Promise<ProductionReport[]> {
  const params = new URLSearchParams();
  if (query?.landId) {
    params.set("landId", query.landId);
  }
  if (query?.startDate) {
    params.set("startDate", query.startDate);
  }
  if (query?.endDate) {
    params.set("endDate", query.endDate);
  }
  if (query?.trash) {
    params.set("trash", "true");
  }

  const queryString = params.toString();
  const url = `/api/production-reports${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? "Gagal memuat laporan produksi");
  }

  return response.json();
}

export async function createProductionReport(
  data: Omit<ProductionReport, "id" | "created_at" | "updated_at">
): Promise<ProductionReport> {
  const url = "/api/production-reports";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error ?? "Gagal menyimpan laporan produksi");
  }

  return response.json();
}

export async function deleteProductionReport(id: string): Promise<boolean> {
  const url = `/api/production-reports/${encodeURIComponent(id)}`;

  const response = await fetch(url, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error ?? "Gagal menghapus laporan produksi");
  }

  return true;
}
