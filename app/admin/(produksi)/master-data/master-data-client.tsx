"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { MACHINE_CONFIGS } from "@/components/produksi/machines/MachineDetailClient";
import MasterDataTab from "@/components/produksi/machines/MasterDataTab";
import type {
  ProdMasterPart,
  ProdNonProduksiType,
  ProdDowntimeProblem,
} from "@/types/produksi";
import { toast } from "sonner";
import "@/app/admin/(produksi)/produksi.css";

const MACHINE_LIST = [
  { slug: "tandem", label: "Tandem", key: "tandem" },
  { slug: "blanking", label: "Blanking", key: "blanking" },
  { slug: "transfer-2000t", label: "Transfer 2000t", key: "transfer_2000t" },
  { slug: "transfer-800t", label: "Transfer 800t", key: "transfer_800t" },
  { slug: "pc200t", label: "PC200t", key: "pc200t" },
];

export default function MasterDataClient() {
  const supabase = createClient();
  const [selectedMachineSlug, setSelectedMachineSlug] = useState<string>("tandem");
  const [loading, setLoading] = useState<boolean>(true);

  const currentConfig =
    MACHINE_CONFIGS[selectedMachineSlug] || MACHINE_CONFIGS["tandem"];

  // Target GSPH & Availability State
  const [mesinSettingsDraft, setMesinSettingsDraft] = useState<{
    gsph_target_mode: "fixed" | "per_part";
    gsph_target_fixed: number | "";
    target_availability: number | "";
  }>({
    gsph_target_mode: "fixed",
    gsph_target_fixed: "",
    target_availability: "",
  });

  // Part Numbers State
  const [masterParts, setMasterParts] = useState<ProdMasterPart[]>([]);
  const [newPartKode, setNewPartKode] = useState<string>("");
  const [newPartNama, setNewPartNama] = useState<string>("");
  const [newPartStdCt, setNewPartStdCt] = useState<number | "">("");
  const [newPartNextProcess, setNewPartNextProcess] = useState<string>("");
  const [newPartHarga, setNewPartHarga] = useState<number | "">("");
  const [editingPartId, setEditingPartId] = useState<string | null>(null);
  const [editPartForm, setEditPartForm] = useState<{
    kode_part: string;
    nama_part: string;
    std_ct: number | "";
    next_process: string;
    harga_rp: number | "";
  }>({
    kode_part: "",
    nama_part: "",
    std_ct: "",
    next_process: "",
    harga_rp: "",
  });

  // Non-Produksi Types State
  const [nonProduksiTypes, setNonProduksiTypes] = useState<ProdNonProduksiType[]>([]);
  const [newNonProduksiTypeValue, setNewNonProduksiTypeValue] = useState<string>("");

  // Downtime Problems State
  const [problemList, setProblemList] = useState<ProdDowntimeProblem[]>([]);
  const [newProblemValue, setNewProblemValue] = useState<string>("");
  const [editingProblemId, setEditingProblemId] = useState<string | null>(null);
  const [editProblemValue, setEditProblemValue] = useState<string>("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Target settings
      const { data: settingsData } = await supabase
        .from("prod_mesin_settings" as any)
        .select("*")
        .eq("mesin", currentConfig.key)
        .maybeSingle();

      if (settingsData) {
        setMesinSettingsDraft({
          gsph_target_mode: (settingsData as any).gsph_target_mode || "fixed",
          gsph_target_fixed:
            (settingsData as any).gsph_target_fixed != null
              ? (settingsData as any).gsph_target_fixed
              : "",
          target_availability:
            (settingsData as any).target_availability != null
              ? (settingsData as any).target_availability
              : "",
        });
      } else {
        setMesinSettingsDraft({
          gsph_target_mode: "fixed",
          gsph_target_fixed: "",
          target_availability: "",
        });
      }

      // 2. Part Numbers
      const { data: pNumData, error: pNumErr } = await supabase
        .from("prod_part_numbers" as any)
        .select("*")
        .eq("mesin", currentConfig.key)
        .eq("is_active", true)
        .order("value");

      if (!pNumErr && pNumData) {
        const mappedParts: ProdMasterPart[] = pNumData.map((p: any) => ({
          id: p.id,
          kode_part: p.value || p.kode_part || "",
          nama_part: p.nama_part || p.value || "",
          mesin: p.mesin,
          std_ct: p.std_ct ?? (p.ct_detik ? p.ct_detik / 60 : undefined),
          ct_detik: p.ct_detik ?? (p.std_ct ? p.std_ct * 60 : undefined),
          std_mp: p.std_mp ?? p.mp_std,
          mp_std: p.mp_std ?? p.std_mp,
          next_process:
            p.next_process ||
            (Array.isArray(p.next_processes)
              ? p.next_processes.map((np: any) => `${np.line}:${np.part_number}`).join(", ")
              : undefined),
          harga_rp: p.harga_pcs ?? p.harga_rp,
          harga_pcs: p.harga_pcs ?? p.harga_rp,
          value: p.value || p.kode_part,
        }));
        setMasterParts(mappedParts);
      } else {
        setMasterParts([]);
      }

      // 3. Downtime Problems Master
      const { data: probs } = await supabase
        .from("prod_downtime_problems" as any)
        .select("*")
        .eq("mesin", currentConfig.key)
        .eq("is_active", true)
        .order("value", { ascending: true });
      if (probs) setProblemList(probs as ProdDowntimeProblem[]);
      else setProblemList([]);

      // 4. Non-Produksi Types
      const { data: npTypes } = await supabase
        .from("prod_nonproduksi_types" as any)
        .select("*")
        .eq("mesin", currentConfig.key)
        .eq("is_active", true)
        .order("nama", { ascending: true });
      if (npTypes) setNonProduksiTypes(npTypes as ProdNonProduksiType[]);
      else setNonProduksiTypes([]);
    } catch (err: any) {
      console.error("Master data load error:", err?.message || err);
      toast.error("Gagal memuat master data mesin: " + (err?.message || ""));
    } finally {
      setLoading(false);
    }
  }, [currentConfig.key, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Target Settings Handler
  const handleSaveMesinSettings = async () => {
    try {
      const payload = {
        mesin: currentConfig.key,
        gsph_target_mode: mesinSettingsDraft.gsph_target_mode,
        gsph_target_fixed:
          mesinSettingsDraft.gsph_target_fixed === ""
            ? null
            : Number(mesinSettingsDraft.gsph_target_fixed),
        target_availability:
          mesinSettingsDraft.target_availability === ""
            ? null
            : Number(mesinSettingsDraft.target_availability),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("prod_mesin_settings" as any)
        .upsert(payload, { onConflict: "mesin" });

      if (error) throw error;
      toast.success("Target GSPH & Availability berhasil disimpan!");
      loadData();
    } catch (err: any) {
      toast.error("Gagal menyimpan target: " + (err?.message || JSON.stringify(err)));
    }
  };

  // Part Number CRUD
  const handleAddPartNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartKode.trim()) return;

    try {
      const payload = {
        mesin: currentConfig.key,
        value: newPartKode.trim(),
        std_ct: newPartStdCt === "" ? null : Number(newPartStdCt),
        harga_pcs: newPartHarga === "" ? null : Number(newPartHarga),
      };

      const { error } = await supabase.from("prod_part_numbers" as any).insert([payload]);
      if (error) throw error;

      toast.success("Part Number berhasil ditambahkan!");
      setNewPartKode("");
      setNewPartNama("");
      setNewPartStdCt("");
      setNewPartNextProcess("");
      setNewPartHarga("");
      loadData();
    } catch (err: any) {
      toast.error("Gagal menambah Part Number: " + (err?.message || JSON.stringify(err)));
    }
  };

  const handleStartEditPartNumber = (part: ProdMasterPart) => {
    setEditingPartId(part.id || null);
    setEditPartForm({
      kode_part: part.kode_part || part.value || "",
      nama_part: part.nama_part || part.kode_part || part.value || "",
      std_ct: part.std_ct ?? (part.ct_detik ? part.ct_detik / 60 : ""),
      next_process: part.next_process || "",
      harga_rp: part.harga_rp ?? part.harga_pcs ?? "",
    });
  };

  const handleSaveEditPartNumber = async (id: string) => {
    if (!editPartForm.kode_part.trim()) return;
    try {
      const payload = {
        value: editPartForm.kode_part.trim(),
        std_ct: editPartForm.std_ct === "" ? null : Number(editPartForm.std_ct),
        harga_pcs: editPartForm.harga_rp === "" ? null : Number(editPartForm.harga_rp),
      };

      const { error } = await supabase
        .from("prod_part_numbers" as any)
        .update(payload)
        .eq("id", id);
      if (error) throw error;

      toast.success("Part Number berhasil diperbarui!");
      setEditingPartId(null);
      loadData();
    } catch (err: any) {
      toast.error("Gagal memperbarui Part Number: " + (err?.message || JSON.stringify(err)));
    }
  };

  const handleDeletePartNumber = async (id: string) => {
    if (!confirm("Hapus part number ini?")) return;
    try {
      const { error } = await supabase
        .from("prod_part_numbers" as any)
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
      toast.success("Part Number berhasil dihapus!");
      loadData();
    } catch (err: any) {
      toast.error("Gagal menghapus Part Number: " + (err?.message || JSON.stringify(err)));
    }
  };

  // Non-Produksi Types CRUD
  const handleAddNonProduksiType = async () => {
    const v = newNonProduksiTypeValue.trim();
    if (!v) return;
    try {
      const { error } = await supabase
        .from("prod_nonproduksi_types" as any)
        .insert({ mesin: currentConfig.key, nama: v });
      if (error) throw error;
      setNewNonProduksiTypeValue("");
      toast.success("Jenis non-produksi berhasil ditambahkan!");
      loadData();
    } catch (err: any) {
      toast.error("Gagal tambah jenis non-produksi: " + (err?.message || JSON.stringify(err)));
    }
  };

  const handleDeleteNonProduksiType = async (id: string) => {
    if (!confirm("Hapus jenis ini?")) return;
    try {
      const { error } = await supabase
        .from("prod_nonproduksi_types" as any)
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
      toast.success("Jenis non-produksi berhasil dihapus!");
      loadData();
    } catch (err: any) {
      toast.error("Gagal hapus jenis non-produksi: " + (err?.message || JSON.stringify(err)));
    }
  };

  // Problem Downtime CRUD
  const handleAddProblem = async () => {
    const v = newProblemValue.trim();
    if (!v) return;
    try {
      const { data, error } = await supabase
        .from("prod_downtime_problems" as any)
        .insert({ mesin: currentConfig.key, value: v })
        .select()
        .single();
      if (error) throw error;
      setProblemList((prev) =>
        [...prev, data as ProdDowntimeProblem].sort((a, b) =>
          a.value.localeCompare(b.value)
        )
      );
      setNewProblemValue("");
      toast.success("Problem downtime berhasil ditambahkan!");
    } catch (err: any) {
      toast.error("Gagal tambah problem: " + (err?.message || JSON.stringify(err)));
    }
  };

  const handleStartEditProblem = (item: ProdDowntimeProblem) => {
    setEditingProblemId(item.id);
    setEditProblemValue(item.value);
  };

  const handleCancelEditProblem = () => {
    setEditingProblemId(null);
    setEditProblemValue("");
  };

  const handleSaveEditProblem = async (id: string) => {
    const v = editProblemValue.trim();
    if (!v) {
      toast.error("Nama problem tidak boleh kosong.");
      return;
    }
    try {
      const { data, error } = await supabase
        .from("prod_downtime_problems" as any)
        .update({ value: v })
        .eq("id", id)
        .select();
      if (error) throw error;
      if (!data || data.length === 0) {
        toast.error("Gagal simpan — periksa izin akses.");
        return;
      }
      setProblemList((prev) =>
        prev.map((p) => (p.id === id ? { ...p, value: v } : p))
      );
      handleCancelEditProblem();
      toast.success("Problem downtime berhasil diperbarui!");
    } catch (err: any) {
      toast.error("Gagal simpan problem: " + (err?.message || JSON.stringify(err)));
    }
  };

  const handleDeleteProblem = async (id: string) => {
    if (!confirm("Hapus problem ini?")) return;
    try {
      const { error } = await supabase
        .from("prod_downtime_problems" as any)
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
      setProblemList((prev) => prev.filter((p) => p.id !== id));
      toast.success("Problem downtime berhasil dihapus!");
    } catch (err: any) {
      toast.error("Gagal hapus problem: " + (err?.message || JSON.stringify(err)));
    }
  };

  const fmtNum = (n: number | null | undefined): string => {
    if (n == null || isNaN(n)) return "-";
    return Number(n).toLocaleString("id-ID");
  };

  return (
    <div className="app-shell machine-hub-container">
      <main className="main max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Tombol Kembali ke Admin */}
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 text-xs font-semibold rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors touch-manipulation"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            Kembali ke Admin
          </Link>
        </div>

        {/* Page Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="page-header mb-0">
            <h1 className="page-title text-2xl font-bold font-display">
              <span className="eyebrow block text-xs font-semibold text-blue-500 uppercase tracking-wider mb-0.5">
                Monitoring & Pengaturan
              </span>
              Master Data Produksi
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Kelola Master Part Number, Downtime Problem, Jenis Non-Produksi, dan Target Mesin untuk seluruh lini produksi.
            </p>
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-2 min-h-[40px] px-3.5 py-2 text-xs font-bold rounded-xl border border-border bg-card text-foreground hover:bg-muted active:scale-95 transition-all cursor-pointer touch-manipulation"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Machine Selector Tabs */}
        <div className="flex flex-wrap gap-2 p-1.5 rounded-2xl border border-border bg-card/60 shadow-xs">
          {MACHINE_LIST.map((m) => {
            const isSelected = selectedMachineSlug === m.slug;
            return (
              <button
                key={m.slug}
                type="button"
                onClick={() => setSelectedMachineSlug(m.slug)}
                className={`min-h-[44px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer touch-manipulation ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-md active:scale-95"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Active Machine Master Data CRUD */}
        <div className="mt-4">
          <MasterDataTab
            config={currentConfig}
            isLeaderOrAdmin={true}
            mesinSettingsDraft={mesinSettingsDraft}
            setMesinSettingsDraft={setMesinSettingsDraft}
            handleSaveMesinSettings={handleSaveMesinSettings}
            masterParts={masterParts}
            newPartKode={newPartKode}
            setNewPartKode={setNewPartKode}
            newPartNama={newPartNama}
            setNewPartNama={setNewPartNama}
            newPartStdCt={newPartStdCt}
            setNewPartStdCt={setNewPartStdCt}
            newPartNextProcess={newPartNextProcess}
            setNewPartNextProcess={setNewPartNextProcess}
            newPartHarga={newPartHarga}
            setNewPartHarga={setNewPartHarga}
            handleAddPartNumber={handleAddPartNumber}
            editingPartId={editingPartId}
            editPartForm={editPartForm}
            setEditPartForm={setEditPartForm}
            handleStartEditPartNumber={handleStartEditPartNumber}
            handleSaveEditPartNumber={handleSaveEditPartNumber}
            setEditingPartId={setEditingPartId}
            handleDeletePartNumber={handleDeletePartNumber}
            nonProduksiTypes={nonProduksiTypes}
            newNonProduksiTypeValue={newNonProduksiTypeValue}
            setNewNonProduksiTypeValue={setNewNonProduksiTypeValue}
            handleAddNonProduksiType={handleAddNonProduksiType}
            handleDeleteNonProduksiType={handleDeleteNonProduksiType}
            problemList={problemList}
            newProblemValue={newProblemValue}
            setNewProblemValue={setNewProblemValue}
            editingProblemId={editingProblemId}
            editProblemValue={editProblemValue}
            setEditProblemValue={setEditProblemValue}
            handleAddProblem={handleAddProblem}
            handleStartEditProblem={handleStartEditProblem}
            handleCancelEditProblem={handleCancelEditProblem}
            handleSaveEditProblem={handleSaveEditProblem}
            handleDeleteProblem={handleDeleteProblem}
            fmtNum={fmtNum}
          />
        </div>
      </main>
    </div>
  );
}
