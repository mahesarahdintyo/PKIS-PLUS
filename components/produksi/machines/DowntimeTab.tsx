"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Play,
  Square,
  FilterX,
  Pencil,
  X,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import type {
  ProdMachineConfig,
  ProdDowntimeLogRow,
  ProdDowntimeProblem,
} from "@/types/produksi";

function ProblemCombobox({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = (() => {
    const q = (value || "").toLowerCase();
    if (!q) return options.slice(0, 50);
    return options.filter((o) => o.toLowerCase().includes(q)).slice(0, 50);
  })();

  return (
    <div className="combo relative" ref={wrapRef}>
      <Input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Ketik atau pilih..."
      />
      {open && filtered.length > 0 && (
        <div className="combo-list">
          {filtered.map((opt) => (
            <div
              key={opt}
              className="combo-item"
              onMouseDown={(e) => { e.preventDefault(); onChange(opt); setOpen(false); }}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface DowntimeTabProps {
  config: ProdMachineConfig;
  isLeaderOrAdmin: boolean;
  canEditRow?: (row?: any) => boolean;
  canDeleteRow?: (row?: any) => boolean;
  dtState: "idle" | "running" | "stopped";
  dtStart: string | null;
  dtEnd: string | null;
  setDtStart: (v: string | null) => void;
  setDtEnd: (v: string | null) => void;
  dtForm: {
    stasiun: string;
    kategori: string;
    problem: string;
    penyebab: string;
    countermeasure: string;
  };
  setDtForm: React.Dispatch<
    React.SetStateAction<{
      stasiun: string;
      kategori: string;
      problem: string;
      penyebab: string;
      countermeasure: string;
    }>
  >;
  problemList: ProdDowntimeProblem[];
  stationList: () => { id: string; label: string | null }[];
  dbStasiun: (stationId: string) => string | null;
  startDowntime: () => void;
  cancelDowntime: () => void;
  stopDowntime: () => void;
  submitDowntime: (e: React.FormEvent) => Promise<void>;
  editingDowntimeId: string | null;
  downtimeRowsFiltered: () => ProdDowntimeLogRow[];
  downtimeFilterProductionId: string | null;
  downtimeFilterLabel: string;
  clearDowntimeFilter: () => void;
  editDowntime: (row: ProdDowntimeLogRow) => void;
  deleteDowntime: (id: string) => Promise<void>;
  durasiMenit: (waktuAwal?: string | null, waktuAkhir?: string | null) => string;
  fmt: (iso?: string | null) => string;
  fmtClock: (iso?: string | null) => string;
  // Filter & Pagination props
  dtTanggalDari: string;
  setDtTanggalDari: (v: string) => void;
  dtTanggalSampai: string;
  setDtTanggalSampai: (v: string) => void;
  dtKategori: string;
  setDtKategori: (v: string) => void;
  dtSearch: string;
  setDtSearch: (v: string) => void;
  resetDtFilter: () => void;
  handleDtBulanIni: () => void;
  handleDtSemuaWaktu: () => void;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalCount: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

/** Konversi ISO string ke nilai datetime-local (YYYY-MM-DDTHH:MM) */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function DowntimeTab({
  config,
  isLeaderOrAdmin,
  canEditRow,
  canDeleteRow,
  dtState,
  dtStart,
  dtEnd,
  setDtStart,
  setDtEnd,
  dtForm,
  setDtForm,
  problemList,
  stationList,
  dbStasiun,
  startDowntime,
  cancelDowntime,
  stopDowntime,
  submitDowntime,
  editingDowntimeId,
  downtimeRowsFiltered,
  downtimeFilterProductionId,
  downtimeFilterLabel,
  clearDowntimeFilter,
  editDowntime,
  deleteDowntime,
  durasiMenit,
  fmt,
  fmtClock,
  dtTanggalDari,
  setDtTanggalDari,
  dtTanggalSampai,
  setDtTanggalSampai,
  dtKategori,
  setDtKategori,
  dtSearch,
  setDtSearch,
  resetDtFilter,
  handleDtBulanIni,
  handleDtSemuaWaktu,
  currentPage,
  totalPages,
  pageSize,
  totalCount,
  isLoading,
  onPageChange,
  onPageSizeChange,
}: DowntimeTabProps) {
  const canEditDowntime = Boolean(canEditRow ? canEditRow() : true);

  return (
    <div className="space-y-4">
      <Card className="dash-panel card-glow-info">
        <p className="dash-panel-title font-bold text-base mb-3">
          {editingDowntimeId ? "Edit Data Downtime" : "Catat Downtime"}
        </p>

        {!editingDowntimeId && (
          <div className="timer-row flex items-center gap-3">
            {dtState === "idle" ? (
              <Button type="button" onClick={startDowntime}>
                <Play size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} /> Mulai Downtime
              </Button>
            ) : (
              <div className="timer-badge flex items-center gap-2">
                <span className={`timer-dot ${dtState === "running" ? "timer-dot-live" : ""}`}></span>
                <span>Mulai <b>{fmtClock(dtStart)}</b></span>
                {dtState === "running" ? (
                  <Button type="button" variant="secondary" size="sm" onClick={stopDowntime}>
                    <Square size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} /> Selesai
                  </Button>
                ) : (
                  <span>· Selesai <b>{fmtClock(dtEnd)}</b></span>
                )}
                <Button type="button" variant="ghost" size="sm" onClick={cancelDowntime}>Batal</Button>
              </div>
            )}
          </div>
        )}

        <p className="hint text-xs text-muted-foreground mt-3">
          Waktu downtime harus pas di dalam satu baris produksi (tidak boleh melintasi 2 part) — sistem akan menolak otomatis kalau tidak cocok.
        </p>

        {(editingDowntimeId || dtState === "stopped") && (
          <form onSubmit={submitDowntime} className="mt-4">
            <div className="form-grid">
              {/* Waktu Awal & Akhir — hanya tampil saat mode edit */}
              {editingDowntimeId && (
                <>
                  <div className="field">
                    <label>Waktu Awal</label>
                    <Input
                      type="datetime-local"
                      value={toLocalInput(dtStart)}
                      onChange={(e) =>
                        setDtStart(e.target.value ? new Date(e.target.value).toISOString() : null)
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Waktu Akhir</label>
                    <Input
                      type="datetime-local"
                      value={toLocalInput(dtEnd)}
                      onChange={(e) =>
                        setDtEnd(e.target.value ? new Date(e.target.value).toISOString() : null)
                      }
                    />
                  </div>
                </>
              )}
              {config.stationConfig.mode !== "none" && (
                <div className="field">
                  <label>Stasiun</label>
                  <Select
                    value={dtForm.stasiun}
                    onChange={(e) => setDtForm((prev) => ({ ...prev, stasiun: e.target.value }))}
                  >
                    <option value="">- pilih -</option>
                    {stationList().map((st) => (
                      <option key={st.id} value={dbStasiun(st.id) || ""}>{st.label}</option>
                    ))}
                  </Select>
                </div>
              )}
              <div className="field">
                <label>Kategori</label>
                <Select
                  value={dtForm.kategori}
                  onChange={(e) => setDtForm((prev) => ({ ...prev, kategori: e.target.value }))}
                >
                  <option value="">- pilih -</option>
                  {config.kategoriOptions.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </Select>
              </div>
              <div className="field col-span-1 sm:col-span-2">
                <label>Problem</label>
                <ProblemCombobox
                  options={problemList.map((p) => p.value)}
                  value={dtForm.problem}
                  onChange={(v) => setDtForm((prev) => ({ ...prev, problem: v }))}
                />
              </div>
              <div className="field col-span-1 sm:col-span-2">
                <label>Penyebab</label>
                <Input
                  type="text"
                  value={dtForm.penyebab}
                  onChange={(e) => setDtForm((prev) => ({ ...prev, penyebab: e.target.value }))}
                />
              </div>
              <div className="field col-span-1 sm:col-span-2">
                <label>Countermeasure</label>
                <Input
                  type="text"
                  value={dtForm.countermeasure}
                  onChange={(e) => setDtForm((prev) => ({ ...prev, countermeasure: e.target.value }))}
                />
              </div>
            </div>
            <div className="form-actions flex gap-2 justify-end mt-4">
              <Button type="button" variant="ghost" onClick={cancelDowntime}>Batal</Button>
              <Button type="submit">
                {editingDowntimeId ? "Simpan Perubahan" : "Simpan Data"}
              </Button>
            </div>
          </form>
        )}
      </Card>

      <Card className="dash-panel card-glow-info">
        {/* Header & Quick Date Presets */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="dash-panel-title font-bold text-base text-slate-800">Riwayat Downtime</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Menampilkan <span className="font-semibold text-slate-700">{totalCount.toLocaleString("id-ID")}</span> baris riwayat downtime.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {downtimeFilterProductionId && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 border border-blue-200 text-blue-700 font-medium mr-2">
                <span>Filter baris: <b>{downtimeFilterLabel}</b></span>
                <button
                  type="button"
                  onClick={clearDowntimeFilter}
                  className="hover:text-blue-900 cursor-pointer ml-1 inline-flex items-center"
                  title="Hapus filter baris produksi"
                >
                  <X size={13} />
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={handleDtBulanIni}
              className="font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer bg-transparent border-0"
            >
              Bulan Ini
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={handleDtSemuaWaktu}
              className="font-semibold text-slate-600 hover:text-slate-700 hover:underline cursor-pointer bg-transparent border-0"
            >
              Semua Waktu
            </button>
            {(dtTanggalDari || dtTanggalSampai || dtKategori || dtSearch || downtimeFilterProductionId) && (
              <>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={resetDtFilter}
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
              value={dtTanggalDari}
              onChange={(e) => setDtTanggalDari(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
          <div className="field">
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Sampai Tanggal</label>
            <Input
              type="date"
              value={dtTanggalSampai}
              onChange={(e) => setDtTanggalSampai(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
          <div className="field">
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Kategori</label>
            <Select
              value={dtKategori}
              onChange={(e) => setDtKategori(e.target.value)}
              className="h-9 text-xs"
            >
              <option value="">Semua Kategori</option>
              {config.kategoriOptions.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </Select>
          </div>
          <div className="field">
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Cari Downtime</label>
            <div className="relative">
              <Input
                type="text"
                placeholder="Cari problem, penyebab, stasiun..."
                value={dtSearch}
                onChange={(e) => setDtSearch(e.target.value)}
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
              <span className="text-xs font-medium text-slate-600">Memuat data downtime...</span>
            </div>
          )}

          <table>
            <thead>
              <tr>
                {config.stationConfig.mode !== "none" && <th>Stasiun</th>}
                <th>Waktu Awal</th>
                <th>Waktu Akhir</th>
                <th>Durasi</th>
                <th>Kategori</th>
                <th>Problem</th>
                <th>Penyebab</th>
                <th>Countermeasure</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {downtimeRowsFiltered().map((row) => (
                <tr
                  key={row.id}
                  style={row._pending ? { opacity: 0.65 } : undefined}
                  className={canEditDowntime ? "row-clickable" : ""}
                  onClick={canEditDowntime ? () => editDowntime(row) : undefined}
                >
                  {config.stationConfig.mode !== "none" && <td>{row.stasiun || "-"}</td>}
                  <td className="mono">
                    {fmt(row.waktu_awal)}
                    {row._pending && (
                      <span style={{ marginLeft: 4, fontSize: "0.65rem", background: "var(--status-warn-bg)", color: "var(--status-warn)", border: "1px solid var(--status-warn)", borderRadius: 4, padding: "1px 5px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                        Belum tersinkron
                      </span>
                    )}
                  </td>
                  <td className="mono">{fmt(row.waktu_akhir)}</td>
                  <td className="mono">{durasiMenit(row.waktu_awal, row.waktu_akhir)}</td>
                  <td><span className="badge">{row.kategori || "-"}</span></td>
                  <td title={row.problem || "-"}>{row.problem || "-"}</td>
                  <td title={row.penyebab || "-"}>{row.penyebab || "-"}</td>
                  <td title={row.countermeasure || "-"}>{row.countermeasure || "-"}</td>
                  <td>
                    {!row._pending && (
                      <div className="flex gap-1.5">
                        {canEditDowntime && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            title="Edit baris downtime ini"
                            onClick={(e) => {
                              e.stopPropagation();
                              editDowntime(row);
                            }}
                          >
                            <Pencil size={13} />
                          </Button>
                        )}
                        {(canDeleteRow ? canDeleteRow(row) : isLeaderOrAdmin) && (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            title="Hapus baris downtime ini"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteDowntime(row.id);
                            }}
                          >
                            <X size={13} />
                          </Button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {downtimeRowsFiltered().length === 0 && !isLoading && (
                <tr>
                  <td colSpan={config.stationConfig.mode !== "none" ? 9 : 8} className="text-center text-muted-foreground py-8">
                    {downtimeFilterProductionId
                      ? "Tidak ada catatan downtime untuk baris produksi ini."
                      : "Belum ada catatan downtime yang cocok dengan filter."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Pagination Toolbar */}
        {(() => {
          const safeCurrentPage = Math.min(Math.max(1, currentPage), Math.max(1, totalPages));
          const startIndex = (safeCurrentPage - 1) * pageSize;
          const endIndex = Math.min(startIndex + downtimeRowsFiltered().length, totalCount);

          return (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 mt-3 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span>
                  Menampilkan {totalCount === 0 ? 0 : startIndex + 1} - {endIndex} dari {totalCount.toLocaleString("id-ID")} entri
                </span>
                <span className="text-slate-300">|</span>
                <div className="flex items-center gap-1.5">
                  <span>Baris per halaman:</span>
                  <Select
                    value={String(pageSize)}
                    onChange={(e) => onPageSizeChange(Number(e.target.value))}
                    className="h-8 text-xs w-[75px]"
                  >
                    <option value="25">25</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </Select>
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
          );
        })()}
      </Card>
    </div>
  );
}
