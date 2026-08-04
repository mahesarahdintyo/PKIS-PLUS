'use client'

import { useState, useEffect, useRef } from 'react'
import { Eye, EyeOff, Folder, Loader2, MoreVertical, Pencil, Trash2, X, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type { Land } from '@/lib/services/land'

interface AdminLandCardProps {
  land: Land
  onEnter: (land: Land) => void
  onChangeSuccess?: () => void
}

export function AdminLandCard({
  land,
  onEnter,
  onChangeSuccess,
}: AdminLandCardProps) {
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isEditClosing, setIsEditClosing] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isDeleteClosing, setIsDeleteClosing] = useState(false)
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false)
  const [isActionMenuClosing, setIsActionMenuClosing] = useState(false)
  const [name, setName] = useState(land.name)
  const menuRef = useRef<HTMLDivElement>(null)

  const closeDeleteModal = () => {
    if (!isDeleteOpen || isDeleteClosing) return
    setIsDeleteClosing(true)
    setTimeout(() => {
      setIsDeleteOpen(false)
      setIsDeleteClosing(false)
    }, 200)
  }

  const closeEditModal = () => {
    if (!isEditOpen || isEditClosing) return
    setIsEditClosing(true)
    setTimeout(() => {
      setIsEditOpen(false)
      setIsEditClosing(false)
    }, 200)
  }

  const closeActionMenu = () => {
    if (!isActionMenuOpen || isActionMenuClosing) return
    setIsActionMenuClosing(true)
    setTimeout(() => {
      setIsActionMenuOpen(false)
      setIsActionMenuClosing(false)
    }, 150)
  }

  const toggleActionMenu = () => {
    if (isActionMenuOpen) {
      closeActionMenu()
    } else {
      setIsActionMenuClosing(false)
      setIsActionMenuOpen(true)
    }
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        closeActionMenu()
      }
    }

    if (isActionMenuOpen && !isActionMenuClosing) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isActionMenuOpen, isActionMenuClosing])
  const [description, setDescription] = useState(land.description ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingVisibility, setIsSavingVisibility] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState('')
  const [isDuplicateName, setIsDuplicateName] = useState(false)
  const isHiddenFromOperator = Boolean(land.hidden_from_operator)

  const resetEditForm = () => {
    setName(land.name)
    setDescription(land.description ?? '')
    setError('')
    setIsDuplicateName(false)
  }

  const handleOpenEdit = (event: React.MouseEvent) => {
    event.stopPropagation()
    resetEditForm()
    setIsEditOpen(true)
  }

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Nama card tidak boleh kosong')
      return
    }

    try {
      setIsSaving(true)
      setIsDuplicateName(false)
      setError('')

      const response = await fetch('/api/lands', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: land.id,
          name: name.trim(),
          description: description.trim() || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        const message = data?.error || 'Gagal mengubah card'
        if (response.status === 409) {
          setIsDuplicateName(true)
        } else {
          setError(message)
        }
        toast.error(message)
        return
      }

      toast.success(`Card "${name.trim()}" berhasil diperbarui!`)
      setIsEditOpen(false)
      onChangeSuccess?.()
    } catch {
      const msg = 'Gagal mengubah card. Periksa koneksi internet Anda.'
      setError(msg)
      toast.error(msg)
    } finally {
      setIsSaving(false)
    }
  }

  const handleOpenDelete = (event: React.MouseEvent) => {
    event.stopPropagation()
    setIsDeleteOpen(true)
  }

  const handleDelete = async () => {
    try {
      setIsDeleting(true)

      const response = await fetch(`/api/lands?id=${encodeURIComponent(land.id)}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || 'Gagal menghapus card')
      }

      toast.success(`Card "${land.name}" berhasil dihapus.`)
      setIsDeleteOpen(false)
      onChangeSuccess?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menghapus card')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleToggleVisibility = async (event: React.MouseEvent) => {
    event.stopPropagation()

    try {
      setIsSavingVisibility(true)

      const response = await fetch('/api/lands', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: land.id,
          hidden_from_operator: !isHiddenFromOperator,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || 'Gagal mengubah visibilitas card')
      }

      toast.success(
        isHiddenFromOperator
          ? `Card "${land.name}" sekarang terlihat oleh operator.`
          : `Card "${land.name}" disembunyikan dari operator.`
      )
      onChangeSuccess?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengubah visibilitas card')
    } finally {
      setIsSavingVisibility(false)
    }
  }

  return (
    <>
      {/* Card */}
      <div
        onClick={() => onEnter(land)}
        className={`group relative ${isActionMenuOpen ? 'z-20' : 'z-0'} bg-card border rounded-xl p-5 shadow-sm cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${isHiddenFromOperator
            ? 'border-amber-200 bg-amber-50/40 hover:border-amber-300'
            : 'border-border hover:border-primary'
          }`}
        title={`Klik untuk membuka ${land.name}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Folder className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-foreground truncate">
                {land.name}
              </h3>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {land.description || 'Klik untuk membuka'}
              </p>
              <p className="mt-3 text-xs font-medium text-muted-foreground">Total Dokumen: {land.document_count ?? 0}</p>

              {isHiddenFromOperator && (
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                  <EyeOff className="h-3.5 w-3.5" />
                  Disembunyikan dari operator
                </span>
              )}
            </div>
          </div>

          <div ref={menuRef} className="relative flex-shrink-0" onClick={(event) => event.stopPropagation()}>
            <Button size="icon-sm" variant="ghost" onClick={toggleActionMenu} title="Aksi card" aria-label={`Aksi untuk card ${land.name}`} className="text-muted-foreground hover:bg-muted hover:text-foreground">
              <MoreVertical className="w-5 h-5" />
            </Button>
            {isActionMenuOpen && (
              <div className={`absolute right-0 top-9 z-10 w-48 rounded-xl border border-border bg-card p-1.5 shadow-lg ${isActionMenuClosing
                  ? 'animate-out fade-out slide-out-to-top-2 duration-150 [animation-fill-mode:forwards]'
                  : 'animate-in fade-in slide-in-from-top-2 duration-150'
                }`}>
                <button onClick={(e) => { closeActionMenu(); handleToggleVisibility(e); }} disabled={isSavingVisibility} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50">
                  {isSavingVisibility ? <Loader2 className="w-4 h-4 animate-spin" /> : isHiddenFromOperator ? <Eye className="w-4 h-4 text-emerald-600" /> : <EyeOff className="w-4 h-4 text-amber-600" />}
                  {isHiddenFromOperator ? 'Tampilkan ke Operator' : 'Sembunyikan dari Operator'}
                </button>
                <button onClick={(e) => { closeActionMenu(); handleOpenEdit(e); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-primary/10 hover:text-primary"><Pencil className="w-4 h-4" /> Edit Card</button>
                <button onClick={(e) => { closeActionMenu(); handleOpenDelete(e); }} disabled={isDeleting} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50">{isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Hapus Card</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Konfirmasi Hapus */}
      {isDeleteOpen && (
        <div
          className={`fixed inset-0 flex items-center justify-center z-50 p-4 backdrop-blur-sm ${
            isDeleteClosing
              ? 'animate-out fade-out duration-200 [animation-fill-mode:forwards]'
              : 'animate-in fade-in duration-200'
          }`}
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
          onClick={(e) => { if (e.target === e.currentTarget && !isDeleting) closeDeleteModal() }}
        >
          <div className={`bg-card rounded-xl shadow-2xl max-w-sm w-full p-6 space-y-4 ${
            isDeleteClosing
              ? 'animate-out fade-out zoom-out-95 duration-200 [animation-fill-mode:forwards]'
              : 'animate-in fade-in zoom-in-95 duration-200'
          }`}>
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">Hapus Card</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Tindakan ini tidak dapat dibatalkan.</p>
              </div>
            </div>

            <p className="text-sm text-foreground">
              Apakah Anda yakin ingin menghapus card{' '}
              <span className="font-semibold text-foreground">&quot;{land.name}&quot;</span>?
            </p>

            <div className="flex gap-3 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={closeDeleteModal}
                disabled={isDeleting}
                className="flex-1"
              >
                Batal
              </Button>
              <Button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 bg-destructive text-white hover:bg-destructive/90"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Menghapus...
                  </>
                ) : (
                  'Hapus'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit */}
      {isEditOpen && (
        <div
          className={`fixed inset-0 flex items-center justify-center z-50 p-4 backdrop-blur-sm ${
            isEditClosing
              ? 'animate-out fade-out duration-200 [animation-fill-mode:forwards]'
              : 'animate-in fade-in duration-200'
          }`}
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
          onClick={(e) => { if (e.target === e.currentTarget && !isSaving) closeEditModal() }}
        >
          <div className={`bg-card rounded-xl shadow-2xl max-w-md w-full ${
            isEditClosing
              ? 'animate-out fade-out zoom-out-95 duration-200 [animation-fill-mode:forwards]'
              : 'animate-in fade-in zoom-in-95 duration-200'
          }`}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">Edit Card</h2>
              <button
                onClick={closeEditModal}
                disabled={isSaving}
                className="text-muted-foreground hover:text-foreground disabled:opacity-50 transition-all duration-200"
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-foreground">
                  Nama Card <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value)
                    if (isDuplicateName) setIsDuplicateName(false)
                    if (error) setError('')
                  }}
                  className={`w-full px-4 py-2.5 border rounded-lg text-sm text-foreground outline-none focus:ring-2 transition-all duration-200
                    ${isDuplicateName
                      ? 'border-red-400 bg-red-50 focus:ring-red-200'
                      : 'border-border bg-background focus:ring-primary/20 focus:border-primary'
                    }`}
                  disabled={isSaving}
                  autoFocus
                />
                {isDuplicateName && (
                  <p className="text-xs text-red-600 font-medium">
                    Nama ini sudah digunakan. Pilih nama yang berbeda.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-foreground">
                  Deskripsi <span className="text-muted-foreground">(opsional)</span>
                </label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-border bg-background rounded-lg text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 resize-none"
                  disabled={isSaving}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closeEditModal}
                  disabled={isSaving}
                  className="flex-1"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving || !name.trim()}
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    'Simpan'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
