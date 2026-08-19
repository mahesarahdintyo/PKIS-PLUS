"use client";

import React, { useState, useEffect } from "react";
import { ThumbsUp } from "lucide-react";
import HeaderNav from "@/components/HeaderNav";
import { supabase } from "@/lib/supabaseClient";
import { Profile, SafetyRecord } from "@/types/database";
import { enqueueOffline, isNetworkError } from "@/lib/offlineQueue";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "sonner";

export default function InputSafetyPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rows, setRows] = useState<SafetyRecord[]>([]);

  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState<SafetyRecord>({
    tanggal: today,
    kategori: "ACCIDENT",
    keterangan: "",
  });

  const flash = (m: string, isErr = false) => {
    if (isErr) toast.error(m);
    else toast.success(m);
  };

  const isLeaderOrAdmin = profile && ["admin", "leader"].includes(profile.role || "");

  const fetchRows = async () => {
    const res = await supabase.from("safety_log").select("*").order("tanggal", { ascending: false }).limit(60);
    if (res.data) setRows(res.data);
  };

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = "/login"; return; }
      const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
      if (data) setProfile(data as Profile);
      fetchRows();
    };
    init();
  }, []);

  const save = async () => {
    const payload = {
      tanggal: form.tanggal,
      kategori: form.kategori,
      keterangan: form.keterangan || null,
    };

    try {
      const res = await supabase.from("safety_log").insert(payload);
      if (res.error) throw res.error;

      flash("Insiden berhasil dicatat!");
      setForm({ tanggal: today, kategori: "ACCIDENT", keterangan: "" });
      fetchRows();
    } catch (err: any) {
      if (isNetworkError(err)) {
        enqueueOffline("safety_log", payload);
        setRows((prev) => [
          { ...payload, id: "pending_" + Date.now(), _pending: true } as SafetyRecord,
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
    await supabase.from("safety_log").delete().eq("id", id);
    fetchRows();
  };

  const badgeKategori = (k: string) => {
    if (k === "ACCIDENT") return { background: "rgba(209,69,75,0.12)", color: "var(--red)" };
    if (k === "NEAR_MISS") return { background: "rgba(201,130,15,0.12)", color: "var(--amber)" };
    return { background: "var(--panel-2)", color: "var(--muted)" };
  };

  return (
    <HeaderNav activeTitle="Input Safety">
      <div className="page-header">
        <h1 className="page-title">
          <span className="eyebrow">Input</span>
          Safety / Insiden
        </h1>
      </div>

      {profile && !isLeaderOrAdmin && (
        <div className="error-msg">Halaman ini khusus admin/leader.</div>
      )}

      {isLeaderOrAdmin && (
        <div>
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
                  {rows.map((r) => (
                    <tr key={r.id}>
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
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="empty-state">
                        Tidak ada insiden tercatat. <ThumbsUp size={14} style={{ display: "inline", verticalAlign: "middle", marginLeft: 4 }} />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </HeaderNav>
  );
}