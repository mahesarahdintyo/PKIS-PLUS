"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Play,
  Square,
  CheckCircle,
  Wrench,
  Timer,
  Pencil,
  X,
} from "lucide-react";
import type {
  ProdMachineConfig,
  ProdMasterPart,
  ProdProductionPlanning,
  ProdProductionLogRow,
  ProdNonProduksiType,
} from "@/types/produksi";

interface ProduksiTabProps {
  config: ProdMachineConfig;
  tandemVariant: "lama" | "baru" | null;
  setTandemVariant: (v: "lama" | "baru" | null) => void;
  stationList: () => { id: string; label: string | null }[];
  dbStasiun: (stationId: string) => string | null;
  linesHook: any;
  planningList: ProdProductionPlanning[];
  productionRows: ProdProductionLogRow[];
  masterParts: ProdMasterPart[];
  nonProduksiTypes: ProdNonProduksiType[];
  newPlanningForm: Record<string, {
    part_number: string;
    qty_rencana: number | "";
    jam_mulai: string;
    jam_selesai: string;
  }>;
  setNewPlanningForm: React.Dispatch<
    React.SetStateAction<
      Record<
        string,
        {
          part_number: string;
          qty_rencana: number | "";
          jam_mulai: string;
          jam_selesai: string;
        }
      >
    >
  >;
  handleAddPlanning: (stId: string) => Promise<void>;
  handleDeletePlanning: (id: string) => Promise<void>;
  riwayatHariIni: any[];
  isLeaderOrAdmin: boolean;
  canDeleteRow: (row: any) => boolean;
  handleEditProductionRow: (data: any) => void;
  handleEditNonProduksiRow: (data: any) => void;
  handleViewDowntimeForProduction: (row: any) => void;
  setRiwayatDeleteTarget: (row: any) => void;
  fmt: (iso?: string | null) => string;
  fmtClock: (iso?: string | null) => string;
  fmtNum: (n: number | null | undefined) => string;
  earnedMenit: (row: any) => number | null;
  operationMenit: (row: any) => number | null;
  rowAvailability: (row: any) => number | null;
  availabilityHint: (row: any) => string;
}

export default function ProduksiTab({
  config,
  tandemVariant,
  setTandemVariant,
  stationList,
  dbStasiun,
  linesHook,
  planningList,
  productionRows,
  masterParts,
  nonProduksiTypes,
  newPlanningForm,
  setNewPlanningForm,
  handleAddPlanning,
  handleDeletePlanning,
  riwayatHariIni,
  isLeaderOrAdmin,
  canDeleteRow,
  handleEditProductionRow,
  handleEditNonProduksiRow,
  handleViewDowntimeForProduction,
  setRiwayatDeleteTarget,
  fmt,
  fmtClock,
  fmtNum,
  earnedMenit,
  operationMenit,
  rowAvailability,
  availabilityHint,
}: ProduksiTabProps) {
  return (
    <div>
      {/* Pemilihan Line untuk Tandem */}
      {config.stationConfig.mode === "variant" && (
        <div className="mb-4">
          {!tandemVariant ? (
            <Card className="dash-panel card-glow-info mb-4 p-4">
              <p className="dash-panel-title font-bold text-base mb-3">Pilih Line Tandem</p>
              <div className="chip-row flex gap-3">
                <Button type="button" onClick={() => setTandemVariant("lama")}>
                  TDM Lama (PA-1 s/d PA-5)
                </Button>
                <Button type="button" onClick={() => setTandemVariant("baru")}>
                  TDM Baru (PA-6 s/d PA-10)
                </Button>
              </div>
            </Card>
          ) : (
            <p className="hint text-xs text-[var(--muted)] mb-4">
              Line aktif: <b>{tandemVariant === "lama" ? "TDM Lama (PA-1 s/d PA-5)" : "TDM Baru (PA-6 s/d PA-10)"}</b>
              {" — "}
              <a
                href="#"
                className="underline text-blue-400"
                onClick={(e) => {
                  e.preventDefault();
                  setTandemVariant(null);
                }}
              >
                ganti line
              </a>
            </p>
          )}
        </div>
      )}

      {/* Cards per Stasiun */}
      <div className="space-y-6">
        {stationList().map((st) => {
          const line = linesHook.getLine(st.id);
          const targetSt = dbStasiun(st.id);
          const stPlanning = planningList.filter(
            (p) => (p.stasiun || null) === targetSt
          );
          const todayStr = new Date().toISOString().slice(0, 10);
          const stActualToday = productionRows.filter(
            (p) => (p.stasiun || null) === targetSt && String(p.waktu_awal).slice(0, 10) === todayStr
          );

          const form = newPlanningForm[st.id] || { part_number: "", qty_rencana: "", jam_mulai: "", jam_selesai: "" };
          const stationGlow = line.phase === "running" ? "card-glow-good"
            : (line.phase === "awaiting_gap" || line.phase === "awaiting_actual_start" || line.phase === "awaiting_next_choice" || line.phase === "nonproduksi_running") ? "card-glow-warn"
            : "card-glow-info";

          return (
            <Card key={st.id} className={`dash-panel station-card ${stationGlow}`}>
              <div className="flex justify-between items-center mb-4">
                {st.label && (
                  <p className="dash-panel-title font-bold text-base mb-0">{st.label}</p>
                )}
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-teal-900/40 text-teal-300 border border-teal-700/50">
                  {line.phase}
                </span>
              </div>

              {/* Aksi sesuai fase state machine */}
              <div className="mb-5">
                {line.phase === "idle" && (
                  <Button
                    type="button"
                    className="btn-pulse"
                    onClick={() => linesHook.clickMulai(st.id)}
                  >
                    <Play size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} /> Mulai Produksi
                  </Button>
                )}
                {line.phase === "awaiting_gap" && (
                  <div className="space-y-2 p-2.5 rounded bg-amber-950/20 border border-amber-500/40">
                    <p className="font-bold text-xs text-amber-400 flex items-center gap-1">
                      <span><Timer size={13} style={{ display: "inline", verticalAlign: "middle" }} /></span> Ada jeda sebelum ini — jenis non-produksi apa?
                    </p>
                    {line.gapInfo && (
                      <p className="text-[11px] font-mono text-[var(--muted)]">
                        Jeda: {fmtClock(line.gapInfo.gapStart)} → {fmtClock(line.gapInfo.gapEnd)}
                      </p>
                    )}
                    <div className="field">
                      <label className="text-[11px] block text-[var(--muted)] mb-1">Jenis Non-Produksi</label>
                      <Select
                        className="text-xs h-8"
                        value={line.gapForm.nonproduksi_nama}
                        onChange={(e) => linesHook.setGapFormField(st.id, "nonproduksi_nama", e.target.value)}
                      >
                        <option value="">- pilih -</option>
                        {nonProduksiTypes.map((t) => (
                          <option key={t.id} value={t.nama}>
                            {t.nama}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => linesHook.cancelGapNonProduksi(st.id)}
                      >
                        Batal
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => linesHook.confirmGapNonProduksi(st.id)}
                      >
                        Konfirmasi
                      </Button>
                    </div>
                  </div>
                )}
                {line.phase === "awaiting_next_choice" && (
                  <div className="space-y-2 p-2.5 rounded bg-amber-950/20 border border-amber-500/40">
                    <p className="font-bold text-xs text-amber-400 flex items-center gap-1">
                      <span><Timer size={13} style={{ display: "inline", verticalAlign: "middle" }} /></span> Non-produksi selesai — lanjut apa?
                    </p>
                    <div className="flex gap-2 pt-1">
                      <Button
                        type="button"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => linesHook.chooseAfterNonProduksi(st.id, "setup")}
                      >
                        <Wrench size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} /> Setup (Dandori)
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => linesHook.chooseAfterNonProduksi(st.id, "direct")}
                      >
                        <Play size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} /> Langsung Produksi
                      </Button>
                    </div>
                  </div>
                )}
                {line.phase === "awaiting_actual_start" && (
                  <div className="space-y-2">
                    <p className="text-xs text-amber-300 font-semibold flex items-center justify-between gap-2">
                      <span>
                        {line.skipDandori
                          ? "Langsung produksi (tanpa dandori)"
                          : `Dandori sejak ${fmtClock(line.entryStart)}`}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => linesHook.cancelLine(st.id)}
                      >
                        Batal
                      </Button>
                    </p>
                    {stPlanning.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-[11px] text-[var(--muted)]">Rencana produksi:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {stPlanning.map((plan) => (
                            <button
                              key={plan.id || `${plan.part_number}-${plan.jam_rencana_mulai}`}
                              type="button"
                              className={`chip text-xs ${line.planningId === plan.id ? "chip-active" : ""}`}
                              onClick={() => linesHook.choosePlannedPart(st.id, plan)}
                            >
                              {plan.part_number}
                              {plan.qty_rencana ? ` (${fmtNum(plan.qty_rencana)})` : ""}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <p className="text-[11px] text-[var(--muted)]">
                      Pilih dari Planning kalau ada, atau pilih Part Number lain di bawah.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="field col-span-2">
                        <label className="text-[11px] block text-[var(--muted)] mb-1">Part Number</label>
                        <Select
                          className="text-xs h-8"
                          value={line.form.part_number}
                          onChange={(e) => linesHook.setFormField(st.id, "part_number", e.target.value)}
                        >
                          <option value="">- Pilih Part Number -</option>
                          {masterParts.map((part) => {
                            const partNumber = part.kode_part || part.value || part.nama_part;
                            return (
                              <option key={part.id || partNumber} value={partNumber}>
                                {partNumber}{part.nama_part && part.nama_part !== partNumber ? ` - ${part.nama_part}` : ""}
                              </option>
                            );
                          })}
                        </Select>
                      </div>
                      <div className="field">
                        <label className="text-[11px] block text-[var(--muted)] mb-1">Qty</label>
                        <Input
                          type="number"
                          className="h-8 text-xs"
                          value={line.form.qty}
                          onChange={(e) => linesHook.setFormField(st.id, "qty", e.target.value === "" ? "" : Number(e.target.value))}
                        />
                      </div>
                      <div className="field">
                        <label className="text-[11px] block text-[var(--muted)] mb-1">Jumlah MP</label>
                        <Input
                          type="number"
                          className="h-8 text-xs"
                          value={line.form.manpower}
                          onChange={(e) => linesHook.setFormField(st.id, "manpower", e.target.value === "" ? "" : Number(e.target.value))}
                        />
                      </div>
                      {config.extraFields.map((f) => (
                        <div className="field" key={f.key}>
                          <label className="text-[11px] block text-[var(--muted)] mb-1">{f.label}</label>
                          <Input
                            type={f.type}
                            className="h-8 text-xs"
                            value={line.form[f.key] ?? ""}
                            onChange={(e) =>
                              linesHook.setFormField(
                                st.id,
                                f.key,
                                f.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value
                              )
                            }
                          />
                        </div>
                      ))}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => linesHook.confirmActualStart(st.id)}
                    >
                      <CheckCircle size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} /> Konfirmasi Produksi Mulai
                    </Button>
                  </div>
                )}
                {line.phase === "running" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-[var(--text)]">
                      Produksi <b>{line.form.part_number}</b> — mulai aktual <b>{fmtClock(line.actualStartConfirmedAt)}</b>
                    </span>
                    <Button
                      type="button"
                      variant="destructive"
                      className="btn-pulse-danger flex items-center justify-center gap-1"
                      onClick={() => linesHook.stopProduksi(st.id)}
                    >
                      <Square size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} /> Selesai Produksi
                    </Button>
                  </div>
                )}
                {line.phase === "finished" && (
                  <div className="space-y-2 p-2.5 rounded bg-teal-950/20 border border-teal-500/40">
                    <p className="font-bold text-xs text-teal-300">
                      Selesai jam {fmtClock(line.entryEnd)} — lanjut apa?
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => linesHook.chooseSetupNext(st.id)}
                      >
                        <Wrench size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} /> Setup (ganti part)
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => linesHook.chooseNonProduksiNext(st.id)}
                      >
                        Non-Produksi
                      </Button>
                    </div>
                  </div>
                )}
                {line.phase === "nonproduksi_running" && (
                  <div className="space-y-2 p-2.5 rounded bg-amber-950/20 border border-amber-500/40">
                    <p className="font-bold text-xs text-amber-400 flex items-center gap-1">
                      <span><Timer size={13} style={{ display: "inline", verticalAlign: "middle" }} /></span> Non-Produksi sejak {fmtClock(line.nonProdActiveStart)}
                    </p>
                    <div className="field">
                      <label className="text-[11px] block text-[var(--muted)] mb-1">Jenis</label>
                      <Select
                        className="text-xs h-8"
                        value={line.nonProdForm.nama}
                        onChange={(e) => linesHook.setNonProdFormField(st.id, "nama", e.target.value)}
                      >
                        <option value="">- pilih -</option>
                        {nonProduksiTypes.map((t) => (
                          <option key={t.id} value={t.nama}>
                            {t.nama}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <p className="text-[11px] text-[var(--muted)]">
                      &quot;Mulai Produksi&quot; kalau part berikutnya mau dikerjakan sekarang (otomatis menutup non-produksi ini). &quot;Selesai (Tutup Shift)&quot; kalau mesin memang berhenti beroperasi sampai shift berikutnya.
                    </p>
                    <div className="flex gap-2 pt-1">
                      <Button
                        type="button"
                        size="sm"
                        className="btn-pulse flex-1 text-xs"
                        onClick={() => linesHook.clickMulai(st.id)}
                      >
                        <Play size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} /> Mulai Produksi
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => linesHook.endNonProduksiAndStop(st.id)}
                      >
                        <Square size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} /> Selesai (Tutup Shift)
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Planning vs Aktual Grid */}
              <div className="planning-actual-grid">
                {/* Kolom Kiri: PLANNING PRODUKSI */}
                <div className="planning-col">
                  <p className="panel-subtitle">PLANNING PRODUKSI</p>
                  {isLeaderOrAdmin && (
                    <div className="planning-add-row flex flex-wrap gap-2 mb-3 items-center">
                      <Select
                        className="text-xs h-8"
                        style={{ minWidth: "140px", flex: 1 }}
                        value={form.part_number}
                        onChange={(e) =>
                          setNewPlanningForm((prev) => ({
                            ...prev,
                            [st.id]: { ...form, part_number: e.target.value },
                          }))
                        }
                      >
                        <option value="">Part Number</option>
                        {masterParts.map((p) => {
                          const val = p.kode_part || p.value || "";
                          return (
                            <option key={p.id || val} value={val}>
                              {val}
                            </option>
                          );
                        })}
                      </Select>

                      <Input
                        type="number"
                        placeholder="Qty"
                        className="h-8 w-20 text-xs"
                        value={form.qty_rencana}
                        onChange={(e) =>
                          setNewPlanningForm((prev) => ({
                            ...prev,
                            [st.id]: {
                              ...form,
                              qty_rencana: e.target.value === "" ? "" : Number(e.target.value),
                            },
                          }))
                        }
                      />

                      <Input
                        type="datetime-local"
                        title="Jam rencana mulai"
                        className="h-8 text-xs font-mono"
                        value={form.jam_mulai}
                        onChange={(e) =>
                          setNewPlanningForm((prev) => ({
                            ...prev,
                            [st.id]: { ...form, jam_mulai: e.target.value },
                          }))
                        }
                      />

                      <Input
                        type="datetime-local"
                        title="Jam rencana selesai"
                        className="h-8 text-xs font-mono"
                        value={form.jam_selesai}
                        onChange={(e) =>
                          setNewPlanningForm((prev) => ({
                            ...prev,
                            [st.id]: { ...form, jam_selesai: e.target.value },
                          }))
                        }
                      />

                      <Button
                        type="button"
                        size="sm"
                        className="px-3 py-1.5 text-xs"
                        onClick={() => handleAddPlanning(st.id)}
                      >
                        + Add
                      </Button>
                    </div>
                  )}

                  <div className="planning-list">
                    {stPlanning.map((p) => (
                      <div
                        key={p.id}
                        className={`planning-item ${p.status === "selesai" ? "planning-done" : ""}`}
                      >
                        <span className="font-semibold">{p.part_number}</span>
                        <span className="hint text-xs text-[var(--muted)]">
                          {p.qty_rencana ? `${p.qty_rencana}pcs` : "-"} · {fmtClock(p.jam_rencana_mulai)}-{fmtClock(p.jam_rencana_selesai)}
                        </span>
                        {isLeaderOrAdmin && p.id && (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="px-1.5 py-0.5 text-xs ml-2"
                            onClick={() => handleDeletePlanning(p.id!)}
                          >
                            ✕
                          </Button>
                        )}
                      </div>
                    ))}
                    {stPlanning.length === 0 && (
                      <p className="empty-state text-xs text-[var(--muted)] py-4 text-center">
                        Belum ada rencana.
                      </p>
                    )}
                  </div>
                </div>

                {/* Kolom Kanan: AKTUAL PRODUKSI (HARI INI) */}
                <div className="planning-col">
                  <p className="panel-subtitle">AKTUAL PRODUKSI (HARI INI)</p>
                  <div className="planning-list">
                    {["awaiting_actual_start", "running"].includes(line.phase) && line.form.part_number && (
                      <div className="planning-item planning-current">
                        <span className="timer-dot timer-dot-live" />
                        <span className="font-semibold">{line.form.part_number}</span>
                        <span className="hint text-xs text-emerald-400">
                          {line.phase === "running" ? "sedang produksi" : "sedang dandori"} · mulai {fmtClock(line.entryStart)}
                        </span>
                      </div>
                    )}

                    {stActualToday.map((r, idx) => (
                      <div key={r.id || idx} className="planning-item">
                        <span className="font-semibold">{r.part_number}</span>
                        <span className="hint text-xs text-[var(--muted)]">
                          {r.qty ?? "-"}pcs · {fmtClock(r.waktu_awal)}-{fmtClock(r.waktu_akhir)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Riwayat Hari Ini */}
      <Card className="dash-panel card-glow-info mt-6">
        <p className="dash-panel-title font-bold text-base mb-1">
          Riwayat Hari Ini <span className="count">{riwayatHariIni.length} baris</span>
        </p>
        <p className="hint text-xs text-[var(--muted)] mb-3">
          Riwayat lengkap semua tanggal ada di tab &quot;Riwayat Produksi&quot;.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th className="col-hide-mobile">Kode</th>
                {config.stationConfig.mode !== "none" && <th className="col-hide-mobile">Stasiun</th>}
                <th className="col-hide-mobile">Waktu Awal</th>
                <th className="col-hide-mobile">Waktu Akhir</th>
                <th>Part Number</th>
                <th>Qty</th>
                <th>MP</th>
                <th className="col-hide-mobile">Earned</th>
                <th className="col-hide-mobile">Operation</th>
                <th>Availability</th>
                <th>Dandori</th>
                <th>Downtime</th>
                <th>Break</th>
                {config.routingMax > 0 && <th className="col-hide-mobile">Routing</th>}
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {riwayatHariIni.map((row: any, idx) => {
                const data = row.data;
                const earned = earnedMenit(row);
                const operation = operationMenit(row);
                const availability = rowAvailability(row);
                const routing = data.extra?.routing_type
                  ? `${data.extra.routing_type}${data.extra.routing_numbers ? ` ${data.extra.routing_numbers.join(",")}` : ""}`
                  : "-";
                const canEditRowPerm = canDeleteRow(row) && (row.jenis === "produksi" || row.jenis === "non_produksi");
                const rowClick = canEditRowPerm
                  ? () => (row.jenis === "produksi" ? handleEditProductionRow(data) : handleEditNonProduksiRow(data))
                  : undefined;

                return (
                  <tr
                    key={`hari-ini-${row.jenis}-${data.id || idx}`}
                    className={canEditRowPerm ? "row-clickable" : ""}
                    onClick={rowClick}
                  >
                    <td className="mono col-hide-mobile">{row.jenis === "produksi" ? (data.kode || "-") : "-"}</td>
                    {config.stationConfig.mode !== "none" && <td className="mono col-hide-mobile">{data.stasiun || "-"}</td>}
                    <td className="mono col-hide-mobile">{fmt(row.waktu_awal)}</td>
                    <td className="mono col-hide-mobile">{fmt(row.waktu_akhir)}</td>
                    <td>{row.part_number || "-"}</td>
                    <td className="mono">{row.jenis === "produksi" ? fmtNum(data.qty) : "-"}</td>
                    <td className="mono">{row.jenis === "produksi" ? fmtNum(data.manpower) : "-"}</td>
                    <td className="mono col-hide-mobile">{earned !== null ? `${fmtNum(earned)} mnt` : "-"}</td>
                    <td className="mono col-hide-mobile">{operation !== null ? `${fmtNum(operation)} mnt` : "-"}</td>
                    <td className="mono font-bold" title={availabilityHint(row)}>
                      {availability !== null ? `${fmtNum(availability)}%` : availabilityHint(row)}
                    </td>
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
                        {row.jenis === "produksi" && canDeleteRow(row) && (
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
                        {row.jenis === "non_produksi" && canDeleteRow(row) && (
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
              {riwayatHariIni.length === 0 && (
                <tr>
                  <td colSpan={config.stationConfig.mode !== "none" ? (config.routingMax > 0 ? 15 : 14) : (config.routingMax > 0 ? 14 : 13)} className="empty-state text-center py-6">
                    Belum ada data produksi hari ini.
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
