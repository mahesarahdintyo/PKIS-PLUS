"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Plus,
  Trash2,
  Loader2,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import {
  getNgCategories,
  createNgCategory,
  deleteNgCategory,
  type NgCategory,
} from "@/lib/services/ng-category";

export default function AdminNgCategoriesPanel() {
  const [categories, setCategories] = useState<NgCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form state
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState<NgCategory | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteClosing, setIsDeleteClosing] = useState(false);

  const closeDeleteModal = () => {
    if (!deleteTarget || isDeleteClosing) return;
    setIsDeleteClosing(true);
    setTimeout(() => {
      setDeleteTarget(null);
      setIsDeleteClosing(false);
    }, 200);
  };

  const loadData = async () => {
    try {
      setIsLoading(true);
      const data = await getNgCategories();
      setCategories(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat kategori NG");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      setIsSubmitting(true);
      const submittedName = newName;
      const created = await createNgCategory(newName, newDescription);
      setCategories((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
      );
      setNewName("");
      setNewDescription("");
      toast.success(`Kategori NG "${created.name}" berhasil ditambahkan!`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menambahkan kategori NG"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    try {
      setIsDeleting(true);
      await deleteNgCategory(deleteTarget.id);
      setCategories((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      toast.success(`Kategori NG "${deleteTarget.name}" berhasil dihapus.`);
      closeDeleteModal();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menghapus kategori NG"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Manajemen Kategori NG
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Kelola kategori cacat (NG) yang dapat dipilih operator saat mengisi
          laporan produksi. Kategori ini otomatis tersedia di form operator.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Add Form */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm h-fit">
          <h2 className="font-bold text-base text-slate-900 mb-4 flex items-center gap-2">
            <Plus className="h-5 w-5 text-emerald-600" />
            Tambah Kategori NG
          </h2>


          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="ng-category-name"
                className="text-xs font-bold text-slate-500 uppercase tracking-wide"
              >
                Nama Kategori <span className="text-red-500">*</span>
              </label>
              <input
                id="ng-category-name"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Contoh: Dimensi, Permukaan, Material..."
                required
                disabled={isSubmitting}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition-colors duration-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:opacity-50"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="ng-category-desc"
                className="text-xs font-bold text-slate-500 uppercase tracking-wide"
              >
                Deskripsi / Keterangan
              </label>
              <textarea
                id="ng-category-desc"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Penjelasan opsional tentang kategori ini..."
                rows={3}
                disabled={isSubmitting}
                className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-800 outline-none transition-colors duration-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:opacity-50 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !newName.trim()}
              className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <span>Simpan Kategori NG</span>
              )}
            </button>
          </form>
        </div>

        {/* Right: List Table */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden h-fit">
          <div className="p-5 border-b border-slate-100">
            <h2 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <Tag className="h-5 w-5 text-rose-500" />
              Daftar Kategori NG Aktif ({categories.length})
            </h2>
          </div>

          {isLoading ? (
            <div className="py-20 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-rose-500 mx-auto" />
              <p className="mt-4 text-sm text-slate-500 font-medium">
                Memuat data kategori NG...
              </p>
            </div>
          ) : categories.length === 0 ? (
            <div className="py-16 text-center px-4">
              <Tag className="mx-auto h-12 w-12 text-slate-300 stroke-[1.5]" />
              <h3 className="mt-4 text-sm font-semibold text-slate-900">
                Belum ada kategori NG
              </h3>
              <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                Gunakan form di sebelah kiri untuk menambahkan kategori cacat
                yang bisa dipilih operator.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 select-none">
                    <th className="py-3 px-5 font-bold text-xs uppercase tracking-wider">
                      Nama Kategori
                    </th>
                    <th className="py-3 px-5 font-bold text-xs uppercase tracking-wider">
                      Keterangan
                    </th>
                    <th className="py-3 px-5 font-bold text-xs uppercase tracking-wider text-center w-24">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {categories.map((cat, index) => (
                    <tr
                      key={cat.id}
                      className="hover:bg-slate-50/50 transition-colors duration-200 animate-in fade-in slide-in-from-bottom-1 duration-300 fill-mode-backwards"
                      style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
                    >
                      <td className="py-3 px-5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-rose-50 border border-rose-100 px-2.5 py-1 text-xs font-bold text-rose-700">
                          <Tag className="h-3 w-3" />
                          {cat.name}
                        </span>
                      </td>
                      <td className="py-3 px-5 text-slate-600 text-sm">
                        {cat.description || (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-3 px-5 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(cat)}
                          className="inline-flex items-center justify-center h-8 w-8 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors duration-200 cursor-pointer"
                          title="Hapus Kategori"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs ${
            isDeleteClosing
              ? "animate-out fade-out duration-200 [animation-fill-mode:forwards]"
              : "animate-in fade-in duration-200"
          }`}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isDeleting) closeDeleteModal();
          }}
        >
          <div
            className={`relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl select-none ${
              isDeleteClosing
                ? "animate-out fade-out zoom-out-95 duration-200 [animation-fill-mode:forwards]"
                : "animate-in fade-in zoom-in-95 duration-200"
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-red-50 border border-red-100 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900">
                  Hapus Kategori NG
                </h3>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                  Apakah Anda yakin ingin menghapus kategori{" "}
                  <span className="font-bold text-slate-800">
                    &quot;{deleteTarget.name}&quot;
                  </span>
                  ?
                </p>
                <p className="mt-1 text-xs text-red-500 font-medium">
                  Tindakan ini tidak dapat dibatalkan. Laporan yang sudah
                  memakai kategori ini tidak akan terpengaruh.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                disabled={isDeleting}
                onClick={closeDeleteModal}
                className="h-10 px-4 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition duration-200 cursor-pointer"
              >
                Batal
              </button>
              <button
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
                className="h-10 px-4 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition duration-200 flex items-center justify-center cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <span>Ya, Hapus</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
