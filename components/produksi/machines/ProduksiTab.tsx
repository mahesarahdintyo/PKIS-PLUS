"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import {
  Play,
  Square,
  CheckCircle,
  Wrench,
  Timer,
  Pencil,
  X,
  Clock,
  Plus,
  Calendar,
} from "lucide-react";
import type {
  ProdMachineConfig,
  ProdMasterPart,
  ProdProductionPlanning,
  ProdProductionLogRow,
  ProdNonProduksiType,
} from "@/types/produksi";

function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getLocalTimeString(d: Date = new Date()): string {
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function parseDateTimeString(dtStr?: string): { date: string; time: string } {
  if (!dtStr) {
    return { date: getLocalDateString(), time: "" };
  }
  if (dtStr.includes("T")) {
    const [d, t] = dtStr.split("T");
    return { date: d || getLocalDateString(), time: (t || "").slice(0, 5) };
  }
  return { date: getLocalDateString(), time: dtStr.slice(0, 5) };
}

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
  const handleDateChange = (
    stId: string,
    form: { part_number: string; qty_rencana: number | ""; jam_mulai: string; jam_selesai: string },
    newDate: string
  ) => {
    const dateStr = newDate || getLocalDateString();
    const mulaiP = parseDateTimeString(form.jam_mulai);
    const selesaiP = parseDateTimeString(form.jam_selesai);
    const newMulai = mulaiP.time ? `${dateStr}T${mulaiP.time}` : "";
    const newSelesai = selesaiP.time ? `${dateStr}T${selesaiP.time}` : "";
    setNewPlanningForm((prev) => ({
      ...prev,
      [stId]: {
        ...form,
        jam_mulai: newMulai,
        jam_selesai: newSelesai,
      },
    }));
  };

  const handleSetDate = (
    stId: string,
    form: { part_number: string; qty_rencana: number | ""; jam_mulai: string; jam_selesai: string },
    offsetDays: number
  ) => {
    const target = new Date();
    if (offsetDays !== 0) {
      target.setDate(target.getDate() + offsetDays);
    }
    const targetDateStr = getLocalDateString(target);
    const mulaiP = parseDateTimeString(form.jam_mulai);
    const selesaiP = parseDateTimeString(form.jam_selesai);
    const newMulai = `${targetDateStr}T${mulaiP.time || getLocalTimeString(new Date())}`;
    const newSelesai = selesaiP.time ? `${targetDateStr}T${selesaiP.time}` : "";
    setNewPlanningForm((prev) => ({
      ...prev,
      [stId]: {
        ...form,
        jam_mulai: newMulai,
        jam_selesai: newSelesai,
      },
    }));
  };

  const handleTimeChange = (
    stId: string,
    form: { part_number: string; qty_rencana: number | ""; jam_mulai: string; jam_selesai: string },
    field: "jam_mulai" | "jam_selesai",
    timeVal: string,
    existingDate: string
  ) => {
    const dateStr = existingDate || getLocalDateString();
    const fullDt = timeVal ? `${dateStr}T${timeVal}` : "";
    setNewPlanningForm((prev) => ({
      ...prev,
      [stId]: { ...form, [field]: fullDt },
    }));
  };

  const handleSetNow = (
    stId: string,
    form: { part_number: string; qty_rencana: number | ""; jam_mulai: string; jam_selesai: string }
  ) => {
    const now = new Date();
    const nowDt = `${getLocalDateString(now)}T${getLocalTimeString(now)}`;
    setNewPlanningForm((prev) => ({
      ...prev,
      [stId]: { ...form, jam_mulai: nowDt },
    }));
  };

  const handleAddDuration = (
    stId: string,
    form: { part_number: string; qty_rencana: number | ""; jam_mulai: string; jam_selesai: string },
    minutes: number
  ) => {
    const baseDate = form.jam_mulai ? new Date(form.jam_mulai) : new Date();
    const endDt = new Date(baseDate.getTime() + minutes * 60 * 1000);
    const endDtStr = `${getLocalDateString(endDt)}T${getLocalTimeString(endDt)}`;
    const startDtStr = form.jam_mulai || `${getLocalDateString(baseDate)}T${getLocalTimeString(baseDate)}`;
    setNewPlanningForm((prev) => ({
      ...prev,
      [stId]: {
        ...form,
        jam_mulai: startDtStr,
        jam_selesai: endDtStr,
      },
    }));
  };

  const handleSetShift = (
    stId: string,
    form: { part_number: string; qty_rencana: number | ""; jam_mulai: string; jam_selesai: string },
    startH: number,
    startM: number,
    endH: number,
    endM: number,
    baseDateStr?: string,
    crossDay: boolean = false
  ) => {
    const dStr = baseDateStr || getLocalDateString();
    const startStr = `${dStr}T${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}`;
    let endDStr = dStr;
    if (crossDay) {
      const baseD = new Date(dStr + "T00:00:00");
      const nextDay = new Date(baseD.getTime() + 24 * 60 * 60 * 1000);
      endDStr = getLocalDateString(nextDay);
    }
    const endStr = `${endDStr}T${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
    setNewPlanningForm((prev) => ({
      ...prev,
      [stId]: {
        ...form,
        jam_mulai: startStr,
        jam_selesai: endStr,
      },
    }));
  };

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
            <p className="hint text-xs text-muted-foreground mb-4">
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
                      <p className="text-[11px] font-mono text-muted-foreground">
                        Jeda: {fmtClock(line.gapInfo.gapStart)} → {fmtClock(line.gapInfo.gapEnd)}
                      </p>
                    )}
                    <div className="field">
                      <label className="text-[11px] block text-muted-foreground mb-1">Jenis Non-Produksi</label>
                      <Select
                        className="text-xs h-9"
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
                        <p className="text-[11px] text-muted-foreground">Rencana produksi:</p>
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
                    <p className="text-[11px] text-muted-foreground">
                      Pilih dari Planning kalau ada, atau pilih Part Number lain di bawah.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="field col-span-2">
                        <label className="text-[11px] block text-muted-foreground mb-1 font-semibold uppercase tracking-wider">
                          Part Number
                        </label>
                        <Combobox
                          className="w-full"
                          inputClassName="h-9 text-xs font-semibold"
                          placeholder="Pilih / ketik Part Number..."
                          value={line.form.part_number}
                          onChange={(v) => linesHook.setFormField(st.id, "part_number", v)}
                          options={masterParts.map((part) => {
                            const partNumber = part.kode_part || part.value || part.nama_part || "";
                            return {
                              value: partNumber,
                              label: part.nama_part && part.nama_part !== partNumber ? `${partNumber} - ${part.nama_part}` : partNumber,
                            };
                          })}
                        />
                      </div>
                      <div className="field">
                        <label className="text-[11px] block text-muted-foreground mb-1 font-semibold uppercase tracking-wider">
                          Qty
                        </label>
                        <Input
                          type="number"
                          className="h-9 text-xs font-semibold"
                          value={line.form.qty}
                          onChange={(e) => linesHook.setFormField(st.id, "qty", e.target.value === "" ? "" : Number(e.target.value))}
                        />
                      </div>
                      <div className="field">
                        <label className="text-[11px] block text-muted-foreground mb-1 font-semibold uppercase tracking-wider">
                          Jumlah MP
                        </label>
                        <Input
                          type="number"
                          className="h-9 text-xs font-semibold"
                          value={line.form.manpower}
                          onChange={(e) => linesHook.setFormField(st.id, "manpower", e.target.value === "" ? "" : Number(e.target.value))}
                        />
                      </div>
                      {config.extraFields.map((f) => (
                        <div className="field" key={f.key}>
                          <label className="text-[11px] block text-muted-foreground mb-1 font-semibold uppercase tracking-wider">
                            {f.label}
                          </label>
                          <Input
                            type={f.type}
                            className="h-9 text-xs font-semibold"
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
                      className="w-full h-9 text-xs font-semibold bg-blue-600 hover:bg-blue-700 active:scale-95 transition"
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
                      <label className="text-[11px] block text-muted-foreground mb-1">Jenis</label>
                      <Select
                        className="text-xs h-9"
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
                    <p className="text-[11px] text-muted-foreground">
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
              <div className={isLeaderOrAdmin ? "planning-actual-grid" : "planning-actual-grid planning-actual-grid--operator"}>
                {/* Kolom Kiri: PLANNING PRODUKSI - hanya admin/leader */}
                {isLeaderOrAdmin && <div className="planning-col">
                  <p className="panel-subtitle">PLANNING PRODUKSI</p>

                  {/* Touch & Tablet Friendly Planning Form */}
                  {(() => {
                    const mulaiParsed = parseDateTimeString(form.jam_mulai);
                    const selesaiParsed = parseDateTimeString(form.jam_selesai);

                    return (
                      <div className="p-3 bg-muted/20 dark:bg-muted/10 rounded-xl border border-border/60 mb-3 space-y-2.5">
                        {/* Baris 1: Part Number & Qty */}
                        <div className="flex gap-2 items-center">
                          <div className="flex-1 min-w-0">
                            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                              Part Number
                            </label>
                            <Combobox
                              className="w-full"
                              inputClassName="h-9 text-xs font-semibold"
                              placeholder="Pilih / ketik Part Number..."
                              value={form.part_number}
                              onChange={(v) =>
                                setNewPlanningForm((prev) => ({
                                  ...prev,
                                  [st.id]: { ...form, part_number: v },
                                }))
                              }
                              options={masterParts.map((p) => {
                                const val = p.kode_part || p.value || "";
                                return {
                                  value: val,
                                  label: p.nama_part && p.nama_part !== val ? `${val} - ${p.nama_part}` : val,
                                };
                              })}
                            />
                          </div>

                          <div className="w-24 sm:w-28 shrink-0">
                            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                              Qty (pcs)
                            </label>
                            <Input
                              type="number"
                              placeholder="0"
                              className="h-9 text-xs font-semibold"
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
                          </div>
                        </div>

                        {/* Baris 2: Tanggal Produksi */}
                        <div className="pt-1 border-t border-border/40">
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                              <Calendar size={11} className="text-indigo-400" /> Tanggal Produksi
                            </label>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => handleSetDate(st.id, form, 0)}
                                className="text-[10px] font-medium text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-1.5 py-0.5 rounded cursor-pointer active:scale-95 transition"
                              >
                                Hari Ini
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSetDate(st.id, form, 1)}
                                className="text-[10px] font-medium text-muted-foreground hover:text-foreground bg-muted hover:bg-muted-foreground/20 px-1.5 py-0.5 rounded cursor-pointer active:scale-95 transition"
                              >
                                Besok
                              </button>
                            </div>
                          </div>
                          <Input
                            type="date"
                            className="h-9 text-xs font-mono font-semibold bg-background"
                            value={mulaiParsed.date}
                            onChange={(e) => handleDateChange(st.id, form, e.target.value)}
                          />
                        </div>

                        {/* Baris 3: Waktu (Jam Mulai & Jam Selesai) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {/* Jam Mulai */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center">
                              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                <Clock size={11} className="text-blue-400" /> Jam Mulai
                              </label>
                              <button
                                type="button"
                                onClick={() => handleSetNow(st.id, form)}
                                className="text-[10px] font-medium text-blue-400 hover:text-blue-300 active:scale-95 transition flex items-center gap-0.5 bg-blue-500/10 hover:bg-blue-500/20 px-1.5 py-0.5 rounded cursor-pointer"
                              >
                                ⚡ Sekarang
                              </button>
                            </div>
                            <Input
                              type="time"
                              className="h-9 text-xs font-mono font-semibold bg-background"
                              value={mulaiParsed.time}
                              onChange={(e) => handleTimeChange(st.id, form, 'jam_mulai', e.target.value, mulaiParsed.date)}
                            />
                          </div>

                          {/* Jam Selesai */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center">
                              <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                <Clock size={11} className="text-emerald-400" /> Jam Selesai
                              </label>
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleAddDuration(st.id, form, 30)}
                                  className="text-[10px] font-medium text-muted-foreground hover:text-foreground bg-muted hover:bg-muted-foreground/20 active:scale-95 transition px-1.5 py-0.5 rounded cursor-pointer"
                                >
                                  +30m
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAddDuration(st.id, form, 60)}
                                  className="text-[10px] font-medium text-muted-foreground hover:text-foreground bg-muted hover:bg-muted-foreground/20 active:scale-95 transition px-1.5 py-0.5 rounded cursor-pointer"
                                >
                                  +1j
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleAddDuration(st.id, form, 120)}
                                  className="text-[10px] font-medium text-muted-foreground hover:text-foreground bg-muted hover:bg-muted-foreground/20 active:scale-95 transition px-1.5 py-0.5 rounded cursor-pointer"
                                >
                                  +2j
                                </button>
                              </div>
                            </div>
                            <Input
                              type="time"
                              className="h-9 text-xs font-mono font-semibold bg-background"
                              value={selesaiParsed.time}
                              onChange={(e) => handleTimeChange(st.id, form, 'jam_selesai', e.target.value, selesaiParsed.date || mulaiParsed.date)}
                            />
                          </div>
                        </div>

                        {/* Baris 4: Quick Shift Presets & Tombol Tambah */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-border/40">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-muted-foreground mr-0.5">Shift:</span>
                            <button
                              type="button"
                              onClick={() => handleSetShift(st.id, form, 7, 30, 16, 30, mulaiParsed.date)}
                              className="text-[10px] px-2 py-1 rounded bg-secondary/80 hover:bg-secondary active:scale-95 transition font-medium cursor-pointer"
                            >
                              S1 (07:30-16:30)
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSetShift(st.id, form, 16, 30, 0, 30, mulaiParsed.date, true)}
                              className="text-[10px] px-2 py-1 rounded bg-secondary/80 hover:bg-secondary active:scale-95 transition font-medium cursor-pointer"
                            >
                              S2 (16:30-00:30)
                            </button>
                          </div>

                          <Button
                            type="button"
                            size="sm"
                            className="h-9 px-4 text-xs font-semibold bg-blue-600 hover:bg-blue-700 active:scale-95 transition ml-auto flex items-center gap-1.5 cursor-pointer"
                            onClick={() => handleAddPlanning(st.id)}
                          >
                            <Plus size={14} /> Tambah Plan
                          </Button>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="planning-list">
                    {stPlanning.map((p) => (
                      <div
                        key={p.id}
                        className={`planning-item ${p.status === "selesai" ? "planning-done" : ""}`}
                        style={p._pending ? { opacity: 0.65 } : undefined}
                      >
                        <span className="font-semibold">{p.part_number}</span>
                        {p._pending && (
                          <span style={{ marginLeft: 4, fontSize: "0.65rem", background: "var(--status-warn-bg)", color: "var(--status-warn)", border: "1px solid var(--status-warn)", borderRadius: 4, padding: "1px 5px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                            Belum tersinkron
                          </span>
                        )}
                        <span className="hint text-xs text-muted-foreground">
                          {p.qty_rencana ? `${p.qty_rencana}pcs` : "-"} · {fmtClock(p.jam_rencana_mulai)}-{fmtClock(p.jam_rencana_selesai)}
                        </span>
                        {p.id && !p._pending && (
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
                      <p className="empty-state text-xs text-muted-foreground py-4 text-center">
                        Belum ada rencana.
                      </p>
                    )}
                  </div>
                </div>}

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
                        <span className="hint text-xs text-muted-foreground">
                          {r.qty ?? "-"}pcs · {fmtClock(r.waktu_awal)}-{fmtClock(r.waktu_akhir)}
                        </span>
                        {isLeaderOrAdmin && r.id && !r._pending && (
                          <div className="flex gap-1 ml-auto shrink-0">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="px-1.5 py-0.5 text-xs"
                              title="Edit baris produksi ini"
                              onClick={(e) => { e.stopPropagation(); handleEditProductionRow(r); }}
                            >
                              <Pencil size={12} />
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="px-1.5 py-0.5 text-xs"
                              title="Hapus baris produksi ini"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRiwayatDeleteTarget({
                                  jenis: "produksi",
                                  waktu_awal: r.waktu_awal,
                                  waktu_akhir: r.waktu_akhir,
                                  part_number: r.part_number,
                                  data: r,
                                });
                              }}
                            >
                              <X size={12} />
                            </Button>
                          </div>
                        )}
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
        <p className="hint text-xs text-muted-foreground mb-3">
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
