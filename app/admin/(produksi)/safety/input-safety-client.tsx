"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ThumbsUp, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ProdSafetyRecord } from "@/types/produksi";
import { enqueueOffline, isNetworkError } from "@/lib/produksi/offlineQueue";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "sonner";

const PAGE_SIZE = 60;

export default function InputSafetyClient({ embedded }: { embedded?: boolean }) {
  const supabase = createClient();
  const [rows, setRows] = useState<ProdSafetyRecord[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState<ProdSafetyRecord>({
    tanggal: today,
    kategori: "ACCIDENT",
    keterangan: "",
  });

  const flash = (m: string, isErr = false) => {
    if (isErr) toast.error(m);
    else toast.success(m);
  };

  const fetchRows = async (targetPage = 0) => {
    if (targetPage > 0) setLoadingMore(true);
    else setLoading(true);

    try {
      const from = targetPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const res = await supabase
        .from("prod_safety_log")
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
    } finally {
      if (targetPage > 0) setLoadingMore(false);
      else setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    const payload = {
      tanggal: form.tanggal,
      kategori: form.kategori,
      keterangan: form.keterangan || null,
      is_active: true,
    };

    try {
      const res = await supabase.from("prod_safety_log").insert(payload);
      if (res.error) throw res.error;

      flash("Insiden berhasil dicatat!");
      setForm({ tanggal: today, kategori: "ACCIDENT", keterangan: "" });
      fetchRows(0);
    } catch (err: any) {
      if (isNetworkError(err)) {
        enqueueOffline("prod_safety_log", payload);
        setRows((prev) => [
          { ...payload, id: "pending_" + Date.now(), _pending: true } as ProdSafetyRecord,
          ...prev,
        ]);
        setForm({ tanggal: today, kategori: "ACCIDENT", keterangan: "" });
      } else {
        flash("Gagal menyimpan: " + (err?.message || "Unknown error"), true);
      }
    }
  };

  const hapus = async (id: string) => {
    if (!confirm("Hapus data insiden ini?")) return;
    await supabase.from("prod_safety_log").update({ is_active: false }).eq("id", id);
    fetchRows(0);
  };

  const badgeKategori = (k: string) => {
    if (k === "ACCIDENT") return { background: "rgba(209,69,75,0.12)", color: "var(--red, #d1454b)" };
    if (k === "NEAR_MISS") return { background: "rgba(201,130,15,0.12)", color: "var(--amber, #c9820f)" };
    return { background: "var(--panel-2, #f8fafc)", color: "var(--muted-foreground, #64748b)" };
  };

  if (embedded) {
    return (
      <div className="main animate-in fade-in slide-in-from-bottom-2 duration-500" style={{ minHeight: 0 }}>
        <div className="page-header">
          <h1 className="page-title">
            <span className="eyebrow">Input</span>
            Safety / Insiden
          </h1>
        </div>

        <div className="space-y-6">
          <Card className="dash-panel card-glow-info">
            <p className="dash-panel-title">Catat Insiden</p>
            <p className="hint" style={{ marginBottom: 12 }}>
              Kalau tidak ada insiden, tidak perlu diisi — dashboard otomatis menghitung &quot;hari tanpa kecelakaan&quot;.
            </p>
            <div className="form-grid">
              <div className="field">
                <label>Tanggal</label>
                <Input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} />
              </div>
              <div className="field">
                <label>Kategori</label>
                <Select value={form.kategori} onChange={(e) => setForm({ ...form, kategori: e.target.value })}>
                  <option value="ACCIDENT">Accident (kecelakaan kerja)</option>
                  <option value="NEAR_MISS">Near Miss (hampir celaka)</option>
                  <option value="OTHER">Lainnya</option>
                </Select>
              </div>
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label>Keterangan</label>
                <Input
                  type="text"
                  placeholder="Kronologi singkat..."
                  value={form.keterangan}
                  onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
                />
              </div>
            </div>
            <div className="form-actions">
              <Button type="button" onClick={save}>
                Simpan Insiden
              </Button>
            </div>
          </Card>

          <Card className="dash-panel card-glow-info">
            <p className="dash-panel-title">
              Riwayat Insiden{" "}
              <span className="count">{rows.length} baris</span>
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Kategori</th>
                    <th>Keterangan</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <SafetyTableSkeleton />
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="empty-state">
                        Tidak ada insiden tercatat. <ThumbsUp size={14} style={{ display: "inline", verticalAlign: "middle", marginLeft: 4 }} />
                      </td>
                    </tr>
                  ) : (
                    rows.map((r, index) => (
                      <tr
                        key={r.id || index}
                        className="animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-backwards"
                        style={{ animationDelay: `${Math.min(index * 25, 300)}ms` }}
                      >
                        <td className="mono">{r.tanggal}</td>
                        <td>
                          <span className="badge" style={badgeKategori(r.kategori || "")}>
                            {r.kategori}
                          </span>
                        </td>
                        <td>{r.keterangan || "-"}</td>
                        <td>
                          <Button variant="destructive" size="sm" onClick={() => hapus(r.id!)}>
                            Hapus
                          </Button>
                        </td>
                      </tr>
                    ))
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
      </div>
    );
  }

  return (
    <div className="app-shell">
      <main className="main max-w-6xl mx-auto w-full animate-in fade-in slide-in-from-bottom-2 duration-500">
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
            Safety / Insiden
          </h1>
        </div>

        <div className="space-y-6">
          <Card className="dash-panel card-glow-info">
            <p className="dash-panel-title">Catat Insiden</p>
            <p className="hint" style={{ marginBottom: 12 }}>
              Kalau tidak ada insiden, tidak perlu diisi — dashboard otomatis menghitung &quot;hari tanpa kecelakaan&quot;.
            </p>
            <div className="form-grid">
              <div className="field">
                <label>Tanggal</label>
                <Input type="date" value={form.tanggal} onChange={(e) => setForm({ ...form, tanggal: e.target.value })} />
              </div>
              <div className="field">
                <label>Kategori</label>
                <Select value={form.kategori} onChange={(e) => setForm({ ...form, kategori: e.target.value })}>
                  <option value="ACCIDENT">Accident (kecelakaan kerja)</option>
                  <option value="NEAR_MISS">Near Miss (hampir celaka)</option>
                  <option value="OTHER">Lainnya</option>
                </Select>
              </div>
              <div className="field" style={{ gridColumn: "1 / -1" }}>
                <label>Keterangan</label>
                <Input
                  type="text"
                  placeholder="Kronologi singkat..."
                  value={form.keterangan}
                  onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
                />
              </div>
            </div>
            <div className="form-actions">
              <Button type="button" onClick={save}>
                Simpan Insiden
              </Button>
            </div>
          </Card>

          <Card className="dash-panel card-glow-info">
            <p className="dash-panel-title">
              Riwayat Insiden{" "}
              <span className="count">{rows.length} baris</span>
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Kategori</th>
                    <th>Keterangan</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <SafetyTableSkeleton />
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="empty-state">
                        Tidak ada insiden tercatat. <ThumbsUp size={14} style={{ display: "inline", verticalAlign: "middle", marginLeft: 4 }} />
                      </td>
                    </tr>
                  ) : (
                    rows.map((r, index) => (
                      <tr
                        key={r.id || index}
                        className="animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-backwards"
                        style={{ animationDelay: `${Math.min(index * 25, 300)}ms` }}
                      >
                        <td className="mono">{r.tanggal}</td>
                        <td>
                          <span className="badge" style={badgeKategori(r.kategori || "")}>
                            {r.kategori}
                          </span>
                        </td>
                        <td>{r.keterangan || "-"}</td>
                        <td>
                          <Button variant="destructive" size="sm" onClick={() => hapus(r.id!)}>
                            Hapus
                          </Button>
                        </td>
                      </tr>
                    ))
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
      </main>
    </div>
  );
}

function SafetyTableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="animate-pulse select-none">
          <td><div className="h-4 bg-muted rounded w-24" /></td>
          <td><div className="h-5 bg-muted rounded w-20" /></td>
          <td><div className="h-4 bg-muted rounded w-48" /></td>
          <td><div className="h-7 bg-muted rounded w-16" /></td>
        </tr>
      ))}
    </>
  );
}
