"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ProdScrapRecord } from "@/types/produksi";
import { enqueueOffline, isNetworkError } from "@/lib/produksi/offlineQueue";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "sonner";

function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(Number(n))) return "-";
  return Number(n).toLocaleString("en-US", { maximumFractionDigits: 3 });
}

const BULAN_OPTIONS = [
  "Januari","Februari","Maret","April","Mei","Juni",
  "Juli","Agustus","September","Oktober","November","Desember"
];

const PAGE_SIZE = 36;

export default function InputScrapClient({ embedded }: { embedded?: boolean }) {
  const supabase = createClient();
  const [rows, setRows] = useState<ProdScrapRecord[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const now = new Date();
  const [form, setForm] = useState<ProdScrapRecord>({
    tahun: now.getFullYear(),
    bulan: now.getMonth() + 1,
    scrap_value_kidr: 0,
    total_value_kidr: 0,
    target_rasio: 0.0046,
  });

  const flash = (m: string, isErr = false) => {
    if (isErr) toast.error(m);
    else toast.success(m);
  };

  const fetchRows = async (targetPage = 0) => {
    if (targetPage > 0) setLoadingMore(true);
    const from = targetPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const res = await supabase
      .from("prod_scrap_top_end")
      .select("*")
      .eq("is_active", true)
      .order("tahun", { ascending: false })
      .order("bulan", { ascending: false })
      .range(from, to);
    if (res.data) {
      if (targetPage === 0) {
        setRows(res.data);
      } else {
        setRows((prev) => [...prev, ...(res.data || [])]);
      }
      setHasMore((res.data?.length ?? 0) === PAGE_SIZE);
    }
    setPage(targetPage);
    if (targetPage > 0) setLoadingMore(false);
  };

  useEffect(() => {
    fetchRows(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    const payload = {
      tahun: Number(form.tahun),
      bulan: Number(form.bulan),
      scrap_value_kidr: Number(form.scrap_value_kidr),
      total_value_kidr: Number(form.total_value_kidr),
      target_rasio: Number(form.target_rasio),
      is_active: true,
    };

    try {
      const res = await supabase
        .from("prod_scrap_top_end")
        .upsert(payload, { onConflict: "tahun,bulan" });
      if (res.error) throw res.error;

      flash(editId ? "Data scrap diperbarui!" : "Scrap berhasil disimpan!");
      setEditId(null);
      setForm({ tahun: now.getFullYear(), bulan: now.getMonth() + 1, scrap_value_kidr: 0, total_value_kidr: 0, target_rasio: 0.0046 });
      fetchRows(0);
    } catch (err: any) {
      if (isNetworkError(err)) {
        enqueueOffline("prod_scrap_top_end", payload);
        setRows((prev) => [
          { ...payload, id: "pending_" + Date.now(), _pending: true },
          ...prev,
        ]);
        setEditId(null);
        setForm({ tahun: now.getFullYear(), bulan: now.getMonth() + 1, scrap_value_kidr: 0, total_value_kidr: 0, target_rasio: 0.0046 });
      } else {
        flash("Gagal menyimpan: " + (err?.message || "Unknown error"), true);
      }
    }
  };

  const edit = (r: ProdScrapRecord) => {
    setEditId(r.id || null);
    setForm({ ...r });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const hapus = async (id: string) => {
    if (!confirm("Hapus data scrap ini?")) return;
    await supabase.from("prod_scrap_top_end").update({ is_active: false }).eq("id", id);
    fetchRows(0);
  };

  const content = (
    <>
      <div className="page-header">
        <h1 className="page-title">
          <span className="eyebrow">Input</span>
          Scrap Top End (Bulanan)
        </h1>
      </div>

      <div className="space-y-6">
        <Card className="dash-panel card-glow-info">
          <p className="dash-panel-title">
            {editId ? "Edit Scrap" : "Form Scrap Top End"}
            {editId && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => { setEditId(null); setForm({ tahun: now.getFullYear(), bulan: now.getMonth() + 1, scrap_value_kidr: 0, total_value_kidr: 0, target_rasio: 0.0046 }); }}
              >
                ✕ Batal Edit
              </Button>
            )}
          </p>
          <p className="hint" style={{ marginBottom: 12 }}>
            Satuan mengikuti laporan asli: <b>K IDR</b> (ribuan Rupiah).
          </p>
          <div className="form-grid">
            <div className="field">
              <label>Tahun</label>
              <Input type="number" min="2000" max="2100" value={form.tahun} onChange={(e) => setForm({ ...form, tahun: Number(e.target.value) })} />
            </div>
            <div className="field">
              <label>Bulan</label>
              <Select value={form.bulan} onChange={(e) => setForm({ ...form, bulan: Number(e.target.value) })}>
                {BULAN_OPTIONS.map((b, idx) => (
                  <option key={b} value={idx + 1}>{b}</option>
                ))}
              </Select>
            </div>
            <div className="field">
              <label>Scrap Value (K IDR)</label>
              <Input type="number" step="0.001" value={form.scrap_value_kidr} onChange={(e) => setForm({ ...form, scrap_value_kidr: Number(e.target.value) })} />
            </div>
            <div className="field">
              <label>Total Value (K IDR)</label>
              <Input type="number" step="0.001" value={form.total_value_kidr} onChange={(e) => setForm({ ...form, total_value_kidr: Number(e.target.value) })} />
            </div>
            <div className="field">
              <label>Target Rasio (mis. 0.0046)</label>
              <Input type="number" step="0.0001" value={form.target_rasio} onChange={(e) => setForm({ ...form, target_rasio: Number(e.target.value) })} />
            </div>
          </div>
          <div className="form-actions">
            <Button type="button" onClick={save}>
              {editId ? "Update Scrap" : "Simpan Scrap"}
            </Button>
          </div>
        </Card>

        <Card className="dash-panel card-glow-info">
          <p className="dash-panel-title">
            Riwayat Scrap{" "}
            <span className="count">{rows.length} baris</span>
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Periode</th>
                  <th>Scrap (K IDR)</th>
                  <th>Total (K IDR)</th>
                  <th>Rasio</th>
                  <th>Target</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{r.tahun}-{String(r.bulan).padStart(2, "0")}</td>
                    <td className="mono">{fmtNum(r.scrap_value_kidr)}</td>
                    <td className="mono">{fmtNum(r.total_value_kidr)}</td>
                    <td className="mono">
                      {(r.total_value_kidr || 0) > 0
                        ? fmtNum(((r.scrap_value_kidr || 0) / r.total_value_kidr!) * 100) + "%"
                        : "-"}
                    </td>
                    <td className="mono">{fmtNum((r.target_rasio || 0) * 100)}%</td>
                    <td>
                      <div className="row-actions flex gap-1">
                        <Button variant="secondary" size="sm" onClick={() => edit(r)}>Edit</Button>
                        <Button variant="destructive" size="sm" onClick={() => hapus(r.id!)}>Hapus</Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty-state">Belum ada data scrap.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <div className="mt-3 text-center">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={loadingMore}
                onClick={() => fetchRows(page + 1)}
              >
                {loadingMore ? "Memuat..." : "Muat Lebih Banyak"}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </>
  );

  if (embedded) {
    return <div className="main" style={{ minHeight: 0 }}>{content}</div>;
  }

  return (
    <div className="app-shell">
      <main className="main max-w-6xl mx-auto w-full">
        {/* Tombol Kembali ke Admin */}
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 self-start min-h-[44px] px-3 py-2 mb-3 text-xs font-semibold rounded-lg border border-border bg-card text-foreground hover:bg-muted transition-colors touch-manipulation"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          Kembali ke Admin
        </Link>

        {content}
      </main>
    </div>
  );
}
