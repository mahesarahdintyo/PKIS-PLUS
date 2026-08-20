"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type {
  ProdMachineConfig,
  ProdMasterPart,
  ProdNonProduksiType,
  ProdDowntimeProblem,
} from "@/types/produksi";

interface MasterDataTabProps {
  config: ProdMachineConfig;
  mesinSettingsDraft: {
    gsph_target_mode: "fixed" | "per_part";
    gsph_target_fixed: number | "";
    target_availability: number | "";
  };
  setMesinSettingsDraft: React.Dispatch<
    React.SetStateAction<{
      gsph_target_mode: "fixed" | "per_part";
      gsph_target_fixed: number | "";
      target_availability: number | "";
    }>
  >;
  handleSaveMesinSettings: () => Promise<void>;
  masterParts: ProdMasterPart[];
  newPartKode: string;
  setNewPartKode: (v: string) => void;
  newPartNama: string;
  setNewPartNama: (v: string) => void;
  newPartStdCt: number | "";
  setNewPartStdCt: (v: number | "") => void;
  newPartNextProcess: string;
  setNewPartNextProcess: (v: string) => void;
  newPartHarga: number | "";
  setNewPartHarga: (v: number | "") => void;
  handleAddPartNumber: (e: React.FormEvent) => Promise<void>;
  editingPartId: string | null;
  editPartForm: {
    kode_part: string;
    nama_part: string;
    std_ct: number | "";
    next_process: string;
    harga_rp: number | "";
  };
  setEditPartForm: React.Dispatch<
    React.SetStateAction<{
      kode_part: string;
      nama_part: string;
      std_ct: number | "";
      next_process: string;
      harga_rp: number | "";
    }>
  >;
  handleStartEditPartNumber: (p: ProdMasterPart) => void;
  handleSaveEditPartNumber: (id: string) => Promise<void>;
  setEditingPartId: (id: string | null) => void;
  handleDeletePartNumber: (id: string) => Promise<void>;
  nonProduksiTypes: ProdNonProduksiType[];
  newNonProduksiTypeValue: string;
  setNewNonProduksiTypeValue: (v: string) => void;
  handleAddNonProduksiType: () => Promise<void>;
  handleDeleteNonProduksiType: (id: string) => Promise<void>;
  problemList: ProdDowntimeProblem[];
  newProblemValue: string;
  setNewProblemValue: (v: string) => void;
  editingProblemId: string | null;
  editProblemValue: string;
  setEditProblemValue: (v: string) => void;
  handleAddProblem: () => Promise<void>;
  handleStartEditProblem: (p: ProdDowntimeProblem) => void;
  handleCancelEditProblem: () => void;
  handleSaveEditProblem: (id: string) => Promise<void>;
  handleDeleteProblem: (id: string) => Promise<void>;
  fmtNum: (n: number | null | undefined) => string;
}

export default function MasterDataTab({
  config,
  mesinSettingsDraft,
  setMesinSettingsDraft,
  handleSaveMesinSettings,
  masterParts,
  newPartKode,
  setNewPartKode,
  newPartNama,
  setNewPartNama,
  newPartStdCt,
  setNewPartStdCt,
  newPartNextProcess,
  setNewPartNextProcess,
  newPartHarga,
  setNewPartHarga,
  handleAddPartNumber,
  editingPartId,
  editPartForm,
  setEditPartForm,
  handleStartEditPartNumber,
  handleSaveEditPartNumber,
  setEditingPartId,
  handleDeletePartNumber,
  nonProduksiTypes,
  newNonProduksiTypeValue,
  setNewNonProduksiTypeValue,
  handleAddNonProduksiType,
  handleDeleteNonProduksiType,
  problemList,
  newProblemValue,
  setNewProblemValue,
  editingProblemId,
  editProblemValue,
  setEditProblemValue,
  handleAddProblem,
  handleStartEditProblem,
  handleCancelEditProblem,
  handleSaveEditProblem,
  handleDeleteProblem,
  fmtNum,
}: MasterDataTabProps) {
  return (
    <div className="space-y-6">
      {/* Panel 1: Target GSPH & Availability */}
      <Card className="dash-panel card-glow-info">
        <h3 className="dash-panel-title font-bold text-base mb-1">Target GSPH & Availability</h3>
        <p className="text-xs text-[var(--muted)] mb-4">
          Garis target di grafik Performance. Operator cuma bisa lihat, admin/leader yang bisa atur.
        </p>

        <div className="form-grid mb-4">
          <div className="field col-span-2">
            <label>Mode Target</label>
            <div className="chip-row flex gap-2 mt-1">
              <button
                type="button"
                className={`chip ${
                  mesinSettingsDraft.gsph_target_mode === "fixed" ? "chip-active" : ""
                }`}
                onClick={() =>
                  setMesinSettingsDraft({ ...mesinSettingsDraft, gsph_target_mode: "fixed" })
                }
              >
                Target Sama (semua tanggal)
              </button>
              <button
                type="button"
                className={`chip ${
                  mesinSettingsDraft.gsph_target_mode === "per_part" ? "chip-active" : ""
                }`}
                onClick={() =>
                  setMesinSettingsDraft({ ...mesinSettingsDraft, gsph_target_mode: "per_part" })
                }
              >
                Target per Part (dari Std CT)
              </button>
            </div>
          </div>

          {mesinSettingsDraft.gsph_target_mode === "fixed" && (
            <div className="field">
              <label>Angka Target GSPH</label>
              <Input
                type="number"
                value={mesinSettingsDraft.gsph_target_fixed}
                onChange={(e) =>
                  setMesinSettingsDraft({
                    ...mesinSettingsDraft,
                    gsph_target_fixed: e.target.value === "" ? "" : Number(e.target.value),
                  })
                }
              />
            </div>
          )}

          <div className="field">
            <label>Target Availability (%)</label>
            <Input
              type="number"
              min={0}
              max={100}
              value={mesinSettingsDraft.target_availability}
              onChange={(e) =>
                setMesinSettingsDraft({
                  ...mesinSettingsDraft,
                  target_availability: e.target.value === "" ? "" : Number(e.target.value),
                })
              }
            />
          </div>
        </div>

        <div className="form-actions">
          <Button type="button" onClick={handleSaveMesinSettings}>
            Simpan Target
          </Button>
        </div>
      </Card>

      {/* Panel 2: CRUD Part Number */}
      <Card className="dash-panel card-glow-info">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="dash-panel-title font-bold text-base">
              Daftar Part Number <span className="text-xs font-mono text-[var(--muted)]">({masterParts.length} item)</span>
            </h3>
            <p className="text-xs text-[var(--muted)]">
              Kelola master part number, cycle time, next process, dan harga per pcs.
            </p>
          </div>
        </div>

        {/* Form Tambah Part Number */}
        <form onSubmit={handleAddPartNumber} className="bg-[var(--bg)] p-4 rounded border border-[var(--border)] mb-6">
          <h4 className="text-xs font-mono font-bold uppercase mb-3 text-[var(--amber)]">+ Tambah Part Number Baru</h4>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <label className="text-xs block mb-1">Kode Part *</label>
              <Input
                type="text"
                placeholder="Kode Part"
                value={newPartKode}
                onChange={(e) => setNewPartKode(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs block mb-1">Nama Part</label>
              <Input
                type="text"
                placeholder="Nama Part"
                value={newPartNama}
                onChange={(e) => setNewPartNama(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs block mb-1">Std CT (mnt/stroke)</label>
              <Input
                type="number"
                step="0.0001"
                placeholder="mis. 0.05"
                value={newPartStdCt}
                onChange={(e) => setNewPartStdCt(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>
            <div>
              <label className="text-xs block mb-1">SPM (otomatis)</label>
              <Input
                type="text"
                disabled
                className="opacity-70 bg-black/20"
                value={newPartStdCt && Number(newPartStdCt) > 0 ? (1 / Number(newPartStdCt)).toFixed(2) : "-"}
              />
            </div>
            <div>
              <label className="text-xs block mb-1">Next Process</label>
              <Input
                type="text"
                placeholder="mis. Welding"
                value={newPartNextProcess}
                onChange={(e) => setNewPartNextProcess(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs block mb-1">Harga per Pcs (Rp)</label>
              <Input
                type="number"
                placeholder="mis. 5000"
                value={newPartHarga}
                onChange={(e) => setNewPartHarga(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </div>
            <div className="md:col-span-3 flex items-end">
              <Button type="submit" className="w-full">
                + Simpan Part Number
              </Button>
            </div>
          </div>
        </form>

        {/* Tabel Part Number */}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Kode Part</th>
                <th>Nama Part</th>
                <th>Std CT (mnt)</th>
                <th>SPM</th>
                <th>Next Process</th>
                <th>Harga (Rp)</th>
                <th className="text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {masterParts.map((p) => {
                const isEditing = editingPartId === p.id;
                const ctVal = p.std_ct ?? (p.ct_detik ? p.ct_detik / 60 : 0);
                const spmVal = ctVal && ctVal > 0 ? (1 / ctVal).toFixed(2) : "-";

                if (isEditing) {
                  return (
                    <tr key={p.id || p.kode_part}>
                      <td>
                        <Input
                          type="text"
                          className="w-full text-xs h-7 p-1"
                          value={editPartForm.kode_part}
                          onChange={(e) => setEditPartForm({ ...editPartForm, kode_part: e.target.value })}
                        />
                      </td>
                      <td>
                        <Input
                          type="text"
                          className="w-full text-xs h-7 p-1"
                          value={editPartForm.nama_part}
                          onChange={(e) => setEditPartForm({ ...editPartForm, nama_part: e.target.value })}
                        />
                      </td>
                      <td>
                        <Input
                          type="number"
                          step="0.0001"
                          className="w-24 text-xs h-7 p-1 font-mono"
                          value={editPartForm.std_ct}
                          onChange={(e) =>
                            setEditPartForm({
                              ...editPartForm,
                              std_ct: e.target.value === "" ? "" : Number(e.target.value),
                            })
                          }
                        />
                      </td>
                      <td className="mono text-xs text-[var(--muted)]">
                        {editPartForm.std_ct && Number(editPartForm.std_ct) > 0
                          ? (1 / Number(editPartForm.std_ct)).toFixed(2)
                          : "-"}
                      </td>
                      <td>
                        <Input
                          type="text"
                          className="w-full text-xs h-7 p-1"
                          value={editPartForm.next_process}
                          onChange={(e) => setEditPartForm({ ...editPartForm, next_process: e.target.value })}
                        />
                      </td>
                      <td>
                        <Input
                          type="number"
                          className="w-28 text-xs h-7 p-1 font-mono"
                          value={editPartForm.harga_rp}
                          onChange={(e) =>
                            setEditPartForm({
                              ...editPartForm,
                              harga_rp: e.target.value === "" ? "" : Number(e.target.value),
                            })
                          }
                        />
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => p.id && handleSaveEditPartNumber(p.id)}
                          >
                            Simpan
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setEditingPartId(null)}
                          >
                            Batal
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={p.id || p.kode_part}>
                    <td><b className="font-mono">{p.kode_part || p.value}</b></td>
                    <td>{p.nama_part || p.kode_part || p.value}</td>
                    <td className="mono">{ctVal ? ctVal.toFixed(4) : "-"}</td>
                    <td className="mono font-bold text-[var(--amber)]">{spmVal}</td>
                    <td>{p.next_process || "-"}</td>
                    <td className="mono">{p.harga_rp || p.harga_pcs ? `Rp ${fmtNum(p.harga_rp || p.harga_pcs)}` : "-"}</td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => handleStartEditPartNumber(p)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => p.id && handleDeletePartNumber(p.id)}
                        >
                          Hapus
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {masterParts.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-[var(--muted)] py-6">
                    Belum ada data Part Number untuk mesin ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Panel 3: CRUD Daftar Problem Downtime */}
      <Card className="dash-panel card-glow-info">
        <h3 className="dash-panel-title font-bold text-base">
          Daftar Problem Downtime{" "}
          <span className="text-xs font-mono text-[var(--muted)]">({problemList.length} item)</span>
        </h3>
        <div className="master-add-row flex gap-2 mb-4 mt-3">
          <Input
            type="text"
            placeholder="Tambah problem baru..."
            value={newProblemValue}
            onChange={(e) => setNewProblemValue(e.target.value)}
            onKeyUp={(e) => {
              if (e.key === "Enter") handleAddProblem();
            }}
          />
          <Button type="button" size="sm" onClick={handleAddProblem}>
            + Tambah
          </Button>
        </div>
        <div className="master-list">
          {problemList.map((item) => (
            <div key={item.id} className="master-list-row flex justify-between items-center py-2 border-b border-[var(--border)] last:border-0">
              {editingProblemId === item.id ? (
                <Input
                  type="text"
                  className="flex-1 text-xs h-8 mr-2"
                  value={editProblemValue}
                  onChange={(e) => setEditProblemValue(e.target.value)}
                  onKeyUp={(e) => {
                    if (e.key === "Enter") handleSaveEditProblem(item.id);
                  }}
                />
              ) : (
                <span className="master-value">{item.value}</span>
              )}
              <div className="master-row-actions flex gap-1">
                {editingProblemId === item.id ? (
                  <>
                    <Button type="button" size="sm" onClick={() => handleSaveEditProblem(item.id)}>
                      Simpan
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={handleCancelEditProblem}>
                      Batal
                    </Button>
                  </>
                ) : (
                  <Button type="button" variant="secondary" size="sm" onClick={() => handleStartEditProblem(item)}>
                    Edit
                  </Button>
                )}
                <Button type="button" variant="destructive" size="sm" onClick={() => handleDeleteProblem(item.id)}>
                  Hapus
                </Button>
              </div>
            </div>
          ))}
          {problemList.length === 0 && <p className="empty-state">Belum ada data.</p>}
        </div>
      </Card>

      {/* Panel 4: CRUD Jenis Non-Produksi */}
      <Card className="dash-panel card-glow-info">
        <h3 className="dash-panel-title font-bold text-base">
          Daftar Jenis Non-Produksi{" "}
          <span className="text-xs font-mono text-[var(--muted)]">({nonProduksiTypes.length} item)</span>
        </h3>
        <p className="text-xs text-[var(--muted)] mb-4">
          Meeting Awal Shift, Watari, 5S, TPM, dll — dipilih operator saat klasifikasi jeda.
        </p>

        <div className="master-add-row flex gap-2 mb-4">
          <Input
            type="text"
            placeholder="Tambah jenis baru..."
            value={newNonProduksiTypeValue}
            onChange={(e) => setNewNonProduksiTypeValue(e.target.value)}
            onKeyUp={(e) => {
              if (e.key === "Enter") handleAddNonProduksiType();
            }}
          />
          <Button type="button" size="sm" onClick={handleAddNonProduksiType}>
            + Tambah
          </Button>
        </div>

        <div className="master-list">
          {nonProduksiTypes.map((t) => (
            <div key={t.id} className="master-list-row flex justify-between items-center py-2 border-b border-[var(--border)] last:border-0">
              <span className="master-value">{t.nama}</span>
              <div className="master-row-actions">
                <Button type="button" variant="destructive" size="sm" onClick={() => handleDeleteNonProduksiType(t.id)}>
                  Hapus
                </Button>
              </div>
            </div>
          ))}
          {nonProduksiTypes.length === 0 && (
            <p className="empty-state">Belum ada data.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
