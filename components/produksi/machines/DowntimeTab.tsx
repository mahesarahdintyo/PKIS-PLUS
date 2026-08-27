"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Play, Square, FilterX } from "lucide-react";
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
  dtState: "idle" | "running" | "stopped";
  dtStart: string | null;
  dtEnd: string | null;
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
}

export default function DowntimeTab({
  config,
  isLeaderOrAdmin,
  dtState,
  dtStart,
  dtEnd,
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
}: DowntimeTabProps) {
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
              <div className="field" style={{ gridColumn: "span 2" }}>
                <label>Problem</label>
                <ProblemCombobox
                  options={problemList.map((p) => p.value)}
                  value={dtForm.problem}
                  onChange={(v) => setDtForm((prev) => ({ ...prev, problem: v }))}
                />
              </div>
              <div className="field" style={{ gridColumn: "span 2" }}>
                <label>Penyebab</label>
                <Input
                  type="text"
                  value={dtForm.penyebab}
                  onChange={(e) => setDtForm((prev) => ({ ...prev, penyebab: e.target.value }))}
                />
              </div>
              <div className="field" style={{ gridColumn: "span 2" }}>
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
        <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
          <h3 className="dash-panel-title font-bold text-base mb-0">
            Riwayat Downtime <span className="count">{downtimeRowsFiltered().length} baris</span>
          </h3>
          {downtimeFilterProductionId && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Filter aktif: <b className="text-[var(--text)]">{downtimeFilterLabel}</b></span>
              <Button type="button" variant="ghost" size="sm" onClick={clearDowntimeFilter}>
                <FilterX size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} /> Hapus Filter
              </Button>
            </div>
          )}
        </div>
        <div className="table-wrap">
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
                <tr key={row.id} style={row._pending ? { opacity: 0.65 } : undefined}>
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
                    {isLeaderOrAdmin && !row._pending && (
                      <div className="flex gap-1">
                        <Button type="button" variant="ghost" size="sm" onClick={() => editDowntime(row)}>Edit</Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => deleteDowntime(row.id)}>Hapus</Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {downtimeRowsFiltered().length === 0 && (
                <tr>
                  <td colSpan={config.stationConfig.mode !== "none" ? 9 : 8} className="text-center text-muted-foreground py-6">
                    {downtimeFilterProductionId
                      ? "Tidak ada catatan downtime untuk baris produksi ini."
                      : "Belum ada catatan downtime."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
