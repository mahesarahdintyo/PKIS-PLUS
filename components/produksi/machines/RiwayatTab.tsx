"use client";

import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Pencil, X } from "lucide-react";
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
  resetRiwayatFilter: () => void;
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
  resetRiwayatFilter,
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
}: RiwayatTabProps) {
  // Ref callback to set indeterminate on the select-all checkbox
  // (HTML checkbox has no native indeterminate prop in React)
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

  // Compute total colspan for empty state row
  const baseColspan = config.stationConfig.mode !== "none"
    ? (config.routingMax > 0 ? 13 : 12)
    : (config.routingMax > 0 ? 12 : 11);

  return (
    <Card className="dash-panel card-glow-info">
      <div className="flex flex-wrap justify-between gap-3 mb-4">
        <h3 className="dash-panel-title font-bold text-base">Riwayat Produksi</h3>
        <Button type="button" variant="secondary" size="sm" onClick={resetRiwayatFilter}>
          Reset Filter
        </Button>
      </div>
      <div className="form-grid mb-4">
        <div className="field">
          <label>Dari Tanggal</label>
          <Input
            type="date"
            value={riwayatTanggalDari}
            onChange={(e) => setRiwayatTanggalDari(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Sampai Tanggal</label>
          <Input
            type="date"
            value={riwayatTanggalSampai}
            onChange={(e) => setRiwayatTanggalSampai(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Part Number</label>
          <Select
            value={riwayatPartNumber}
            onChange={(e) => setRiwayatPartNumber(e.target.value)}
          >
            <option value="">Semua</option>
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
      </div>
      <div className="table-wrap">
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
              const canEdit = (canEditRow ? canEditRow(row) : canDeleteRow(row)) && (row.jenis === "produksi" || row.jenis === "non_produksi");
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
                      // Non-selectable rows: show a disabled, invisible placeholder to keep column aligned
                      <input
                        type="checkbox"
                        disabled
                        aria-hidden="true"
                        className="h-4 w-4 opacity-0 pointer-events-none"
                      />
                    )}
                  </td>

                  <td className="mono col-hide-mobile">{row.jenis === "produksi" ? (data.kode || "-") : "-"}</td>
                  {config.stationConfig.mode !== "none" && <td className="mono col-hide-mobile">{data.stasiun || "-"}</td>}
                  <td className="mono col-hide-mobile">{fmt(row.waktu_awal)}</td>
                  <td className="mono col-hide-mobile">{fmt(row.waktu_akhir)}</td>
                  <td>{row.part_number || "-"}</td>
                  <td className="mono">{row.jenis === "produksi" ? fmtNum(data.qty) : "-"}</td>
                  <td className="mono">{row.jenis === "produksi" ? fmtNum(data.manpower) : "-"}</td>
                  <td className="mono">{row.jenis === "produksi" ? `${fmtNum(data.dandori_menit ?? 0)} mnt` : "-"}</td>
                  <td className="mono">
                    {row.jenis === "produksi" && (data.downtime_menit ?? 0) > 0 ? (
                      <span
                        className="underline text-amber-400 cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); handleViewDowntimeForProduction(data); }}
                      >
                        {fmtNum(data.downtime_menit)} mnt
                      </span>
                    ) : (
                      <span>{row.jenis === "produksi" ? `${fmtNum(data.downtime_menit ?? 0)} mnt` : "-"}</span>
                    )}
                  </td>
                  <td className="mono">{row.jenis === "produksi" ? `${fmtNum(data.break_menit ?? 0)} mnt` : "-"}</td>
                  {config.routingMax > 0 && <td className="col-hide-mobile">{row.jenis === "produksi" ? routing : "-"}</td>}
                  <td>
                    <div className="flex gap-1.5">
                      {row.jenis === "produksi" && canEdit && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          title="Edit baris produksi ini"
                          onClick={(e) => { e.stopPropagation(); handleEditProductionRow(data); }}
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
                          onClick={(e) => { e.stopPropagation(); handleEditNonProduksiRow(data); }}
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
                          onClick={(e) => { e.stopPropagation(); setRiwayatDeleteTarget(row); }}
                        >
                          <X size={13} />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {riwayatGabungan.length === 0 && (
              <tr>
                <td colSpan={baseColspan} className="empty-state text-center py-6">
                  Belum ada data untuk filter ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
