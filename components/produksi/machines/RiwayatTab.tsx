"use client";

import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Pencil,
  X,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import type { ProdMachineConfig, ProdMasterPart } from "@/types/produksi";

interface RiwayatTabProps {
  config: ProdMachineConfig;
  masterParts: ProdMasterPart[];
  riwayatTanggalDari: string;
  setRiwayatTanggalDari: (v: string) => void;
  riwayatTanggalSampai: string;
  setRiwayatTanggalSampai: (v: string) => void;
  riwayatPartNumber: string;
  setRiwayatPartNumber: (v: string) => void;
  riwayatSearch: string;
  setRiwayatSearch: (v: string) => void;
  resetRiwayatFilter: () => void;
  handleRiwayatBulanIni: () => void;
  handleRiwayatSemuaWaktu: () => void;
  riwayatGabungan: any[];
  canDeleteRow: (row: any) => boolean;
  canEditRow?: (row: any) => boolean;
  handleEditProductionRow: (data: any) => void;
  handleEditNonProduksiRow: (data: any) => void;
  handleViewDowntimeForProduction: (row: any) => void;
  setRiwayatDeleteTarget: (row: any) => void;
  fmt: (iso?: string | null) => string;
  fmtNum: (n: number | null | undefined) => string;
  // Bulk select props
  selectedIds: Set<string>;
  isAllSelected: boolean;
  isIndeterminate: boolean;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  // Server-side pagination props (matching /admin/laporan-produksi)
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalCount: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export default function RiwayatTab({
  config,
  masterParts,
  riwayatTanggalDari,
  setRiwayatTanggalDari,
  riwayatTanggalSampai,
  setRiwayatTanggalSampai,
  riwayatPartNumber,
  setRiwayatPartNumber,
  riwayatSearch,
  setRiwayatSearch,
  resetRiwayatFilter,
  handleRiwayatBulanIni,
  handleRiwayatSemuaWaktu,
  riwayatGabungan,
  canDeleteRow,
  canEditRow,
  handleEditProductionRow,
  handleEditNonProduksiRow,
  handleViewDowntimeForProduction,
  setRiwayatDeleteTarget,
  fmt,
  fmtNum,
  selectedIds,
  isAllSelected,
  isIndeterminate,
  onToggleSelect,
  onToggleSelectAll,
  currentPage,
  totalPages,
  pageSize,
  totalCount,
  isLoading,
  onPageChange,
  onPageSizeChange,
}: RiwayatTabProps) {
  // Ref callback to set indeterminate on the select-all checkbox
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  const setSelectAllRef = (el: HTMLInputElement | null) => {
    selectAllRef.current = el;
    if (el) el.indeterminate = isIndeterminate;
  };

  // Keep indeterminate in sync when it changes
  React.useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  // Compute total colspan for empty / loading state row
  const baseColspan =
    config.stationConfig.mode !== "none"
      ? config.routingMax > 0
        ? 13
        : 12
      : config.routingMax > 0
      ? 12
      : 11;

  const safeCurrentPage = Math.min(Math.max(1, currentPage), Math.max(1, totalPages));
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + riwayatGabungan.length, totalCount);

  return (
    <Card className="dash-panel card-glow-info">
      {/* Header & Quick Date Presets */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="dash-panel-title font-bold text-base text-slate-800">Riwayat Produksi</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Menampilkan <span className="font-semibold text-slate-700">{totalCount.toLocaleString("id-ID")}</span> baris riwayat produksi.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <button
            type="button"
            onClick={handleRiwayatBulanIni}
            className="font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer bg-transparent border-0"
          >
            Bulan Ini
          </button>
          <span className="text-slate-300">|</span>
          <button
            type="button"
            onClick={handleRiwayatSemuaWaktu}
            className="font-semibold text-slate-600 hover:text-slate-700 hover:underline cursor-pointer bg-transparent border-0"
          >
            Semua Waktu
          </button>
          {(riwayatTanggalDari || riwayatTanggalSampai || riwayatPartNumber || riwayatSearch) && (
            <>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={resetRiwayatFilter}
                className="font-semibold text-red-600 hover:text-red-700 hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-0"
              >
                Reset Filter
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filter Inputs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div className="field">
          <label className="text-xs font-semibold text-slate-600 mb-1 block">Dari Tanggal</label>
          <Input
            type="date"
            value={riwayatTanggalDari}
            onChange={(e) => setRiwayatTanggalDari(e.target.value)}
            className="h-9 text-xs"
          />
        </div>
        <div className="field">
          <label className="text-xs font-semibold text-slate-600 mb-1 block">Sampai Tanggal</label>
          <Input
            type="date"
            value={riwayatTanggalSampai}
            onChange={(e) => setRiwayatTanggalSampai(e.target.value)}
            className="h-9 text-xs"
          />
        </div>
        <div className="field">
          <label className="text-xs font-semibold text-slate-600 mb-1 block">Part Number</label>
          <Select
            value={riwayatPartNumber}
            onChange={(e) => setRiwayatPartNumber(e.target.value)}
            className="h-9 text-xs"
          >
            <option value="">Semua Part</option>
            {masterParts.map((part) => {
              const partNumber = part.kode_part || part.value || part.nama_part;
              return (
                <option key={part.id || partNumber} value={partNumber}>
                  {partNumber}
                </option>
              );
            })}
          </Select>
        </div>
        <div className="field">
          <label className="text-xs font-semibold text-slate-600 mb-1 block">Cari Riwayat</label>
          <div className="relative">
            <Input
              type="text"
              placeholder="Cari part, kode, stasiun..."
              value={riwayatSearch}
              onChange={(e) => setRiwayatSearch(e.target.value)}
              className="h-9 text-xs pr-8"
            />
            <Search className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-slate-400" />
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="table-wrap relative min-h-[160px]">
        {isLoading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            <span className="text-xs font-medium text-slate-600">Memuat data riwayat...</span>
          </div>
        )}

        <table>
          <thead>
            <tr>
              {/* Select-all checkbox column */}
              <th style={{ width: 36, paddingLeft: 8, paddingRight: 4, textAlign: "center" }}>
                <input
                  type="checkbox"
                  ref={setSelectAllRef}
                  checked={isAllSelected}
                  onChange={onToggleSelectAll}
                  aria-label="Pilih semua baris riwayat"
                  className="h-4 w-4 rounded border-slate-300 cursor-pointer accent-blue-600"
                />
              </th>
              <th className="col-hide-mobile">Kode</th>
              {config.stationConfig.mode !== "none" && <th className="col-hide-mobile">Stasiun</th>}
              <th className="col-hide-mobile">Waktu Awal</th>
              <th className="col-hide-mobile">Waktu Akhir</th>
              <th>Part Number</th>
              <th>Qty</th>
              <th>MP</th>
              <th>Dandori</th>
              <th>DT</th>
              <th>Break</th>
              {config.routingMax > 0 && <th className="col-hide-mobile">Routing</th>}
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {riwayatGabungan.map((row: any, idx) => {
              const data = row.data;
              const rowId = data.id as string;
              const routing = data.extra?.routing_type
                ? `${data.extra.routing_type}${data.extra.routing_numbers ? ` ${data.extra.routing_numbers.join(",")}` : ""}`
                : "-";
              const canEdit =
                (canEditRow ? canEditRow(row) : canDeleteRow(row)) &&
                (row.jenis === "produksi" || row.jenis === "non_produksi");
              const canSelect = canDeleteRow(row) && (row.jenis === "produksi" || row.jenis === "non_produksi");
              const isSelected = canSelect && selectedIds.has(rowId);
              const rowClick = canEdit
                ? () => (row.jenis === "produksi" ? handleEditProductionRow(data) : handleEditNonProduksiRow(data))
                : undefined;

              return (
                <tr
                  key={`${row.jenis}-${rowId || idx}`}
                  className={`${canEdit ? "row-clickable" : ""} ${isSelected ? "bg-blue-50/60" : ""}`}
                  onClick={rowClick}
                >
                  {/* Per-row checkbox */}
                  <td
                    style={{ width: 36, paddingLeft: 8, paddingRight: 4, textAlign: "center" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {canSelect ? (
                      <input
                        type="checkbox"
                        key={rowId}
                        checked={isSelected}
                        onChange={() => onToggleSelect(rowId)}
                        aria-label={`Pilih baris ${row.part_number || rowId}`}
                        className="h-4 w-4 rounded border-slate-300 cursor-pointer accent-blue-600"
                      />
                    ) : (
                      <input
                        type="checkbox"
                        disabled
                        aria-hidden="true"
                        className="h-4 w-4 opacity-0 pointer-events-none"
                      />
                    )}
                  </td>

                  <td className="mono col-hide-mobile">{row.jenis === "produksi" ? data.kode || "-" : "-"}</td>
                  {config.stationConfig.mode !== "none" && (
                    <td className="mono col-hide-mobile">{data.stasiun || "-"}</td>
                  )}
                  <td className="mono col-hide-mobile">{fmt(row.waktu_awal)}</td>
                  <td className="mono col-hide-mobile">{fmt(row.waktu_akhir)}</td>
                  <td>{row.part_number || "-"}</td>
                  <td className="mono">{row.jenis === "produksi" ? fmtNum(data.qty) : "-"}</td>
                  <td className="mono">{row.jenis === "produksi" ? fmtNum(data.manpower) : "-"}</td>
                  <td className="mono">
                    {row.jenis === "produksi" ? `${fmtNum(data.dandori_menit ?? 0)} mnt` : "-"}
                  </td>
                  <td className="mono">
                    {row.jenis === "produksi" && (data.downtime_menit ?? 0) > 0 ? (
                      <span
                        className="underline text-amber-500 hover:text-amber-600 font-semibold cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewDowntimeForProduction(data);
                        }}
                      >
                        {fmtNum(data.downtime_menit)} mnt
                      </span>
                    ) : (
                      <span>{row.jenis === "produksi" ? `${fmtNum(data.downtime_menit ?? 0)} mnt` : "-"}</span>
                    )}
                  </td>
                  <td className="mono">
                    {row.jenis === "produksi"
                      ? `${fmtNum(data.break_menit ?? 0)} mnt`
                      : data.break_menit !== undefined &&
                        data.break_menit !== null &&
                        data.break_menit !== "" &&
                        Number(data.break_menit) > 0
                      ? `${fmtNum(data.break_menit)} mnt`
                      : "-"}
                  </td>
                  {config.routingMax > 0 && (
                    <td className="col-hide-mobile">{row.jenis === "produksi" ? routing : "-"}</td>
                  )}
                  <td>
                    <div className="flex gap-1.5">
                      {row.jenis === "produksi" && canEdit && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          title="Edit baris produksi ini"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditProductionRow(data);
                          }}
                        >
                          <Pencil size={13} />
                        </Button>
                      )}
                      {row.jenis === "non_produksi" && canEdit && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          title="Edit baris non-produksi ini"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditNonProduksiRow(data);
                          }}
                        >
                          <Pencil size={13} />
                        </Button>
                      )}
                      {canDeleteRow(row) && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          title="Hapus baris ini"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRiwayatDeleteTarget(row);
                          }}
                        >
                          <X size={13} />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!isLoading && riwayatGabungan.length === 0 && (
              <tr>
                <td colSpan={baseColspan} className="empty-state text-center py-8 text-slate-500">
                  Belum ada data untuk filter ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls (Matching /admin/laporan-produksi) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 mt-2 border-t border-slate-200 bg-slate-50/50 rounded-b-lg">
        <div className="flex items-center gap-3 text-xs text-slate-600">
          <span>
            Menampilkan <strong>{totalCount > 0 ? startIndex + 1 : 0}</strong> -{" "}
            <strong>{endIndex}</strong> dari <strong>{totalCount.toLocaleString("id-ID")}</strong> entri
          </span>
          <div className="hidden sm:flex items-center gap-1.5 ml-2 border-l border-slate-200 pl-3">
            <span className="text-slate-500">Baris per hal:</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-7 px-2 py-0 border border-slate-300 rounded bg-white text-xs text-slate-700 outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPageChange(1)}
            disabled={safeCurrentPage <= 1 || isLoading}
            className="h-8 w-8 p-0 border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40"
            title="Halaman Pertama"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.max(1, safeCurrentPage - 1))}
            disabled={safeCurrentPage <= 1 || isLoading}
            className="h-8 w-8 p-0 border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40"
            title="Halaman Sebelumnya"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <span className="px-3 text-xs font-semibold text-slate-700 whitespace-nowrap">
            Hal {safeCurrentPage} dari {Math.max(1, totalPages)}
          </span>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.min(totalPages, safeCurrentPage + 1))}
            disabled={safeCurrentPage >= totalPages || isLoading}
            className="h-8 w-8 p-0 border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40"
            title="Halaman Berikutnya"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPageChange(totalPages)}
            disabled={safeCurrentPage >= totalPages || isLoading}
            className="h-8 w-8 p-0 border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40"
            title="Halaman Terakhir"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
