"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Users,
  UserPlus,
  ShieldCheck,
  Award,
  User,
  Search,
  Filter,
  RefreshCw,
  ArrowLeft,
  KeyRound,
  Pencil,
  Trash2,
  Building2,
  Calendar,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface UserItem {
  id: string;
  email: string;
  fullName: string;
  role: "admin" | "operator" | "leader";
  lineId: string | null;
  lineName: string | null;
  createdAt: string;
  updatedAt: string;
  isSelf: boolean;
}

interface LineItem {
  id: string;
  name: string;
}

export default function AdminUsersClient({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [lines, setLines] = useState<LineItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [lineFilter, setLineFilter] = useState<string>("all");

  // Modal State: Tambah User
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createUsername, setCreateUsername] = useState("");
  const [createFullName, setCreateFullName] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createRole, setCreateRole] = useState<"admin" | "operator" | "leader">("operator");
  const [createLineId, setCreateLineId] = useState("");
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  // Modal State: Edit Role & Profil
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<UserItem | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editRole, setEditRole] = useState<"admin" | "operator" | "leader">("operator");
  const [editLineId, setEditLineId] = useState("");
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  // Modal State: Reset Password
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [selectedUserForReset, setSelectedUserForReset] = useState<UserItem | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [isSubmittingReset, setIsSubmittingReset] = useState(false);

  // Modal State: Hapus User
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedUserForDelete, setSelectedUserForDelete] = useState<UserItem | null>(null);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);

  // Fetch data
  const fetchData = useCallback(async (showToast = false) => {
    try {
      setIsRefreshing(true);
      const res = await fetch("/api/admin/users");
      if (!res.ok) {
        throw new Error("Gagal mengambil data pengguna.");
      }
      const data = await res.json();
      setUsers(data.users || []);
      setLines(data.lines || []);
      if (showToast) {
        toast.success("Data pengguna berhasil diperbarui.");
      }
    } catch (err: any) {
      console.error("Fetch users error:", err);
      toast.error(err.message || "Gagal memuat pengguna.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Statistik Ringkasan
  const stats = useMemo(() => {
    const total = users.length;
    const adminCount = users.filter((u) => u.role === "admin").length;
    const leaderCount = users.filter((u) => u.role === "leader").length;
    const operatorCount = users.filter((u) => u.role === "operator").length;
    const withLineCount = users.filter((u) => !!u.lineId).length;
    return { total, adminCount, leaderCount, operatorCount, withLineCount };
  }, [users]);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Filter search
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        u.email.toLowerCase().includes(q) ||
        u.fullName.toLowerCase().includes(q) ||
        (u.lineName && u.lineName.toLowerCase().includes(q));

      // Filter role
      const matchRole = roleFilter === "all" || u.role === roleFilter;

      // Filter line
      const matchLine =
        lineFilter === "all" ||
        (lineFilter === "unassigned" && !u.lineId) ||
        u.lineId === lineFilter;

      return matchSearch && matchRole && matchLine;
    });
  }, [users, searchQuery, roleFilter, lineFilter]);

  // Handler: Tambah Pengguna
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createUsername.trim() || !createPassword.trim()) {
      toast.error("Username dan password wajib diisi.");
      return;
    }
    if (createPassword.length < 6) {
      toast.error("Password minimal 6 karakter.");
      return;
    }

    setIsSubmittingCreate(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: createUsername.trim(),
          fullName: createFullName.trim() || createUsername.trim(),
          password: createPassword,
          role: createRole,
          lineId: createLineId || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal membuat pengguna baru.");
      }

      toast.success("Pengguna baru berhasil dibuat.");
      setIsCreateOpen(false);
      setCreateUsername("");
      setCreateFullName("");
      setCreatePassword("");
      setCreateRole("operator");
      setCreateLineId("");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan.");
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Handler: Buka Edit
  const handleOpenEdit = (user: UserItem) => {
    setSelectedUserForEdit(user);
    setEditFullName(user.fullName);
    setEditRole(user.role);
    setEditLineId(user.lineId || "");
    setIsEditOpen(true);
  };

  // Handler: Simpan Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForEdit) return;

    setIsSubmittingEdit(true);
    try {
      const res = await fetch(`/api/admin/users/${selectedUserForEdit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: editFullName.trim(),
          role: editRole,
          lineId: editLineId || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal memperbarui profil pengguna.");
      }

      toast.success("Data pengguna berhasil diperbarui.");
      setIsEditOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan.");
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Handler: Buka Reset Password
  const handleOpenReset = (user: UserItem) => {
    setSelectedUserForReset(user);
    setResetPassword("");
    setResetConfirmPassword("");
    setIsResetOpen(true);
  };

  // Handler: Simpan Reset Password
  const handleSaveReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForReset) return;

    if (!resetPassword.trim()) {
      toast.error("Password baru wajib diisi.");
      return;
    }
    if (resetPassword.length < 6) {
      toast.error("Password minimal 6 karakter.");
      return;
    }
    if (resetPassword !== resetConfirmPassword) {
      toast.error("Konfirmasi password tidak cocok.");
      return;
    }

    setIsSubmittingReset(true);
    try {
      const res = await fetch(`/api/admin/users/${selectedUserForReset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: resetPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mereset password.");
      }

      toast.success(`Password untuk ${selectedUserForReset.email} berhasil diubah.`);
      setIsResetOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan.");
    } finally {
      setIsSubmittingReset(false);
    }
  };

  // Handler: Buka Konfirmasi Hapus
  const handleOpenDelete = (user: UserItem) => {
    if (user.isSelf) {
      toast.error("Anda tidak dapat menghapus akun Anda sendiri.");
      return;
    }
    setSelectedUserForDelete(user);
    setIsDeleteOpen(true);
  };

  // Handler: Eksekusi Hapus
  const handleConfirmDelete = async () => {
    if (!selectedUserForDelete) return;

    setIsSubmittingDelete(true);
    try {
      const res = await fetch(`/api/admin/users/${selectedUserForDelete.id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal menghapus pengguna.");
      }

      toast.success(`Pengguna ${selectedUserForDelete.email} berhasil dihapus.`);
      setIsDeleteOpen(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Terjadi kesalahan.");
    } finally {
      setIsSubmittingDelete(false);
    }
  };

  // Badge role component
  const renderRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 shadow-xs">
            <ShieldCheck className="h-3.5 w-3.5" />
            ADMIN
          </span>
        );
      case "leader":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 shadow-xs">
            <Award className="h-3.5 w-3.5" />
            LEADER
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 shadow-xs">
            <User className="h-3.5 w-3.5" />
            OPERATOR
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 space-y-6">
      {/* ── Top Header Bar ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1 rounded-lg hover:bg-muted"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Workspace Admin</span>
            </Link>
            <span className="text-muted-foreground/40">/</span>
            <span className="text-xs font-bold text-foreground">Pengguna & Role</span>
          </div>
          <div className="flex items-center gap-2.5 pt-1">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground">
                Manajemen Pengguna & Role
              </h1>
              <p className="text-xs text-muted-foreground">
                Atur hak akses akun (Admin, Operator, Leader) dan penugasan line kerja pabrik
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(true)}
            disabled={isRefreshing}
            className="gap-2 cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            <span>Segarkan</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="gap-2 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-sm hover:shadow"
          >
            <UserPlus className="h-4 w-4" />
            <span>Tambah Pengguna</span>
          </Button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Card className="p-4 bg-card/60 backdrop-blur-sm border-border/60 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Total Pengguna
            </p>
            <p className="text-2xl font-black text-foreground mt-0.5">{stats.total}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Users className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-4 bg-card/60 backdrop-blur-sm border-border/60 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">
              Admin
            </p>
            <p className="text-2xl font-black text-foreground mt-0.5">{stats.adminCount}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-4 bg-card/60 backdrop-blur-sm border-border/60 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              Leader
            </p>
            <p className="text-2xl font-black text-foreground mt-0.5">{stats.leaderCount}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Award className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-4 bg-card/60 backdrop-blur-sm border-border/60 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Operator
            </p>
            <p className="text-2xl font-black text-foreground mt-0.5">{stats.operatorCount}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <User className="h-5 w-5" />
          </div>
        </Card>
      </div>

      {/* ── Search & Filters Toolbar ── */}
      <Card className="p-4 bg-card/60 backdrop-blur-sm border-border/60 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Cari berdasarkan username, email, nama, atau line..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-background border border-border focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-950/40 outline-none transition"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Role Filter */}
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/50 text-xs">
              <span className="px-2 font-bold text-[11px] text-muted-foreground">Role:</span>
              {(["all", "admin", "leader", "operator"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRoleFilter(r)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    roleFilter === r
                      ? "bg-card text-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r === "all" ? "Semua" : r.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Line Filter Dropdown */}
            <select
              value={lineFilter}
              onChange={(e) => setLineFilter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl bg-background border border-border text-foreground outline-none cursor-pointer"
            >
              <option value="all">Semua Line</option>
              <option value="unassigned">Tanpa Penugasan Line</option>
              {lines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* ── Users Data Table ── */}
      <Card className="bg-card/70 backdrop-blur-sm border-border/60 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center space-y-3">
            <RefreshCw className="h-7 w-7 animate-spin text-blue-500 mx-auto" />
            <p className="text-xs text-muted-foreground">Memuat data pengguna...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto text-muted-foreground">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Tidak Ada Pengguna Ditemukan</p>
              <p className="text-xs text-muted-foreground mt-1">
                {searchQuery || roleFilter !== "all" || lineFilter !== "all"
                  ? "Coba ubah kata kunci pencarian atau filter yang aktif."
                  : "Belum ada akun pengguna yang terdaftar di sistem."}
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border/60 text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
                <tr>
                  <th className="py-3 px-4">Pengguna</th>
                  <th className="py-3 px-4">Nama Lengkap</th>
                  <th className="py-3 px-4">Role Akses</th>
                  <th className="py-3 px-4">Penugasan Line</th>
                  <th className="py-3 px-4">Terdaftar</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredUsers.map((u) => {
                  const initials = (u.fullName || u.email)
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();

                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-muted/30 transition-colors ${
                        u.isSelf ? "bg-blue-50/30 dark:bg-blue-950/10" : ""
                      }`}
                    >
                      {/* User & Email */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold border shadow-xs ${
                              u.role === "admin"
                                ? "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800"
                                : u.role === "leader"
                                ? "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
                                : "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
                            }`}
                          >
                            {initials}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-foreground">
                                {u.email.split("@")[0]}
                              </span>
                              {u.isSelf && (
                                <span className="text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold px-1.5 py-0.5 rounded-md">
                                  Anda
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-muted-foreground block font-mono">
                              {u.email}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Full Name */}
                      <td className="py-3.5 px-4 font-medium text-foreground">
                        {u.fullName || "-"}
                      </td>

                      {/* Role Badge */}
                      <td className="py-3.5 px-4">{renderRoleBadge(u.role)}</td>

                      {/* Line Assignment */}
                      <td className="py-3.5 px-4">
                        {u.lineName ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-muted border border-border/60 text-foreground font-semibold">
                            <Building2 className="h-3 w-3 text-muted-foreground" />
                            {u.lineName}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60 italic text-xs">
                            Semua Line / Bebas
                          </span>
                        )}
                      </td>

                      {/* Created At */}
                      <td className="py-3.5 px-4 text-muted-foreground font-mono text-[11px]">
                        {new Date(u.createdAt).toLocaleDateString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit Role & Profil */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(u)}
                            className="h-8 px-2.5 text-xs gap-1.5 hover:bg-muted text-foreground cursor-pointer"
                            title="Ubah Role & Profil"
                          >
                            <Pencil className="h-3.5 w-3.5 text-blue-500" />
                            <span className="hidden sm:inline">Ubah</span>
                          </Button>

                          {/* Reset Password */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenReset(u)}
                            className="h-8 px-2.5 text-xs gap-1.5 hover:bg-muted text-foreground cursor-pointer"
                            title="Ganti / Reset Password"
                          >
                            <KeyRound className="h-3.5 w-3.5 text-amber-500" />
                            <span className="hidden sm:inline">Password</span>
                          </Button>

                          {/* Delete */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDelete(u)}
                            disabled={u.isSelf}
                            className={`h-8 px-2 text-xs gap-1.5 cursor-pointer ${
                              u.isSelf
                                ? "opacity-30 cursor-not-allowed"
                                : "hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 text-muted-foreground"
                            }`}
                            title={u.isSelf ? "Tidak dapat menghapus diri sendiri" : "Hapus Pengguna"}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ═══ DIALOG 1: TAMBAH PENGGUNA BARU ═══ */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <UserPlus className="h-5 w-5 text-blue-600" />
              <span>Tambah Pengguna Baru</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateUser} className="space-y-4 pt-2">
            {/* Username / NPK */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase">
                Username / NPK / Email <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="Contoh: op_tandem atau npk204"
                value={createUsername}
                onChange={(e) => setCreateUsername(e.target.value)}
                required
              />
            </div>

            {/* Nama Lengkap */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase">
                Nama Lengkap
              </label>
              <Input
                placeholder="Contoh: Agus Sutrisno"
                value={createFullName}
                onChange={(e) => setCreateFullName(e.target.value)}
              />
            </div>

            {/* Role Dropdown */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase">
                Role Akses <span className="text-red-500">*</span>
              </label>
              <select
                value={createRole}
                onChange={(e) => setCreateRole(e.target.value as any)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs outline-none cursor-pointer"
              >
                <option value="operator">OPERATOR (Akses input mesin & operator)</option>
                <option value="leader">LEADER (Akses monitoring & andon call)</option>
                <option value="admin">ADMIN (Akses penuh seluruh sistem & dokumen)</option>
              </select>
            </div>

            {/* Penugasan Line */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase">
                Penugasan Line Kerja
              </label>
              <select
                value={createLineId}
                onChange={(e) => setCreateLineId(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs outline-none cursor-pointer"
              >
                <option value="">Semua Line / Bebas (Tidak Dibatasi)</option>
                {lines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase">
                Password (Minimal 6 Karakter) <span className="text-red-500">*</span>
              </label>
              <div className="relative flex items-center">
                <Input
                  type={showCreatePassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCreatePassword(!showCreatePassword)}
                  className="absolute right-3 text-muted-foreground hover:text-foreground"
                >
                  {showCreatePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCreateOpen(false)}
                disabled={isSubmittingCreate}
              >
                Batal
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmittingCreate}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSubmittingCreate ? "Menyimpan..." : "Buat Akun"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ═══ DIALOG 2: EDIT PENGGUNA & ROLE ═══ */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Pencil className="h-5 w-5 text-blue-600" />
              <span>Ubah Profil & Role Pengguna</span>
            </DialogTitle>
          </DialogHeader>

          {selectedUserForEdit && (
            <form onSubmit={handleSaveEdit} className="space-y-4 pt-2">
              <div className="p-3 rounded-xl bg-muted/60 border border-border/60 text-xs">
                <span className="text-muted-foreground block text-[11px]">Email / Username:</span>
                <span className="font-mono font-bold text-foreground text-sm">
                  {selectedUserForEdit.email}
                </span>
              </div>

              {/* Nama Lengkap */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">
                  Nama Lengkap
                </label>
                <Input
                  placeholder="Nama Lengkap"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                />
              </div>

              {/* Role Dropdown */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">
                  Role Akses <span className="text-red-500">*</span>
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as any)}
                  disabled={selectedUserForEdit.isSelf}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs outline-none cursor-pointer disabled:opacity-50"
                >
                  <option value="operator">OPERATOR</option>
                  <option value="leader">LEADER</option>
                  <option value="admin">ADMIN</option>
                </select>
                {selectedUserForEdit.isSelf && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                    * Anda tidak dapat mengubah role akun Anda sendiri.
                  </p>
                )}
              </div>

              {/* Penugasan Line */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">
                  Penugasan Line Kerja
                </label>
                <select
                  value={editLineId}
                  onChange={(e) => setEditLineId(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs outline-none cursor-pointer"
                >
                  <option value="">Semua Line / Bebas (Tidak Dibatasi)</option>
                  {lines.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>

              <DialogFooter className="pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditOpen(false)}
                  disabled={isSubmittingEdit}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingEdit}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isSubmittingEdit ? "Menyimpan..." : "Simpan Perubahan"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══ DIALOG 3: RESET PASSWORD ═══ */}
      <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <KeyRound className="h-5 w-5 text-amber-500" />
              <span>Ganti / Reset Password Pengguna</span>
            </DialogTitle>
          </DialogHeader>

          {selectedUserForReset && (
            <form onSubmit={handleSaveReset} className="space-y-4 pt-2">
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs">
                <p className="text-amber-800 dark:text-amber-200 leading-relaxed">
                  Anda akan mengubah password untuk akun:{" "}
                  <span className="font-bold font-mono">{selectedUserForReset.email}</span>
                </p>
              </div>

              {/* Password Baru */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">
                  Password Baru (Minimal 6 Karakter) <span className="text-red-500">*</span>
                </label>
                <div className="relative flex items-center">
                  <Input
                    type={showResetPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute right-3 text-muted-foreground hover:text-foreground"
                  >
                    {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Konfirmasi Password Baru */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-muted-foreground uppercase">
                  Konfirmasi Password Baru <span className="text-red-500">*</span>
                </label>
                <Input
                  type={showResetPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={resetConfirmPassword}
                  onChange={(e) => setResetConfirmPassword(e.target.value)}
                  required
                />
              </div>

              <DialogFooter className="pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsResetOpen(false)}
                  disabled={isSubmittingReset}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingReset}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {isSubmittingReset ? "Menyimpan..." : "Perbarui Password"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══ DIALOG 4: KONFIRMASI HAPUS PENGGUNA ═══ */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <span>Hapus Akun Pengguna?</span>
            </DialogTitle>
          </DialogHeader>

          {selectedUserForDelete && (
            <div className="space-y-3 pt-2 text-xs">
              <p className="text-muted-foreground leading-relaxed">
                Apakah Anda yakin ingin menghapus pengguna ini secara permanen?
              </p>
              <div className="p-3 bg-red-50 dark:bg-red-950/40 rounded-xl border border-red-200 dark:border-red-900/60 font-mono space-y-1">
                <div>
                  <span className="text-muted-foreground">Username:</span>{" "}
                  <span className="font-bold text-foreground">{selectedUserForDelete.email}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Nama:</span>{" "}
                  <span className="font-bold text-foreground">
                    {selectedUserForDelete.fullName || "-"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Role:</span>{" "}
                  <span className="font-bold uppercase text-foreground">
                    {selectedUserForDelete.role}
                  </span>
                </div>
              </div>
              <p className="text-red-600 dark:text-red-400 font-semibold text-[11px]">
                * Tindakan ini tidak dapat dibatalkan. Seluruh sesi aktif pengguna ini akan terputus.
              </p>

              <DialogFooter className="pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDeleteOpen(false)}
                  disabled={isSubmittingDelete}
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={handleConfirmDelete}
                  disabled={isSubmittingDelete}
                >
                  {isSubmittingDelete ? "Menghapus..." : "Ya, Hapus Pengguna"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
