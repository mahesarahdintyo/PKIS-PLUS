'use client'

import { useState, useEffect, useRef } from 'react'
import { Eye, EyeOff, Factory, FileText, Folder, Cpu, Loader2, MoreVertical, Pencil, Trash2, X, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type { Line } from '@/lib/services/line'

/** Opsi mesin produksi yang sudah punya konfigurasi khusus */
const EXISTING_MACHINE_TYPES = [
  { slug: 'tandem',         label: 'Tandem' },
  { slug: 'blanking',       label: 'Blanking' },
  { slug: 'pc200t',         label: 'PC200t' },
  { slug: 'transfer-2000t', label: 'Transfer 2000t' },
  { slug: 'transfer-800t',  label: 'Transfer 800t' },
] as const

const KNOWN_SLUGS = EXISTING_MACHINE_TYPES.map((m) => m.slug) as string[]

type MachineTypeMode = 'none' | 'existing' | 'custom'

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

interface AdminLineCardProps {
  line: Line
  onEnter: (line: Line) => void
  onChangeSuccess?: () => void
}

export function AdminLineCard({
  line,
  onEnter,
  onChangeSuccess,
}: AdminLineCardProps) {
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isEditClosing, setIsEditClosing] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isDeleteClosing, setIsDeleteClosing] = useState(false)
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false)
  const [isActionMenuClosing, setIsActionMenuClosing] = useState(false)
  const [name, setName] = useState(line.name)
  const menuRef = useRef<HTMLDivElement>(null)

  // Tentukan mode awal berdasarkan machine_type yang ada di line
  function getModeFromLine(): MachineTypeMode {
    if (!line.machine_type) return 'none'
    if (KNOWN_SLUGS.includes(line.machine_type)) return 'existing'
    return 'custom'
  }

  const [machineTypeMode, setMachineTypeMode] = useState<MachineTypeMode>(getModeFromLine)
  const [existingMachineType, setExistingMachineType] = useState<string>(
    line.machine_type && KNOWN_SLUGS.includes(line.machine_type)
      ? line.machine_type
      : EXISTING_MACHINE_TYPES[0].slug
  )

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
  const [description, setDescription] = useState(line.description ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [isSavingVisibility, setIsSavingVisibility] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState('')
  const [isDuplicateName, setIsDuplicateName] = useState(false)
  const isHiddenFromOperator = Boolean(line.hidden_from_operator)

  const resetEditForm = () => {
    setName(line.name)
    setDescription(line.description ?? '')
    setMachineTypeMode(getModeFromLine())
    setExistingMachineType(
      line.machine_type && KNOWN_SLUGS.includes(line.machine_type)
        ? line.machine_type
        : EXISTING_MACHINE_TYPES[0].slug
    )
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
      setError('Nama line produksi tidak boleh kosong')
      return
    }

    // Hitung machine_type berdasarkan mode
    let machine_type: string | null
    if (machineTypeMode === 'none') {
      machine_type = null
    } else if (machineTypeMode === 'existing') {
      machine_type = existingMachineType
    } else {
      // custom: slugify nama
      machine_type = slugifyName(name.trim()) || null
    }

    try {
      setIsSaving(true)
      setIsDuplicateName(false)
      setError('')

      const response = await fetch('/api/lines', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: line.id,
          name: name.trim(),
          description: description.trim() || null,
          machine_type,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        const message = data?.error || 'Gagal mengubah line produksi'
        if (response.status === 409) {
          setIsDuplicateName(true)
        } else {
          setError(message)
        }
        toast.error(message)
        return
      }

      toast.success(`Line produksi "${name.trim()}" berhasil diperbarui!`)
      setIsEditOpen(false)
      onChangeSuccess?.()
    } catch {
      const msg = 'Gagal mengubah line produksi. Periksa koneksi internet Anda.'
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

      const response = await fetch(`/api/lines?id=${encodeURIComponent(line.id)}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || 'Gagal menghapus line produksi')
      }

      toast.success(`Line produksi "${line.name}" berhasil dihapus.`)
      setIsDeleteOpen(false)
      onChangeSuccess?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menghapus line produksi')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleToggleVisibility = async (event: React.MouseEvent) => {
    event.stopPropagation()

    try {
      setIsSavingVisibility(true)

      const response = await fetch('/api/lines', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: line.id,
          hidden_from_operator: !isHiddenFromOperator,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || 'Gagal mengubah visibilitas line produksi')
      }

      toast.success(
        isHiddenFromOperator
          ? `Line produksi "${line.name}" sekarang terlihat oleh operator.`
          : `Line produksi "${line.name}" disembunyikan dari operator.`
      )
      onChangeSuccess?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengubah visibilitas line produksi')
    } finally {
      setIsSavingVisibility(false)
    }
  }

  return (
    <>
      {/* Line Card */}
      <div
        onClick={() => onEnter(line)}
        className={`group relative ${isActionMenuOpen ? 'z-20' : 'z-0'} bg-card border rounded-xl p-5 shadow-sm cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${isHiddenFromOperator
            ? 'border-amber-200 bg-amber-50/40 hover:border-amber-300'
            : 'border-border hover:border-primary'
          }`}
        title={`Klik untuk membuka ${line.name}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Folder className="w-5 h-5 text-primary" />
            </div>
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-foreground truncate">
                  {line.name}
                </h3>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {line.description || 'Klik untuk membuka'}
                </p>
                <p className="mt-3 text-xs font-medium text-muted-foreground">Total Dokumen: {line.document_count ?? 0}</p>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {isHiddenFromOperator && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                      <EyeOff className="h-3.5 w-3.5" />
                      Disembunyikan dari operator
                    </span>
                  )}
                </div>
              </div>
          </div>

          <div ref={menuRef} className="relative flex-shrink-0" onClick={(event) => event.stopPropagation()}>
            <Button size="icon-sm" variant="ghost" onClick={toggleActionMenu} title="Aksi line produksi" aria-label={`Aksi untuk line ${line.name}`} className="text-muted-foreground hover:bg-muted hover:text-foreground">
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
                <button onClick={(e) => { closeActionMenu(); handleOpenEdit(e); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-primary/10 hover:text-primary"><Pencil className="w-4 h-4" /> Edit Line</button>
                <button onClick={(e) => { closeActionMenu(); handleOpenDelete(e); }} disabled={isDeleting} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50">{isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Hapus Line</button>
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
                <h2 className="text-base font-semibold text-foreground">Hapus Line Produksi</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Tindakan ini tidak dapat dibatalkan.</p>
              </div>
            </div>

            <p className="text-sm text-foreground">
              Apakah Anda yakin ingin menghapus line produksi{' '}
              <span className="font-semibold text-foreground">&quot;{line.name}&quot;</span>?
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
              <h2 className="text-lg font-semibold text-foreground">Edit Line Produksi</h2>
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
                  Nama Line Produksi <span className="text-red-500">*</span>
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

              {/* Hubungkan ke Mesin Produksi */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">
                  Hubungkan ke mesin produksi
                </label>

                {/* Opsi: Bukan line produksi */}
                <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition
                  ${machineTypeMode === 'none'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground hover:bg-muted/50'
                  }`}>
                  <input
                    type="radio"
                    name="edit-machine-type-mode"
                    value="none"
                    checked={machineTypeMode === 'none'}
                    onChange={() => setMachineTypeMode('none')}
                    className="mt-0.5 accent-blue-600"
                    disabled={isSaving}
                  />
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Bukan line produksi</p>
                      <p className="text-xs text-muted-foreground">Hanya untuk card dokumen / folder biasa</p>
                    </div>
                  </div>
                </label>

                {/* Opsi: Mesin yang sudah ada */}
                <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition
                  ${machineTypeMode === 'existing'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground hover:bg-muted/50'
                  }`}>
                  <input
                    type="radio"
                    name="edit-machine-type-mode"
                    value="existing"
                    checked={machineTypeMode === 'existing'}
                    onChange={() => setMachineTypeMode('existing')}
                    className="mt-0.5 accent-blue-600"
                    disabled={isSaving}
                  />
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Cpu className="w-4 h-4 text-indigo-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">Mesin yang sudah ada</p>
                      <p className="text-xs text-muted-foreground">Pakai konfigurasi mesin yang sudah dikonfigurasi</p>
                      {machineTypeMode === 'existing' && (
                        <select
                          value={existingMachineType}
                          onChange={(e) => setExistingMachineType(e.target.value)}
                          className="mt-2 w-full px-3 py-1.5 border border-border rounded-md text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-background"
                          disabled={isSaving}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {EXISTING_MACHINE_TYPES.map((m) => (
                            <option key={m.slug} value={m.slug}>{m.label}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                </label>

                {/* Opsi: Line produksi baru (konfigurasi standar) */}
                <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition
                  ${machineTypeMode === 'custom'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground hover:bg-muted/50'
                  }`}>
                  <input
                    type="radio"
                    name="edit-machine-type-mode"
                    value="custom"
                    checked={machineTypeMode === 'custom'}
                    onChange={() => setMachineTypeMode('custom')}
                    className="mt-0.5 accent-blue-600"
                    disabled={isSaving}
                  />
                  <div className="flex items-center gap-2 min-w-0">
                    <Factory className="w-4 h-4 text-green-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Line produksi baru (konfigurasi standar)</p>
                      <p className="text-xs text-muted-foreground">Buat mesin baru dengan template umum</p>
                      {machineTypeMode === 'custom' && name.trim() && (
                        <p className="text-xs text-indigo-600 font-mono mt-0.5">
                          machine_type: <span className="font-semibold">{slugifyName(name.trim())}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </label>

                {/* Tampilkan machine_type saat ini jika ada dan tidak diubah */}
                {machineTypeMode === 'custom' && line.machine_type && !KNOWN_SLUGS.includes(line.machine_type) && (
                  <p className="text-xs text-muted-foreground pl-1">
                    Sebelumnya: <span className="font-mono text-foreground">{line.machine_type}</span>
                  </p>
                )}
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
