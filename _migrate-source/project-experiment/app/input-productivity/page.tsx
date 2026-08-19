"use client";

import React, { useState, useEffect } from "react";
import HeaderNav from "@/components/HeaderNav";
import { supabase } from "@/lib/supabaseClient";
import { Profile, ProductivityRecord } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

function fmtNum(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "" || Number.isNaN(Number(n))) return "-";
  return Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function fmtTgl(iso: string): string {
  if (!iso) return "-";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
}

export default function InputProductivityPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rows, setRows] = useState<ProductivityRecord[]>([]);
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState<ProductivityRecord>({
    tanggal: today,
    eh_jam: "",
  });

  const isLeaderOrAdmin = profile && ["admin", "leader"].includes(profile.role || "");

  const flash = (m: string, isErr = false) => {
    if (isErr) toast.error(m);
    else toast.success(m);
  };

  const fetchRows = async () => {
    const { data } = await supabase
      .from("productivity_daily_reference")
      .select("tanggal, eh_jam")
      .order("tanggal", { ascending: false })
      .limit(90);
    setRows(data || []);
  };

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { window.location.href = "/login"; return; }
      const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
      if (data) setProfile(data as Profile);
      await fetchRows();
    };
    init();
  }, []);

  const simpan = async () => {
    if (!form.tanggal || form.eh_jam === "") {
      flash("Isi tanggal & Earned Hours dulu.", true);
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("productivity_daily_reference")
      .upsert(
        {
          tanggal: form.tanggal,
          eh_jam: Number(form.eh_jam),
        },
        { onConflict: "tanggal" }
      );
    setSaving(false);
    if (error) {
      flash("Gagal simpan: " + error.message, true);
      return;
    }
    flash("Earned Hours " + form.tanggal + " disimpan.");
    setForm((prev) => ({ ...prev, eh_jam: "" }));
    await fetchRows();
  };

  const editRow = (r: ProductivityRecord) => {
    setForm({
      tanggal: r.tanggal,
      eh_jam: r.eh_jam,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const hapusRow = async (tanggal: string) => {
    await supabase.from("productivity_daily_reference").delete().eq("tanggal", tanggal);
    await fetchRows();
  };

  return (
    <HeaderNav activeTitle="Input Earned Hours">
      <div className="page-header">
        <h1 className="page-title">
          <span className="eyebrow">Input</span>
          Earned Hours Harian
        </h1>
      </div>

      <p className="hint" style={{ marginBottom: "16px" }}>
        Working Hours utk Productivity sekarang otomatis dari Attendance + Overtime, tidak perlu diisi manual lagi.
        Earned Hours di sini bisa dipakai gantikan hitungan otomatis sistem selama masa transisi.
        Kalau tanggal tertentu <b>tidak diisi</b> di sini, sistem otomatis pakai rumus (Massprod + Semi + Non) seperti biasa.
      </p>

      {profile && !isLeaderOrAdmin && (
        <div className="error-msg">Halaman ini khusus admin/leader.</div>
      )}

      {isLeaderOrAdmin && (
        <div>
          <Card className="dash-panel card-glow-info">
            <p className="dash-panel-title">Isi / Ubah Earned Hours</p>
            <div className="form-grid">
              <div className="field">
                <label>Tanggal</label>
                <Input
                  type="date"
                  value={form.tanggal}
                  onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Earned Hours (jam)</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="mis. 154.98"
                  value={form.eh_jam}
                  onChange={(e) => setForm({ ...form, eh_jam: e.target.value })}
                />
              </div>
            </div>
            <div className="form-actions">
              <Button
                type="button"
                onClick={simpan}
                disabled={saving}
              >
                {saving ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </Card>

          <Card className="dash-panel card-glow-info">
            <p className="dash-panel-title">
              Riwayat Input <span className="count">{rows.length} baris</span>
            </p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Earned Hours (jam)</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.tanggal}>
                      <td className="mono">{fmtTgl(r.tanggal)}</td>
                      <td className="mono">{fmtNum(r.eh_jam)}</td>
                      <td className="flex gap-1">
                        <Button variant="secondary" size="sm" onClick={() => editRow(r)}>
                          Edit
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => hapusRow(r.tanggal)}>
                          Hapus
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={3} className="empty-state">
                        Belum ada input.
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