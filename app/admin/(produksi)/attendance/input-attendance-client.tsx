"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ProdAttendanceRecord } from "@/types/produksi";
import { enqueueOffline, isNetworkError } from "@/lib/produksi/offlineQueue";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "sonner";

function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(Number(n))) return "-";
  return Number(n).toLocaleString("en-US", { maximumFractionDigits: 1 });
}

interface Props {
  userId: string;
  embedded?: boolean;
}

const PAGE_SIZE = 60;

export default function InputAttendanceClient({ userId: initialUserId, embedded }: Props) {
  const supabase = createClient();
  const [rows, setRows] = useState<ProdAttendanceRecord[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [userId] = useState<string | null>(initialUserId || null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState<ProdAttendanceRecord>({
    tanggal: today,
    shift: 1,
    total_orang: 0,
    hadir: 0,
    cuti: 0,
    absen: 0,
    overtime_jam: 0,
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
      .from("prod_attendance_log")
      .select("*")
      .eq("is_active", true)
      .order("tanggal", { ascending: false })
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
      tanggal: form.tanggal,
      shift: Number(form.shift),
      total_orang: Number(form.total_orang),
      hadir: Number(form.hadir),
      cuti: Number(form.cuti),
      absen: Number(form.absen),
      overtime_jam: Number(form.overtime_jam),
      updated_by: userId,
      is_active: true,
    };

    try {
      const res = await supabase
        .from("prod_attendance_log")
        .upsert(payload, { onConflict: "tanggal,shift" });
      if (res.error) throw res.error;

      flash(editId ? "Data absensi diperbarui!" : "Absensi berhasil disimpan!");
      setEditId(null);
      setForm({ tanggal: today, shift: 1, total_orang: 0, hadir: 0, cuti: 0, absen: 0, overtime_jam: 0 });
      fetchRows(0);
    } catch (err: any) {
      if (isNetworkError(err)) {
        enqueueOffline("prod_attendance_log", payload);
        setRows((prev) => [
          { ...payload, id: "pending_" + Date.now(), _pending: true },
          ...prev,
        ]);
        setEditId(null);
        setForm({ tanggal: today, shift: 1, total_orang: 0, hadir: 0, cuti: 0, absen: 0, overtime_jam: 0 });
      } else {
        flash("Gagal menyimpan: " + (err?.message || "Unknown error"), true);
      }
    }
  };

  const edit = (r: ProdAttendanceRecord) => {
    setEditId(r.id || null);
    setForm({ ...r });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const hapus = async (tanggal: string, shift?: number) => {
    if (!confirm("Hapus data absensi ini?")) return;
    let q = supabase.from("prod_attendance_log").update({ is_active: false }).eq("tanggal", tanggal);
    if (shift !== undefined) {
      q = q.eq("shift", shift);
    }
    await q;
    fetchRows(0);
  };

  const innerContent = (
    <div className="space-y-6">
      <Card className="dash-panel card-glow-info">
        <p className="dash-panel-title">
          {editId ? "Edit Absensi" : "Form Absensi"}
          {editId && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => { setEditId(null); setForm({ tanggal: today, shift: 1, total_orang: 0, hadir: 0, cuti: 0, absen: 0, overtime_jam: 0 }); }}
            >
              ✕ Batal Edit
            </Button>
          )}
        </p>
        <div className="form-grid">
          <div className="field">
            <label>Tanggal</label>
            <Input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} />
          </div>
          <div className="field">
            <label>Shift</label>
            <Select value={form.shift} onChange={(e) => setForm({ ...form, shift: Number(e.target.value) })}>
              <option value={1}>Shift 1</option>
              <option value={2}>Shift 2</option>
            </Select>
          </div>
          <div className="field">
            <label>Total Orang</label>
            <Input type="number" value={form.total_orang} onChange={(e) => setForm({ ...form, total_orang: Number(e.target.value) })} />
          </div>
          <div className="field">
            <label>Hadir</label>
            <Input type="number" value={form.hadir} onChange={(e) => setForm({ ...form, hadir: Number(e.target.value) })} />
          </div>
          <div className="field">
            <label>Cuti</label>
            <Input type="number" value={form.cuti} onChange={(e) => setForm({ ...form, cuti: Number(e.target.value) })} />
          </div>
          <div className="field">
            <label>Absen</label>
            <Input type="number" value={form.absen} onChange={(e) => setForm({ ...form, absen: Number(e.target.value) })} />
          </div>
          <div className="field">
            <label>Overtime (jam)</label>
            <Input type="number" step="0.5" value={form.overtime_jam} onChange={(e) => setForm({ ...form, overtime_jam: Number(e.target.value) })} />
          </div>
        </div>
        <div className="form-actions">
          <Button type="button" onClick={save}>
            {editId ? "Update Absensi" : "Simpan Absensi"}
          </Button>
        </div>
      </Card>

      <Card className="dash-panel card-glow-info">
        <p className="dash-panel-title">
          Riwayat Absensi{" "}
          <span className="count">{rows.length} baris</span>
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Shift</th>
                <th>Total</th>
                <th>Hadir</th>
                <th>Cuti</th>
                <th>Absen</th>
                <th>OT (jam)</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.tanggal}</td>
                  <td>Shift {r.shift}</td>
                  <td className="mono">{fmtNum(r.total_orang)}</td>
                  <td className="mono">{fmtNum(r.hadir)}</td>
                  <td className="mono">{fmtNum(r.cuti)}</td>
                  <td className="mono">{fmtNum(r.absen)}</td>
                  <td className="mono">{fmtNum(r.overtime_jam)}</td>
                  <td>
                    <div className="row-actions flex gap-1">
                      <Button variant="secondary" size="sm" onClick={() => edit(r)}>Edit</Button>
                      <Button variant="destructive" size="sm" onClick={() => hapus(r.tanggal, r.shift)}>Hapus</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty-state">Belum ada data absensi.</td>
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
  );

  if (embedded) {
    return (
      <div className="main" style={{ minHeight: 0 }}>
        <div className="page-header">
          <h1 className="page-title">
            <span className="eyebrow">Input</span>
            Attendance Harian
          </h1>
        </div>
        {innerContent}
      </div>
    );
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

        <div className="page-header">
          <h1 className="page-title">
            <span className="eyebrow">Input</span>
            Attendance Harian
          </h1>
        </div>

        {innerContent}
      </main>
    </div>
  );
}
